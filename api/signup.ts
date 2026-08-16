import type { VercelRequest, VercelResponse } from '@vercel/node'
import { syncToBrevo } from './_lib/brevo.js'
import { optionalEnv, requireEnv } from './_lib/env.js'
import { hashIp, resolveIpSalt } from './_lib/hash.js'
import { buildFbc, sendLeadEvent } from './_lib/meta.js'
import { patchSubmission, rpc } from './_lib/supabase.js'
import { isTicketType, type ClaimResult, type SignupRequest, type SignupResult } from './_lib/types.js'
import {
  ATTRIBUTION_VALUE_MAX,
  clampText,
  EVENT_ID_MAX,
  RECORDED_TEXT_MAX,
  validateSignup,
} from './_lib/validate.js'

/**
 * POST /api/signup — the only write path for signups.
 *
 * Order matters:
 *   1. transport guards        (method, origin, body shape — no work, no DB)
 *   2. validate shape          (cheap, no DB round trip)
 *   3. claim_signup RPC        (atomic: dedup, window, age, rate limit, capacity, insert)
 *   4. side effects            (only on `created`, and never able to fail the response)
 *
 * The row is committed by the time step 4 runs, so a Brevo or Meta failure leaves
 * `brevo_synced = false` — a backfill queue, not a lost signup.
 *
 * Nothing this returns is countable. `claim_signup` hands back an id so the sync-state
 * patch below can find the row; `toClientResult` strips it, along with every other
 * field the browser has no use for. See the inventory rule in
 * supabase/migrations/0002_reconcile_and_harden.sql.
 */

/** Maps a terminal result onto an HTTP code. `status` in the body is the real contract. */
const HTTP: Record<SignupResult['status'], number> = {
  created: 201,
  already_registered: 200,
  full: 409,
  not_open: 403,
  closed: 403,
  underage: 403,
  rate_limited: 429,
  unknown_list: 400,
  invalid: 400,
  error: 500,
}

function send(res: VercelResponse, result: SignupResult) {
  // A signup response is per-person and never revalidatable. Without this, a shared
  // CDN or an in-app browser cache can hand one person's outcome to the next.
  res.setHeader('Cache-Control', 'no-store')
  return res.status(HTTP[result.status]).json(result)
}

/** Left-most XFF entry is the client; the rest are proxies. */
function clientIp(req: VercelRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return raw?.split(',')[0]?.trim() || req.socket?.remoteAddress || undefined
}

function readCookie(req: VercelRequest, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

/**
 * Same-origin guard.
 *
 * A JSON POST already needs a CORS preflight, which this endpoint doesn't answer, so a
 * browser on another site can't read the response today. This closes the case where it
 * doesn't have to: a form-encoded or no-preflight variant fired from somewhere else
 * still reaches the handler, and "the attacker can't read the reply" is no comfort
 * when the side effect is the point.
 *
 * A missing Origin is allowed. Non-browser clients omit it entirely, and this endpoint
 * is public by design — the guard is about not being driven BY another origin, not
 * about proving the caller is a browser.
 */
function originAllowed(req: VercelRequest): boolean {
  const raw = req.headers.origin
  const origin = Array.isArray(raw) ? raw[0] : raw
  if (!origin) return true
  const host = req.headers.host
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    // An unparseable Origin is a malformed or hand-built request, not a browser.
    return false
  }
}

/** Drops everything the browser has no use for, which is everything except the status. */
function toClientResult(claim: ClaimResult, eventId: string): SignupResult {
  switch (claim.status) {
    case 'created':
      return { status: 'created', eventId }
    case 'already_registered':
      return { status: 'already_registered' }
    default:
      return claim
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    // Not routed through send(): the `error` status maps to 500, and a wrong method
    // is a 405. Returning 500 here would page someone for a crawler hitting GET.
    res.setHeader('Allow', 'POST')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  if (!originAllowed(req)) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(403).json({ status: 'error', message: 'Forbidden' })
  }

  // A JSON array, string or null all parse into `req.body` without being objects, and
  // every property read below would then be undefined — which reads as "empty form"
  // rather than "malformed request". Reject it as what it is.
  const raw: unknown = req.body ?? {}
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return send(res, { status: 'invalid', fieldErrors: { email: 'Please try again' } })
  }
  const body = raw as Partial<SignupRequest>

  if (!isTicketType(body.ticketType)) {
    return send(res, { status: 'unknown_list' })
  }

  // Bot traps. Both look like ordinary validation failures from the outside so a
  // scripted client learns nothing about why it was rejected.
  const honeypotFilled = typeof body.company === 'string' && body.company.trim().length > 0
  const tooFast = typeof body.elapsedMs === 'number' && body.elapsedMs < 2000
  if (honeypotFilled || tooFast) {
    return send(res, { status: 'invalid', fieldErrors: { email: 'Please try again' } })
  }

  const validation = validateSignup(body)
  if (!validation.ok) {
    return send(res, { status: 'invalid', fieldErrors: validation.fieldErrors })
  }
  const { firstName, lastName, email, phone, dob } = validation.normalized

  const consentOptIn = body.consentOptIn === true
  const attribution = body.attribution ?? {}
  const ip = clientIp(req)

  // Never optional. See resolveIpSalt — the previous version stored no ip_hash when
  // IP_HASH_SALT was unset, which turned the per-IP limit in claim_signup into a no-op
  // that still looked like it was running.
  const { salt, derived } = resolveIpSalt(
    optionalEnv('IP_HASH_SALT'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )
  if (derived) {
    console.warn(
      '[signup] IP_HASH_SALT is not set — rate limiting is ACTIVE on a salt derived ' +
        'from the service-role key. Set IP_HASH_SALT in .env and in the Vercel ' +
        'dashboard; rotating the service key would otherwise reset every window.',
    )
  }

  // Generated here if the client didn't supply one, so the column is never null.
  // The response echoes it back and the pixel fires with that exact value.
  const eventId = clampText(body.eventId, EVENT_ID_MAX) ?? `lead_${crypto.randomUUID()}`

  let claim: ClaimResult
  try {
    claim = await rpc<ClaimResult>('claim_signup', {
      p_ticket_type: body.ticketType,
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email,
      p_phone: phone,
      p_dob: dob,
      p_age_confirmed: body.ageConfirmed === true,
      p_consent_opt_in: consentOptIn,
      p_privacy_accepted: body.privacyAccepted === true,
      // Truncated, not trusted. These are the wording the user was shown, which only
      // the client knows, so they can't be reconstructed here — but they can be kept
      // to a size that matches what they claim to be.
      p_consent_text: clampText(body.consentText, RECORDED_TEXT_MAX) ?? null,
      p_privacy_text: clampText(body.privacyText, RECORDED_TEXT_MAX) ?? null,
      p_attribution: {
        fbclid: clampText(attribution.fbclid, ATTRIBUTION_VALUE_MAX) ?? null,
        fbp: clampText(attribution.fbp, ATTRIBUTION_VALUE_MAX) ?? null,
        utmSource: clampText(attribution.utmSource, ATTRIBUTION_VALUE_MAX) ?? null,
        utmMedium: clampText(attribution.utmMedium, ATTRIBUTION_VALUE_MAX) ?? null,
        utmCampaign: clampText(attribution.utmCampaign, ATTRIBUTION_VALUE_MAX) ?? null,
      },
      p_ip_hash: ip ? hashIp(ip, salt) : null,
      p_user_agent: clampText(req.headers['user-agent'], ATTRIBUTION_VALUE_MAX) ?? null,
      p_event_id: eventId,
    })
  } catch (err) {
    console.error('[signup] claim_signup failed:', String(err))
    return send(res, { status: 'error', message: 'Could not process signup' })
  }

  // Anything other than a fresh row is terminal: no side effects, no duplicate Lead.
  if (claim.status !== 'created') return send(res, toClientResult(claim, eventId))

  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https'
  const host = req.headers.host ?? ''
  const fbc =
    readCookie(req, '_fbc') ??
    (attribution.fbc || (attribution.fbclid ? buildFbc(attribution.fbclid) : undefined))

  // Awaited, not fire-and-forget: on Vercel's Node runtime, work scheduled after the
  // response is not guaranteed to run. Both calls are individually capped at 2.5s and
  // neither can throw, so the worst case is a ~2.5s response with the row safely saved.
  const [brevo, meta] = await Promise.all([
    syncToBrevo({
      firstName,
      lastName,
      email,
      phone,
      dob,
      ticketType: body.ticketType,
      consentOptIn,
    }),
    sendLeadEvent({
      eventId,
      eventSourceUrl: `${proto}://${host}/`,
      email,
      phone,
      firstName,
      lastName,
      dob,
      clientIp: ip,
      userAgent: req.headers['user-agent'],
      fbp: readCookie(req, '_fbp') ?? attribution.fbp ?? undefined,
      fbc: fbc ?? undefined,
    }),
  ])

  await patchSubmission(claim.id, {
    brevo_synced: brevo.synced,
    brevo_contact_id: brevo.contactId ?? null,
    meta_sent: meta.sent,
  })

  return send(res, toClientResult(claim, eventId))
}
