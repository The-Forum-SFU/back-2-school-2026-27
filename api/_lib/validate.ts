import type { FieldErrors, SignupRequest } from './types'

/**
 * Server-side validation. **Authoritative.**
 *
 * TWIN FILE: src/lib/validate.ts mirrors this for instant client feedback. Keep the
 * two in sync by hand — they are deliberately duplicated rather than shared, because
 * sharing would need either a third TS project that /api imports across (defeating
 * the project separation that makes /api typecheck at all) or a runtime dep like zod
 * in both bundles. For ~80 lines of trim-and-regex that trade is not worth it.
 *
 * The age gate is NOT here: it belongs to claim_signup, which is the only thing that
 * knows each list's door_date. This validates shape and plausibility only.
 */

/** Pragmatic, not RFC 5322 — a full-spec regex rejects addresses that work fine. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NAME_MAX = 80
const EMAIL_MAX = 254

export type NormalizedSignup = {
  firstName: string
  lastName: string
  email: string
  /** E.164, e.g. +16045550123. */
  phone: string
  dob: string
}

export type ValidationResult =
  | { ok: true; normalized: NormalizedSignup }
  | { ok: false; fieldErrors: FieldErrors }

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Digits, then a country code. A bare 10-digit number is assumed North American —
 * correct for an SFU audience, wrong for an international signup, which would be
 * silently stored as a valid-looking but incorrect +1 number.
 */
export function toE164(raw: string): string | null {
  const trimmed = raw.trim()
  const hasPlus = trimmed.startsWith('+')
  let digits = trimmed.replace(/\D/g, '')

  if (!hasPlus) {
    if (digits.length === 10) digits = `1${digits}`
    else if (digits.startsWith('00')) digits = digits.slice(2)
  }
  if (digits.length < 11 || digits.length > 15) return null
  return `+${digits}`
}

/** Rejects impossible calendar dates (Feb 31) that a naive Date() would roll over. */
export function isRealDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return false
  const [, y, m, d] = match.map(Number) as [string, number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  )
}

/** Whole years old on `asOf`. Used by the client; the server defers to the RPC. */
export function ageOn(dobIso: string, asOfIso: string): number {
  const dob = new Date(`${dobIso}T00:00:00Z`)
  const asOf = new Date(`${asOfIso}T00:00:00Z`)
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear()
  const monthDelta = asOf.getUTCMonth() - dob.getUTCMonth()
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getUTCDate() < dob.getUTCDate())) age -= 1
  return age
}

export function validateSignup(body: Partial<SignupRequest>): ValidationResult {
  const fieldErrors: FieldErrors = {}

  const firstName = str(body.firstName)
  const lastName = str(body.lastName)
  const email = str(body.email).toLowerCase()
  const phoneRaw = str(body.phone)
  const dob = str(body.dob)

  if (!firstName) fieldErrors.firstName = 'Required'
  else if (firstName.length > NAME_MAX) fieldErrors.firstName = 'Too long'

  if (!lastName) fieldErrors.lastName = 'Required'
  else if (lastName.length > NAME_MAX) fieldErrors.lastName = 'Too long'

  if (!email) fieldErrors.email = 'Required'
  else if (email.length > EMAIL_MAX || !EMAIL_RE.test(email))
    fieldErrors.email = 'Enter a valid email address'

  const phone = toE164(phoneRaw)
  if (!phoneRaw) fieldErrors.phone = 'Required'
  else if (!phone) fieldErrors.phone = 'Enter a valid phone number'

  if (!dob) fieldErrors.dob = 'Required'
  else if (!isRealDate(dob)) fieldErrors.dob = 'Enter a valid date'
  else {
    const year = Number(dob.slice(0, 4))
    const thisYear = new Date().getUTCFullYear()
    if (year < 1920 || year > thisYear) fieldErrors.dob = 'Enter a valid date'
  }

  // Both required boxes are re-checked here because a hand-rolled POST can send
  // anything. What we store is the attestation; the actual age gate is the
  // server-computed age_at_event in claim_signup.
  if (body.ageConfirmed !== true) fieldErrors.ageConfirmed = 'Required'
  if (body.privacyAccepted !== true) fieldErrors.privacyAccepted = 'Required'
  // consentOptIn is deliberately NOT required — under CASL consent must be freely
  // given and cannot be a condition of signing up.

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors }

  return {
    ok: true,
    normalized: { firstName, lastName, email, phone: phone as string, dob },
  }
}
