import type { TicketType } from '../config/event'
import { getAttributionData } from './attribution'
import type { FieldErrors, SignupValues } from './validate'

/**
 * Client for /api/signup and /api/list-status.
 *
 * Neither function throws or rejects. Transport failures, HTML error pages from the
 * platform, and malformed JSON all collapse into a terminal `{ status: 'error' }` so
 * callers only ever handle the discriminated union.
 */

/**
 * Mirrors SignupResult in api/_lib/types.ts.
 *
 * Carries no slot number, no remaining count and no capacity: the server stopped
 * sending them, because an unauthenticated response body is public and the build plan
 * forbids publishing guestlist inventory anywhere.
 */
export type SignupResponse =
  | { status: 'created'; eventId: string }
  | { status: 'already_registered' }
  | { status: 'full' }
  | { status: 'not_open'; opensAt: string; closesAt: string }
  | { status: 'closed'; opensAt: string; closesAt: string }
  | { status: 'underage'; minAge: number }
  | { status: 'rate_limited' }
  | { status: 'unknown_list' }
  /** Already translated to client field names — see toClientErrors. */
  | { status: 'invalid'; fieldErrors: FieldErrors }
  | { status: 'error'; message: string }

/**
 * The server names the date-of-birth field `dob`; the form splits it across three
 * selects and keys its error under `dobYear`. Without this translation a server-side
 * DOB rejection would set an error under a key no field reads, and the user would
 * see the form refuse to submit with nothing marked.
 *
 * Same reasoning drives the allow-list: the server can still reject `ageConfirmed`
 * and `privacyAccepted`, which are no longer fields on the form. Those are dropped
 * here rather than passed through as errors nothing can render, which lets the form
 * detect "invalid, but nothing to mark" and say so out loud.
 *
 * `consentOptIn` is on the list precisely because it IS a field — the server requires
 * it now, and a rejection has a checkbox to land on.
 */
type ServerFieldErrors = Record<string, string | undefined>

const RENDERED_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'consentOptIn'] as const

function toClientErrors(raw: ServerFieldErrors): FieldErrors {
  const mapped: FieldErrors = {}
  for (const key of RENDERED_FIELDS) {
    if (raw[key]) mapped[key] = raw[key]
  }
  if (raw.dob) mapped.dobYear = raw.dob
  return mapped
}

export type ListStatusResponse = {
  ticketType: TicketType
  phase: 'before' | 'open' | 'closed' | 'full'
  opensAt: string
  closesAt: string
}

export type SubmitExtras = {
  eventId: string
  consentText: string
  /**
   * The privacy notice and any disclosure shown alongside it, exactly as rendered.
   * Stored verbatim in submissions.privacy_text — wording changes are not retroactive,
   * which is the point of sending the string rather than a flag.
   */
  privacyText: string
  /** Honeypot value — a real user leaves this empty. */
  company: string
  elapsedMs: number
}

export async function submitSignup(
  ticketType: TicketType,
  values: SignupValues,
  dob: string,
  extras: SubmitExtras,
): Promise<SignupResponse> {
  const attribution = getAttributionData()

  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketType,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        dob,

        /*
         * Two attestations the form no longer asks for as checkboxes, per the build
         * plan's form spec — the opt-in is the only box on the page.
         *
         * ageConfirmed: the birthdate IS the attestation now, and a stronger one than
         *   a tick. This request is only ever built after `dob` has cleared the 19+
         *   gate against the door date, so `true` here is a statement about what the
         *   user actually supplied, not a box we ticked on their behalf.
         *
         * privacyAccepted: the notice sits immediately above the submit button and
         *   reads "By signing up you agree to our Privacy Policy". Pressing submit IS
         *   the agreement, and `privacyText` records the exact sentence they saw.
         *
         * Neither is a gate. Both real gates are unchanged and both are server-side:
         * claim_signup recomputes age against the list's own door_date, and it is the
         * only thing that can enforce it.
         */
        ageConfirmed: true,
        privacyAccepted: true,

        consentOptIn: values.consentOptIn,
        consentText: values.consentOptIn ? extras.consentText : null,
        privacyText: extras.privacyText,
        eventId: extras.eventId,
        company: extras.company,
        elapsedMs: extras.elapsedMs,
        attribution,
      }),
    })

    // Deliberately not branching on res.ok: a platform-level error returns an HTML
    // body, so res.json() is what actually fails, and the catch below owns it.
    const parsed = (await res.json()) as SignupResponse
    if (parsed.status === 'invalid') {
      return {
        status: 'invalid',
        fieldErrors: toClientErrors(parsed.fieldErrors as ServerFieldErrors),
      }
    }
    return parsed
  } catch {
    return {
      status: 'error',
      message: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

/** Returns null when the status can't be read; callers fall back to config. */
export async function fetchListStatus(
  ticketType: TicketType,
): Promise<ListStatusResponse | null> {
  try {
    const res = await fetch(`/api/list-status?ticketType=${encodeURIComponent(ticketType)}`)
    if (!res.ok) return null
    return (await res.json()) as ListStatusResponse
  } catch {
    return null
  }
}
