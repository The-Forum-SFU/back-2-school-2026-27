import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { ClaimResult } from '../../api/_lib/types'

/**
 * POST /api/signup, end to end with the database and both integrations mocked.
 *
 * The assertions worth reading are the negative ones. This endpoint is public,
 * unauthenticated, and writes to a table, so most of what matters is what it refuses
 * and what it declines to say back.
 */

const rpc = vi.hoisted(() => vi.fn())
const patchSubmission = vi.hoisted(() => vi.fn())
const syncToBrevo = vi.hoisted(() => vi.fn())
const sendLeadEvent = vi.hoisted(() => vi.fn())

vi.mock('../../api/_lib/supabase', () => ({ rpc, patchSubmission }))
vi.mock('../../api/_lib/brevo', () => ({ syncToBrevo }))
vi.mock('../../api/_lib/meta', () => ({
  sendLeadEvent,
  buildFbc: (id: string) => `fb.1.0.${id}`,
}))

const { default: handler } = await import('../../api/signup')

type Captured = { status: number; body: unknown; headers: Record<string, string> }

function mockRes(): { res: VercelResponse; captured: Captured } {
  const captured: Captured = { status: 0, body: undefined, headers: {} }
  const res = {
    status(code: number) {
      captured.status = code
      return this
    },
    json(body: unknown) {
      captured.body = body
      return this
    },
    setHeader(key: string, value: string) {
      captured.headers[key.toLowerCase()] = value
    },
  } as unknown as VercelResponse
  return { res, captured }
}

function mockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: { host: 'rewind.example.com', ...(overrides.headers ?? {}) },
    socket: { remoteAddress: '203.0.113.7' },
    query: {},
    ...overrides,
    body: overrides.body,
  } as unknown as VercelRequest
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    ticketType: 'presale-guestlist',
    firstName: 'Jordan',
    lastName: 'Nguyen',
    email: 'jordan@example.com',
    phone: '6045550123',
    dob: '2004-04-12',
    ageConfirmed: true,
    privacyAccepted: true,
    consentOptIn: true,
    consentText: 'Opt in to email and SMS from The Forum.',
    privacyText: 'By signing up you agree to our Privacy Policy.',
    elapsedMs: 9000,
    ...overrides,
  }
}

/** The named args the handler passed to claim_signup on its most recent call. */
function rpcArgs(): Record<string, unknown> {
  return rpc.mock.calls.at(-1)?.[1] as Record<string, unknown>
}

async function post(body: unknown, reqOverrides: Partial<VercelRequest> = {}) {
  const { res, captured } = mockRes()
  await handler(mockReq({ body, ...reqOverrides }), res)
  return captured
}

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  process.env.IP_HASH_SALT = 'test-pepper'
  rpc.mockResolvedValue({ status: 'created', id: 'row-uuid' } satisfies ClaimResult)
  patchSubmission.mockResolvedValue(undefined)
  syncToBrevo.mockResolvedValue({ synced: true, contactId: '1' })
  sendLeadEvent.mockResolvedValue({ sent: true })
})

describe('transport guards', () => {
  it('rejects any method other than POST without touching the database', async () => {
    for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS']) {
      const captured = await post(validBody(), { method })
      expect(captured.status).toBe(405)
      expect(captured.headers.allow).toBe('POST')
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a request driven from another origin', async () => {
    const captured = await post(validBody(), {
      headers: { host: 'rewind.example.com', origin: 'https://evil.example' },
    })
    expect(captured.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('allows a same-origin request', async () => {
    const captured = await post(validBody(), {
      headers: { host: 'rewind.example.com', origin: 'https://rewind.example.com' },
    })
    expect(captured.status).toBe(201)
  })

  it('allows a request with no Origin at all, which is every non-browser client', async () => {
    expect((await post(validBody())).status).toBe(201)
  })

  it('rejects an unparseable Origin rather than trusting it', async () => {
    const captured = await post(validBody(), {
      headers: { host: 'rewind.example.com', origin: 'not a url' },
    })
    expect(captured.status).toBe(403)
  })

  it.each([
    ['an array', [1, 2, 3]],
    ['a string', 'firstName=Jordan'],
    ['a number', 42],
  ])('rejects a body that is %s rather than reading undefined off it', async (_l, body) => {
    const captured = await post(body)
    expect(captured.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('never lets a signup response be cached', async () => {
    expect((await post(validBody())).headers['cache-control']).toBe('no-store')
    expect((await post(validBody(), { method: 'GET' })).headers['cache-control']).toBe(
      'no-store',
    )
  })
})

describe('bot traps', () => {
  it('rejects a filled honeypot, and says nothing about why', async () => {
    const captured = await post(validBody({ company: 'Acme Inc' }))
    expect(captured.status).toBe(400)
    // Indistinguishable from ordinary validation, so a scripted client learns nothing.
    expect(captured.body).toEqual({
      status: 'invalid',
      fieldErrors: { email: 'Please try again' },
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a submit that arrived faster than a human could type it', async () => {
    expect((await post(validBody({ elapsedMs: 400 }))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does not punish a slow, ordinary submit', async () => {
    expect((await post(validBody({ elapsedMs: 45_000 }))).status).toBe(201)
  })

  it('treats a whitespace-only honeypot as empty, since autofill can touch it', async () => {
    expect((await post(validBody({ company: '   ' }))).status).toBe(201)
  })
})

describe('what comes back', () => {
  it('returns only a status and the dedup id on success', async () => {
    const captured = await post(validBody({ eventId: 'lead_abc' }))
    expect(captured.status).toBe(201)
    expect(captured.body).toEqual({ status: 'created', eventId: 'lead_abc' })
  })

  it('never leaks the row id, a slot number, a remaining count or a capacity', async () => {
    // The inventory rule, enforced at the only place it can actually be enforced.
    const cases: ClaimResult[] = [
      { status: 'created', id: 'row-uuid' },
      { status: 'already_registered', id: 'row-uuid' },
      { status: 'full' },
    ]
    for (const claim of cases) {
      rpc.mockResolvedValueOnce(claim)
      const captured = await post(validBody())
      const serialised = JSON.stringify(captured.body)
      expect(serialised).not.toContain('row-uuid')
      for (const leak of ['slot', 'remaining', 'capacity']) {
        expect(serialised).not.toContain(leak)
      }
    }
  })

  it('maps each terminal status onto its own HTTP code', async () => {
    const cases: [ClaimResult, number][] = [
      [{ status: 'created', id: 'r' }, 201],
      [{ status: 'already_registered', id: 'r' }, 200],
      [{ status: 'full' }, 409],
      [{ status: 'not_open', opensAt: 'a', closesAt: 'b' }, 403],
      [{ status: 'closed', opensAt: 'a', closesAt: 'b' }, 403],
      [{ status: 'underage', minAge: 19 }, 403],
      [{ status: 'rate_limited' }, 429],
      [{ status: 'unknown_list' }, 400],
    ]
    for (const [claim, code] of cases) {
      rpc.mockResolvedValueOnce(claim)
      expect((await post(validBody())).status).toBe(code)
    }
  })

  it('returns a 500 with a generic message when the database call throws', async () => {
    rpc.mockRejectedValueOnce(new Error('PGRST202 function not found'))
    const captured = await post(validBody())
    expect(captured.status).toBe(500)
    // No internals in the reply: the Postgres error goes to the log, not the browser.
    expect(captured.body).toEqual({ status: 'error', message: 'Could not process signup' })
    expect(JSON.stringify(captured.body)).not.toContain('PGRST202')
  })

  it('rejects a ticketType that is not one of the four', async () => {
    for (const bad of ['vip', '', null, 42, 'presale-guestlist ']) {
      const captured = await post(validBody({ ticketType: bad }))
      expect(captured.body).toEqual({ status: 'unknown_list' })
    }
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('what reaches the database', () => {
  it('hashes the client IP and never passes the address itself', async () => {
    await post(validBody(), {
      headers: { host: 'rewind.example.com', 'x-forwarded-for': '198.51.100.9, 10.0.0.1' },
    })
    const args = rpcArgs()
    expect(args.p_ip_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(args)).not.toContain('198.51.100.9')
  })

  it('takes the left-most forwarded address, which is the client and not a proxy', async () => {
    await post(validBody(), {
      headers: { host: 'h', 'x-forwarded-for': '198.51.100.9, 10.0.0.1' },
    })
    const viaClient = rpcArgs().p_ip_hash
    rpc.mockClear()
    await post(validBody(), { headers: { host: 'h', 'x-forwarded-for': '198.51.100.9' } })
    expect(rpcArgs().p_ip_hash).toBe(viaClient)
  })

  it('always sends an ip_hash, so the per-IP limit can never be silently off', async () => {
    delete process.env.IP_HASH_SALT
    await post(validBody())
    expect(rpcArgs().p_ip_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('truncates the consent and privacy text it was handed', async () => {
    await post(
      validBody({ consentText: 'x'.repeat(50_000), privacyText: 'y'.repeat(50_000) }),
    )
    const args = rpcArgs()
    expect((args.p_consent_text as string).length).toBe(500)
    expect((args.p_privacy_text as string).length).toBe(500)
  })

  it('truncates attribution values and the user agent', async () => {
    await post(validBody({ attribution: { utmCampaign: 'z'.repeat(50_000) } }), {
      headers: { host: 'h', 'user-agent': 'u'.repeat(50_000) },
    })
    const args = rpcArgs()
    expect((args.p_attribution as Record<string, string>).utmCampaign.length).toBe(512)
    expect((args.p_user_agent as string).length).toBe(512)
  })

  it('generates an event id when the client omits one, and clamps an over-long one', async () => {
    await post(validBody({ eventId: undefined }))
    expect(rpcArgs().p_event_id).toMatch(/^lead_/)

    rpc.mockClear()
    await post(validBody({ eventId: 'e'.repeat(5000) }))
    expect((rpcArgs().p_event_id as string).length).toBe(100)
  })

  it('normalises the name, email and phone before they are stored', async () => {
    await post(
      validBody({ firstName: '  Jordan ', email: ' JORDAN@Example.COM ', phone: '(604) 555-0123' }),
    )
    const args = rpcArgs()
    expect(args.p_first_name).toBe('Jordan')
    expect(args.p_email).toBe('jordan@example.com')
    expect(args.p_phone).toBe('+16045550123')
  })

  it('refuses the signup outright when the box was not ticked, and writes no row', async () => {
    const captured = await post(validBody({ consentOptIn: false }))
    expect(captured.status).toBe(400)
    expect(captured.body).toMatchObject({ status: 'invalid' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('passes the opt-in through as a real boolean when it was ticked', async () => {
    await post(validBody({ consentOptIn: true }))
    expect(rpcArgs().p_consent_opt_in).toBe(true)
  })

  it('coerces the attestations to real booleans rather than passing them through', async () => {
    await post(validBody({ ageConfirmed: 'yes', privacyAccepted: 1 }))
    // Both are non-`true`, so validation rejects before the RPC is reached at all.
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('side effects', () => {
  it('syncs to Brevo and Meta only for a freshly created row', async () => {
    await post(validBody())
    expect(syncToBrevo).toHaveBeenCalledOnce()
    expect(sendLeadEvent).toHaveBeenCalledOnce()
    expect(patchSubmission).toHaveBeenCalledWith('row-uuid', {
      brevo_synced: true,
      brevo_contact_id: '1',
      meta_sent: true,
    })
  })

  it('fires nothing for a duplicate, so no second Lead is counted', async () => {
    rpc.mockResolvedValueOnce({ status: 'already_registered', id: 'row-uuid' })
    await post(validBody())
    expect(syncToBrevo).not.toHaveBeenCalled()
    expect(sendLeadEvent).not.toHaveBeenCalled()
    expect(patchSubmission).not.toHaveBeenCalled()
  })

  it('still returns 201 when both integrations report failure', async () => {
    // The row is already committed. A Brevo outage is a backfill queue, not a lost signup.
    syncToBrevo.mockResolvedValueOnce({ synced: false, reason: 'http_500' })
    sendLeadEvent.mockResolvedValueOnce({ sent: false, reason: 'http_400' })
    expect((await post(validBody())).status).toBe(201)
    expect(patchSubmission).toHaveBeenCalledWith('row-uuid', {
      brevo_synced: false,
      brevo_contact_id: null,
      meta_sent: false,
    })
  })

  it('fires the pixel event with the same id the response carries', async () => {
    const captured = await post(validBody({ eventId: 'lead_dedup_me' }))
    expect(sendLeadEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'lead_dedup_me' }),
    )
    expect(captured.body).toMatchObject({ eventId: 'lead_dedup_me' })
  })
})
