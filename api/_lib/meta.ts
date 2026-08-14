import { optionalEnv } from './env'
import { hashDob, hashEmail, hashName, hashPhone } from './hash'

/**
 * Meta Conversions API — server-side `Lead`.
 *
 * Never throws, and returns `{ sent: false, reason: 'not_configured' }` when the env
 * vars are absent. That is the state this ships in: there is no pixel on the site and
 * no META_PIXEL_ID yet, and the signup flow has to work anyway.
 *
 * Dedup contract: `eventId` must be the SAME id the browser pixel fires with for this
 * conversion, and both sides fire only on a `created` result. See src/lib/metaPixel.ts.
 */

// Verify against current Graph API docs when touching this — a stale version string
// is a silent 400, not an obvious failure.
const GRAPH_VERSION = 'v23.0'

export type MetaLeadInput = {
  eventId: string
  eventSourceUrl: string
  email: string
  phone: string
  firstName: string
  lastName: string
  dob: string
  clientIp?: string
  userAgent?: string
  fbp?: string
  fbc?: string
}

export type MetaResult = { sent: boolean; reason?: string }

export async function sendLeadEvent(input: MetaLeadInput): Promise<MetaResult> {
  try {
    const token = optionalEnv('META_ACCESS_TOKEN')
    // For Lead events the CAPI "dataset id" is the same number as the pixel id.
    const dataset = optionalEnv('META_PIXEL_ID')
    if (!token || !dataset) return { sent: false, reason: 'not_configured' }

    const userData: Record<string, unknown> = {
      em: [hashEmail(input.email)],
      ph: [hashPhone(input.phone)],
      fn: [hashName(input.firstName)],
      ln: [hashName(input.lastName)],
      db: [hashDob(input.dob)],
    }
    // These three are sent UNhashed by design — Meta matches on them directly.
    if (input.clientIp) userData.client_ip_address = input.clientIp
    if (input.userAgent) userData.client_user_agent = input.userAgent
    if (input.fbp) userData.fbp = input.fbp
    if (input.fbc) userData.fbc = input.fbc

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${dataset}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            {
              event_name: 'Lead',
              event_time: Math.floor(Date.now() / 1000),
              event_id: input.eventId,
              action_source: 'website',
              event_source_url: input.eventSourceUrl,
              user_data: userData,
            },
          ],
        }),
        signal: AbortSignal.timeout(2500),
      },
    )

    if (!res.ok) {
      console.error('[meta] CAPI failed:', res.status, await res.text())
      return { sent: false, reason: `http_${res.status}` }
    }
    return { sent: true }
  } catch (err) {
    console.error('[meta] CAPI threw (non-fatal):', String(err))
    return { sent: false, reason: 'exception' }
  }
}

/**
 * Meta's documented fallback format when the `_fbc` cookie is absent but the landing
 * URL carried an fbclid: fb.1.{timestamp}.{fbclid}.
 */
export function buildFbc(fbclid: string): string {
  return `fb.1.${Date.now()}.${fbclid}`
}
