import { createHash } from 'node:crypto'

/**
 * SHA-256 helpers.
 *
 * Meta requires customer information parameters to be hashed with SHA-256 and
 * normalized first — lowercased and trimmed, digits-only for phone, YYYYMMDD for
 * date of birth. Normalizing after hashing (or not at all) produces a valid-looking
 * hash that simply never matches anyone, so the match rate quietly drops to zero.
 */

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function hashEmail(email: string): string {
  return sha256(email.trim().toLowerCase())
}

/** Digits only, with a country code. 10 digits is assumed North American. */
export function hashPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.length === 10 ? `1${digits}` : digits
  return sha256(withCountry)
}

export function hashName(name: string): string {
  return sha256(name.trim().toLowerCase())
}

/** Meta wants `db` as YYYYMMDD with no separators. */
export function hashDob(isoDate: string): string {
  return sha256(isoDate.replace(/-/g, ''))
}

/**
 * Salted so the stored value can't be reversed by hashing the ~4 billion IPv4
 * addresses. Rotating the salt resets everyone's rate-limit window.
 */
export function hashIp(ip: string, salt: string): string {
  return sha256(`${salt}:${ip}`)
}

/**
 * The salt to hash client IPs with. Never returns nothing.
 *
 * This used to be `optionalEnv('IP_HASH_SALT')`, and when that came back undefined the
 * handler stored no ip_hash — which meant the per-IP rate limit inside claim_signup
 * had nothing to match on and silently did nothing. An anti-abuse layer that looks
 * active and isn't is worse than not having one, and "someone forgot a dashboard
 * variable" is exactly how it happens.
 *
 * The fallback derives a salt from the service-role key: already required for the app
 * to function at all, already secret, and only ever used here as a one-way input. It
 * is genuinely second best — rotating that key silently resets every rate-limit window
 * — so set IP_HASH_SALT and keep it stable. But the limiter stays on either way.
 *
 * Both branches fail closed rather than open: there is no path through this that
 * returns an empty salt.
 */
export function resolveIpSalt(
  configured: string | undefined,
  serviceRoleKey: string,
): { salt: string; derived: boolean } {
  if (configured) return { salt: configured, derived: false }
  return { salt: sha256(`ip-hash-fallback:${serviceRoleKey}`), derived: true }
}
