import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * POST /api/subscribe, with Brevo mocked.
 *
 * Two things here are worth a test and the rest is shape. WHICH LIST it posts to, because
 * there are two mailing lists on this account and only one of them is a lawful send list —
 * getting that wrong is silent, and the damage is mailing people who declined. And what it
 * does when Brevo fails, because unlike /api/signup there is no committed row behind this
 * one: a swallowed failure would show a success message over an address that reached
 * nothing at all.
 */

const subscribeToBrevo = vi.hoisted(() => vi.fn())
vi.mock('../../api/_lib/brevo', () => ({ subscribeToBrevo }))

const { default: handler } = await import('../../api/subscribe')

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
  return { firstName: 'Jordan', email: 'jordan@example.com', elapsedMs: 9000, ...overrides }
}

async function post(body: unknown, reqOverrides: Partial<VercelRequest> = {}) {
  const { res, captured } = mockRes()
  await handler(mockReq({ body, ...reqOverrides }), res)
  return captured
}

beforeEach(() => {
  subscribeToBrevo.mockReset()
  subscribeToBrevo.mockResolvedValue({ synced: true, contactId: '42' })
})

describe('transport guards', () => {
  it('rejects any method other than POST without calling Brevo', async () => {
    for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS']) {
      const captured = await post(validBody(), { method })
      expect(captured.status).toBe(405)
      expect(captured.headers.allow).toBe('POST')
    }
    expect(subscribeToBrevo).not.toHaveBeenCalled()
  })

  it('rejects a request driven from another origin', async () => {
    const captured = await post(validBody(), {
      headers: { host: 'rewind.example.com', origin: 'https://evil.example' },
    })
    expect(captured.status).toBe(403)
    expect(subscribeToBrevo).not.toHaveBeenCalled()
  })

  it('allows a same-origin request, and one with no Origin at all', async () => {
    expect(
      (
        await post(validBody(), {
          headers: { host: 'rewind.example.com', origin: 'https://rewind.example.com' },
        })
      ).status,
    ).toBe(200)
    expect((await post(validBody())).status).toBe(200)
  })

  it.each([
    ['an array', [1, 2, 3]],
    ['a string', 'email=jordan@example.com'],
    ['a number', 42],
  ])('rejects a body that is %s rather than reading undefined off it', async (_l, body) => {
    expect((await post(body)).status).toBe(400)
    expect(subscribeToBrevo).not.toHaveBeenCalled()
  })

  it('never lets a response be cached, whatever the outcome', async () => {
    expect((await post(validBody())).headers['cache-control']).toBe('no-store')
    expect((await post(validBody({ email: 'nope' }))).headers['cache-control']).toBe('no-store')
  })
})

describe('bot traps', () => {
  /*
    Both answer exactly like an ordinary validation failure. A scripted client that could
    tell "you tripped the honeypot" apart from "that email is malformed" learns which of
    its two problems to fix.
  */
  it('refuses a filled honeypot, and says nothing about why', async () => {
    const captured = await post(validBody({ company: 'Acme Inc' }))
    expect(captured.status).toBe(400)
    expect(captured.body).toEqual({
      status: 'invalid',
      fieldErrors: { email: 'Please try again' },
    })
    expect(subscribeToBrevo).not.toHaveBeenCalled()
  })

  it('refuses a submission faster than a human could type it', async () => {
    expect((await post(validBody({ elapsedMs: 1999 }))).status).toBe(400)
    expect(subscribeToBrevo).not.toHaveBeenCalled()
  })

  it('accepts one at the two second boundary', async () => {
    expect((await post(validBody({ elapsedMs: 2000 }))).status).toBe(200)
  })
})

describe('validation', () => {
  it.each([
    ['a missing first name', { firstName: '' }, 'firstName'],
    ['a blank first name', { firstName: '   ' }, 'firstName'],
    ['a missing email', { email: '' }, 'email'],
    ['a malformed email', { email: 'jordan@' }, 'email'],
  ])('rejects %s', async (_label, overrides, field) => {
    const captured = await post(validBody(overrides))
    expect(captured.status).toBe(400)
    expect((captured.body as { fieldErrors: Record<string, string> }).fieldErrors[field]).toBeTruthy()
    expect(subscribeToBrevo).not.toHaveBeenCalled()
  })

  /*
    The same refusal as every other form on the site. SFU's filters quarantine bulk mail, so
    an address collected here is one that never receives anything — the rule has to hold on
    every form or it holds on none.
  */
  it('refuses an @sfu.ca address, subdomains included', async () => {
    for (const email of ['jordan@sfu.ca', 'jordan@mail.sfu.ca']) {
      const captured = await post(validBody({ email }))
      expect(captured.status).toBe(400)
      expect(
        (captured.body as { fieldErrors: { email?: string } }).fieldErrors.email,
      ).toMatch(/SFU addresses/)
    }
  })

  it('lets an address that merely looks like one through', async () => {
    expect((await post(validBody({ email: 'jordan@notsfu.ca' }))).status).toBe(200)
  })

  it('normalises the address and trims the name before they reach Brevo', async () => {
    await post(validBody({ firstName: '  Jordan  ', email: '  Jordan@Example.COM ' }))
    expect(subscribeToBrevo).toHaveBeenCalledWith({
      firstName: 'Jordan',
      email: 'jordan@example.com',
    })
  })
})

describe('the write', () => {
  it('answers `subscribed` once Brevo has the contact', async () => {
    const captured = await post(validBody())
    expect(captured.status).toBe(200)
    expect(captured.body).toEqual({ status: 'subscribed' })
  })

  /*
    THE ONE THAT MATTERS MOST. api/signup.ts swallows a Brevo failure because its row is
    already committed and a backfill can pick it up later. Nothing is committed here — Brevo
    IS the write — so a swallowed failure is a success message over an address that went
    nowhere, with no record anywhere that it was ever typed.
  */
  it('reports a Brevo failure as a real error rather than a false success', async () => {
    for (const reason of ['no_api_key', 'no_list_id (BREVO_LIST_ID_JUST_MAILING)', 'http_500']) {
      subscribeToBrevo.mockResolvedValueOnce({ synced: false, reason })
      const captured = await post(validBody())
      expect(captured.status).toBe(500)
      expect((captured.body as { status: string }).status).toBe('error')
    }
  })
})
