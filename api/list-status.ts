import type { VercelRequest, VercelResponse } from '@vercel/node'
import { rpc } from './_lib/supabase'
import { isTicketType, type ListStatus } from './_lib/types'

/**
 * GET /api/list-status?ticketType=presale-guestlist
 *
 * The page renders its own first frame from config, then reconciles against this.
 * The server wins on disagreement: device clocks are wrong often enough to matter,
 * and `remaining` is something only the database knows.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.ticketType
  const ticketType = Array.isArray(raw) ? raw[0] : raw

  if (!isTicketType(ticketType)) {
    return res.status(400).json({ status: 'error', message: 'Unknown ticketType' })
  }

  try {
    const status = await rpc<ListStatus | null>('list_status', { p_ticket_type: ticketType })
    if (!status) {
      return res.status(404).json({ status: 'error', message: 'Unknown ticketType' })
    }
    // Short cache: enough to absorb a burst of page loads, short enough that the
    // list flipping to full is visible within a minute.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15')
    return res.status(200).json(status)
  } catch (err) {
    console.error('[list-status] failed:', String(err))
    return res.status(500).json({ status: 'error', message: 'Could not read list status' })
  }
}
