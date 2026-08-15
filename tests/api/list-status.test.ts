import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../api/_lib/supabase', () => ({ rpc, patchSubmission: vi.fn() }))

const { default: handler } = await import('../../api/list-status')

type Captured = { status: number; body: unknown; headers: Record<string, string> }

function run(query: Record<string, unknown>, method = 'GET') {
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
  return handler({ method, query, headers: {} } as unknown as VercelRequest, res).then(
    () => captured,
  )
}

const OPEN = {
  ticketType: 'presale-guestlist',
  phase: 'open',
  opensAt: '2026-08-10T07:00:00+00:00',
  closesAt: '2026-08-26T06:59:59+00:00',
}

beforeEach(() => {
  rpc.mockResolvedValue(OPEN)
})

describe('GET /api/list-status', () => {
  it('returns the phase for a known list', async () => {
    const captured = await run({ ticketType: 'presale-guestlist' })
    expect(captured.status).toBe(200)
    expect(captured.body).toEqual(OPEN)
  })

  it('publishes no countable figure', async () => {
    // This endpoint is unauthenticated, so anything in the payload is public. While
    // `remaining` was here, the exact number of guestlist spots left was one curl away
    // no matter what the page rendered.
    const captured = await run({ ticketType: 'presale-guestlist' })
    const keys = Object.keys(captured.body as object)
    expect(keys).not.toContain('remaining')
    expect(keys).not.toContain('capacity')
    expect(keys.sort()).toEqual(['closesAt', 'opensAt', 'phase', 'ticketType'])
  })

  it('rejects a write method', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const captured = await run({ ticketType: 'presale-guestlist' }, method)
      expect(captured.status).toBe(405)
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects an unknown ticketType before reaching the database', async () => {
    for (const bad of ['vip', '', undefined, 'presale-guestlist; drop table submissions']) {
      expect((await run({ ticketType: bad })).status).toBe(400)
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('takes the first value when the parameter is repeated', async () => {
    const captured = await run({ ticketType: ['presale-guestlist', 'table-service'] })
    expect(captured.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('list_status', { p_ticket_type: 'presale-guestlist' })
  })

  it('404s when the row does not exist', async () => {
    rpc.mockResolvedValueOnce(null)
    expect((await run({ ticketType: 'table-service' })).status).toBe(404)
  })

  it('500s with a generic message when the database throws', async () => {
    rpc.mockRejectedValueOnce(new Error('connection refused to db.internal'))
    const captured = await run({ ticketType: 'presale-guestlist' })
    expect(captured.status).toBe(500)
    expect(JSON.stringify(captured.body)).not.toContain('db.internal')
  })

  it('caches only briefly, so a list going full is visible within a minute', async () => {
    const captured = await run({ ticketType: 'presale-guestlist' })
    expect(captured.headers['cache-control']).toBe('public, max-age=0, s-maxage=15')
  })
})
