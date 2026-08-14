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

export type SignupResponse =
  | { status: 'created'; id: string; slot: number; remaining: number | null; eventId: string }
  | { status: 'already_registered'; id: string; slot: number }
  | { status: 'full'; capacity: number }
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
 */
type ServerFieldErrors = Record<string, string | undefined>

function toClientErrors(raw: ServerFieldErrors): FieldErrors {
  const { dob, ...rest } = raw
  const mapped: FieldErrors = { ...(rest as FieldErrors) }
  if (dob) mapped.dobYear = dob
  return mapped
}

export type ListStatusResponse = {
  ticketType: TicketType
  phase: 'before' | 'open' | 'closed' | 'full'
  remaining: number | null
  capacity: number | null
  opensAt: string
  closesAt: string
}

export type SubmitExtras = {
  eventId: string
  consentText: string
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
        ageConfirmed: values.ageConfirmed,
        privacyAccepted: values.privacyAccepted,
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
