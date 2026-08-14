export type TicketType =
  | 'presale-guestlist'
  | 'early-access'
  | 'general-onsale'
  | 'table-service'

export const TICKET_TYPES: readonly TicketType[] = [
  'presale-guestlist',
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
 * Every terminal outcome, as a discriminated union.
 *
 * `status` is the contract, not the HTTP code. Codes are set for logs and
 * monitoring, but a Vercel platform error returns an HTML body, so the client can
 * never rely on res.ok alone.
 */
export type SignupResult =
  | { status: 'created'; id: string; slot: number; remaining: number | null; eventId: string }
  | { status: 'already_registered'; id: string; slot: number }
  | { status: 'full'; capacity: number }
  | { status: 'not_open'; opensAt: string; closesAt: string }
  | { status: 'closed'; opensAt: string; closesAt: string }
  | { status: 'underage'; minAge: number }
  | { status: 'rate_limited' }
  | { status: 'unknown_list' }
  | { status: 'invalid'; fieldErrors: FieldErrors }
  | { status: 'error'; message: string }

export type ListPhase = 'before' | 'open' | 'closed' | 'full'

export type ListStatus = {
  ticketType: TicketType
  phase: ListPhase
  remaining: number | null
  capacity: number | null
  opensAt: string
  closesAt: string
}
