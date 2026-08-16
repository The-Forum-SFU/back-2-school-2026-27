/**
 * Client-side validation, for instant feedback before a round trip.
 *
 * TWIN FILE: api/_lib/validate.ts is the authoritative copy. Keep the two in sync by
 * hand — they are deliberately duplicated rather than shared, because sharing would
 * need either a third TS project that /api imports across (defeating the project
 * separation that makes /api typecheck at all) or a runtime dep like zod in both
 * bundles. For ~80 lines of trim-and-regex that trade is not worth it.
 *
 * The one thing this does that the server twin does NOT is the age check — the client
 * knows door_date from config, so it can surface "you must be 19" before submit. The
 * server's own gate lives in claim_signup, which owns the real door_date.
 *
 * There is deliberately no `ageConfirmed` or `privacyAccepted` here. The form has one
 * checkbox, the marketing opt-in, and that one IS required. The birthdate carries the
 * age attestation and the privacy notice above the submit button is passive, so
 * neither of those has a value to collect or a rule to enforce on this side. See
 * src/lib/signupApi.ts for what those two become in the request.
 */

export type SignupValues = {
  firstName: string
  lastName: string
  email: string
  phone: string
  dobYear: string
  dobMonth: string
  dobDay: string
  consentOptIn: boolean
}

export type FieldName = keyof SignupValues
export type FieldErrors = Partial<Record<FieldName, string>>

export type ValidationResult =
  | { ok: true; dob: string }
  | { ok: false; fieldErrors: FieldErrors }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NAME_MAX = 80
const EMAIL_MAX = 254

/**
 * sfu.ca and every subdomain of it. Anchored at both ends so `@notsfu.ca` and
 * `@sfu.ca.example.com` are ordinary addresses, not collateral.
 */
const SFU_EMAIL_RE = /@(?:[a-z0-9-]+\.)*sfu\.ca$/i

/**
 * Refusing a whole domain is a real cost, and it is worth it: SFU's filters quarantine
 * bulk mail, so the confirmation and the door instructions do not arrive and the person
 * finds out at the door. Better to lose the address than the guest.
 *
 * MUST match the server twin's copy exactly — this is product-specified wording, unlike
 * the other messages in this file, which are allowed to differ between the two.
 */
export const SFU_EMAIL_ERROR =
  'SFU addresses filter our emails and you will miss your confirmation. Please use a personal address.'

export const EMPTY_VALUES: SignupValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dobYear: '',
  dobMonth: '',
  dobDay: '',
  consentOptIn: false,
}

export function isRealDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return false
  const [, y, m, d] = match.map(Number) as [string, number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  )
}

/** Whole years old on `asOf`. */
export function ageOn(dobIso: string, asOfIso: string): number {
  const dob = new Date(`${dobIso}T00:00:00Z`)
  const asOf = new Date(`${asOfIso}T00:00:00Z`)
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear()
  const monthDelta = asOf.getUTCMonth() - dob.getUTCMonth()
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getUTCDate() < dob.getUTCDate())) age -= 1
  return age
}

function pad(value: string): string {
  return value.padStart(2, '0')
}

export function composeDob(v: SignupValues): string {
  if (!v.dobYear || !v.dobMonth || !v.dobDay) return ''
  return `${v.dobYear}-${pad(v.dobMonth)}-${pad(v.dobDay)}`
}

export function validateSignup(
  v: SignupValues,
  opts: { minAge: number; doorDate: string },
): ValidationResult {
  const fieldErrors: FieldErrors = {}

  const firstName = v.firstName.trim()
  const lastName = v.lastName.trim()
  const email = v.email.trim().toLowerCase()
  const phoneDigits = v.phone.replace(/\D/g, '')

  if (!firstName) fieldErrors.firstName = 'Required'
  else if (firstName.length > NAME_MAX) fieldErrors.firstName = 'Too long'

  if (!lastName) fieldErrors.lastName = 'Required'
  else if (lastName.length > NAME_MAX) fieldErrors.lastName = 'Too long'

  if (!email) fieldErrors.email = 'Required'
  else if (email.length > EMAIL_MAX || !EMAIL_RE.test(email))
    fieldErrors.email = 'Enter a valid email address'
  // Ordered after the shape check so a typo'd SFU address is reported as a typo.
  else if (SFU_EMAIL_RE.test(email)) fieldErrors.email = SFU_EMAIL_ERROR

  if (!v.phone.trim()) fieldErrors.phone = 'Required'
  else if (phoneDigits.length < 10 || phoneDigits.length > 15)
    fieldErrors.phone = 'Enter a valid phone number'

  const dob = composeDob(v)
  if (!dob) {
    fieldErrors.dobYear = 'Enter your full date of birth'
  } else if (!isRealDate(dob)) {
    fieldErrors.dobYear = 'That date does not exist'
  } else if (ageOn(dob, opts.doorDate) < opts.minAge) {
    // Age is checked at the DOOR date, not today — someone turning 19 between now
    // and the event is eligible, and rejecting them would silently cost signups.
    fieldErrors.dobYear = `You must be ${opts.minAge} or older on the night of the event`
  }

  // Required, and re-checked server-side in api/_lib/validate.ts — this half only
  // saves a round trip. Worded as an instruction rather than "Required" because the
  // box is the one field where the fix isn't "type something".
  if (!v.consentOptIn) fieldErrors.consentOptIn = 'Tick this box to join the list'

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors }
  return { ok: true, dob }
}
