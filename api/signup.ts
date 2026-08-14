import type { VercelRequest, VercelResponse } from '@vercel/node'
import { syncToBrevo } from './_lib/brevo'
import { optionalEnv } from './_lib/env'
import { hashIp } from './_lib/hash'
import { buildFbc, sendLeadEvent } from './_lib/meta'
import { patchSubmission, rpc } from './_lib/supabase'
import { isTicketType, type SignupRequest, type SignupResult } from './_lib/types'
import { validateSignup } from './_lib/validate'

/**
 * POST /api/signup — the only write path for signups.
 *
 * Order matters:
 *   1. validate shape          (cheap, no DB round trip)
 *   2. claim_signup RPC        (atomic: dedup, window, age, rate limit, capacity, insert)
 *   3. side effects            (only on `created`, and never able to fail the response)
 *
 * The row is committed by the time step 3 runs, so a Brevo or Meta failure leaves
 * `brevo_synced = false` — a backfill queue, not a lost signup.
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    // Not routed through send(): the `error` status maps to 500, and a wrong method
    // is a 405. Returning 500 here would page someone for a crawler hitting GET.
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  const body = (req.body ?? {}) as Partial<SignupRequest>

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
  const salt = optionalEnv('IP_HASH_SALT')

  // Without a salt we can't store an ip_hash, and the per-IP rate limit in
  // claim_signup has nothing to match on — so it silently does nothing. Say so
  // rather than letting the anti-abuse layer look active when it isn't.
  if (!salt) {
    console.warn(
      '[signup] IP_HASH_SALT is not set — per-IP rate limiting is DISABLED. ' +
        'Set it in .env and in the Vercel dashboard.',
    )
  }

  // Generated here if the client didn't supply one, so the column is never null.
  // The response echoes it back and the pixel fires with that exact value.
  const eventId = body.eventId?.trim() || `lead_${crypto.randomUUID()}`

  let result: SignupResult
  try {
    result = await rpc<SignupResult>('claim_signup', {
      p_ticket_type: body.ticketType,
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email,
      p_phone: phone,
      p_dob: dob,
      p_age_confirmed: body.ageConfirmed === true,
      p_consent_opt_in: consentOptIn,
      p_privacy_accepted: body.privacyAccepted === true,
      p_consent_text: body.consentText ?? null,
      p_privacy_text: body.privacyText ?? null,
      p_attribution: {
        fbclid: attribution.fbclid ?? null,
        fbp: attribution.fbp ?? null,
        utmSource: attribution.utmSource ?? null,
        utmMedium: attribution.utmMedium ?? null,
        utmCampaign: attribution.utmCampaign ?? null,
      },
      p_ip_hash: ip && salt ? hashIp(ip, salt) : null,
      p_user_agent: req.headers['user-agent'] ?? null,
      p_event_id: eventId,
    })
  } catch (err) {
    console.error('[signup] claim_signup failed:', String(err))
    return send(res, { status: 'error', message: 'Could not process signup' })
  }

  // Anything other than a fresh row is terminal: no side effects, no duplicate Lead.
  if (result.status !== 'created') return send(res, result)

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

  await patchSubmission(result.id, {
    brevo_synced: brevo.synced,
    brevo_contact_id: brevo.contactId ?? null,
    meta_sent: meta.sent,
  })

  return send(res, { ...result, eventId })
}
