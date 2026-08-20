export type TicketType =
  | 'presale-guestlist'
  | 'mailing-list'
  | 'early-access'
  | 'general-onsale'
  | 'table-service'

export const TICKET_TYPES: readonly TicketType[] = [
  'presale-guestlist',
  'mailing-list',
  'early-access',
  'general-onsale',
  'table-service',
]

export function isTicketType(value: unknown): value is TicketType {
  return typeof value === 'string' && (TICKET_TYPES as readonly string[]).includes(value)
}

/** Raw request body for POST /api/signup. Every field is untrusted. */
export type SignupRequest = {
  ticketType: string
  firstName: string
  lastName: string
  email: string
  phone: string
  dob: string
  ageConfirmed: boolean
  privacyAccepted: boolean
  consentOptIn: boolean
  consentText?: string | null
  privacyText?: string | null
  eventId?: string | null
  /** Bot trap — a real user never fills this. */
  company?: string | null
  /** Milliseconds between form mount and submit. */
  elapsedMs?: number | null
  attribution?: {
    fbclid?: string | null
    fbp?: string | null
    fbc?: string | null
    utmSource?: string | null
    utmMedium?: string | null
    utmCampaign?: string | null
  } | null
}

/** Field-level errors, keyed by the client's field names. */
export type FieldErrors = Partial<
  Record<
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'phone'
    | 'dob'
    | 'ageConfirmed'
    | 'privacyAccepted'
    | 'consentOptIn',
    string
  >
>

/**
 * What claim_signup returns. Server-internal.
 *
 * `id` is here so the handler can patch Brevo/Meta sync state onto the row it just
 * created. It is NOT part of the client contract — see SignupResponse below.
 */
export type ClaimResult =
  | { status: 'created'; id: string }
  | { status: 'already_registered'; id: string }
  | { status: 'full' }
  | { status: 'not_open'; opensAt: string; closesAt: string }
  | { status: 'closed'; opensAt: string; closesAt: string }
  | { status: 'underage'; minAge: number }
  | { status: 'rate_limited' }
  | { status: 'unknown_list' }

/**
 * Every terminal outcome the CLIENT sees, as a discriminated union.
 *
 * `status` is the contract, not the HTTP code. Codes are set for logs and
 * monitoring, but a Vercel platform error returns an HTML body, so the client can
 * never rely on res.ok alone.
 *
 * Deliberately carries no `slot`, no `remaining` and no `capacity`. Those used to ride
 * along here, which meant the size of the guestlist and how much of it was gone were
 * readable from the response body no matter what the page rendered. The build plan
 * forbids publishing that, and a field the browser never needs is the easiest kind to
 * not publish. `id` is dropped for the same reason it is not needed: nothing on the
 * client does anything with a submission's primary key.
 */
export type SignupResult =
  | { status: 'created'; eventId: string }
  | { status: 'already_registered' }
  | { status: 'full' }
  | { status: 'not_open'; opensAt: string; closesAt: string }
  | { status: 'closed'; opensAt: string; closesAt: string }
  | { status: 'underage'; minAge: number }
  | { status: 'rate_limited' }
  | { status: 'unknown_list' }
  | { status: 'invalid'; fieldErrors: FieldErrors }
  | { status: 'error'; message: string }

export type ListPhase = 'before' | 'open' | 'closed' | 'full'

/**
 * What GET /api/list-status returns.
 *
 * `remaining` and `capacity` are gone on purpose. This is an unauthenticated endpoint,
 * so anything in this payload is public — and while they were here, the exact number
 * of guestlist spots left was one curl away regardless of what the page chose to
 * render. Whether the form is open is the only thing a browser needs.
 */
export type ListStatus = {
  ticketType: TicketType
  phase: ListPhase
  opensAt: string
  closesAt: string
}
