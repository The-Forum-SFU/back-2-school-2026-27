import type { VercelRequest, VercelResponse } from '@vercel/node'
import { subscribeToBrevo } from './_lib/brevo.js'
import { isPlainObject, originAllowed } from './_lib/http.js'
import type { SubscribeRequest, SubscribeResult } from './_lib/types.js'
import { validateSubscribe } from './_lib/validate.js'

/**
 * POST /api/subscribe — the two-field mailing-list form at the end of /tickets.
 *
 * WHY THIS EXISTS ALONGSIDE /api/signup RATHER THAN INSIDE IT.
 *
 * That endpoint's write path is `claim_signup`, which is the only thing that may touch
 * `submissions`, and it requires a last name, a phone number and a date of birth — all three
 * NOT NULL in the table, with `age_at_event` computed from the third. A first-name-and-email
 * form cannot satisfy any of that without a migration relaxing those columns and a rewrite of
 * the RPC that guards the guestlist. That is a schema change to the table the ticket drop
 * depends on, in exchange for storing two fields.
 *
 * So this writes to Brevo and nothing else. Deliberate consequences, all of them accepted:
 *
 *   no Supabase row     these contacts exist only in Brevo. Nothing here needs a slot, an
 *                       age or a door list, so there is nothing for a row to protect.
 *   no rate limiting    the per-IP limit lives inside claim_signup, which this never calls.
 *                       The guards below are the origin check, the honeypot and the timing
 *                       gate; Brevo's upsert makes a replay idempotent, so the exposure is
 *                       junk contacts rather than duplicate records.
 *   no Meta Lead        there is no server-side CAPI counterpart here, so a client-only
 *                       Lead would fire undeduplicated into the set optimised for ticket
 *                       signups. PageTracking still reports the /tickets PageView.
 *
 * The order below mirrors api/signup.ts: transport guards first (no work, no network), then
 * the bot traps, then validation, then the one call that can actually fail.
 */

/** Maps a terminal result onto an HTTP code. `status` in the body is the real contract. */
const HTTP: Record<SubscribeResult['status'], number> = {
  subscribed: 200,
  invalid: 400,
  error: 500,
}

function send(res: VercelResponse, result: SubscribeResult) {
  // Per-person and never revalidatable, same as a signup response: without this a shared
  // CDN or an in-app browser cache can hand one person's outcome to the next.
  res.setHeader('Cache-Control', 'no-store')
  return res.status(HTTP[result.status]).json(result)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    // Not routed through send(): `error` maps to 500, and a wrong method is a 405.
    // Returning 500 here would page someone for a crawler hitting GET.
    res.setHeader('Allow', 'POST')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  if (!originAllowed(req)) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(403).json({ status: 'error', message: 'Forbidden' })
  }

  const raw: unknown = req.body ?? {}
  if (!isPlainObject(raw)) {
    return send(res, { status: 'invalid', fieldErrors: { email: 'Please try again' } })
  }
  const body = raw as Partial<SubscribeRequest>

  // Bot traps. Both look like ordinary validation failures from the outside so a scripted
  // client learns nothing about why it was rejected.
  const honeypotFilled = typeof body.company === 'string' && body.company.trim().length > 0
  const tooFast = typeof body.elapsedMs === 'number' && body.elapsedMs < 2000
  if (honeypotFilled || tooFast) {
    return send(res, { status: 'invalid', fieldErrors: { email: 'Please try again' } })
  }

  const validation = validateSubscribe(body)
  if (!validation.ok) {
    return send(res, { status: 'invalid', fieldErrors: validation.fieldErrors })
  }

  const result = await subscribeToBrevo(validation.normalized)
  if (!result.synced) {
    // Reported as a real failure, NOT swallowed the way api/signup.ts swallows its Brevo
    // sync. There it has a committed row to fall back on; here Brevo is the only write, so
    // a success message would be a lie and the address would be gone. The form keeps what
    // was typed and the visitor can retry.
    console.error('[subscribe] not synced:', result.reason)
    return send(res, {
      status: 'error',
      message: 'Could not add you to the list. Please try again.',
    })
  }

  return send(res, { status: 'subscribed' })
}
