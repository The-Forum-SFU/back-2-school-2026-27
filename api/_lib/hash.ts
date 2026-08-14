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
 * addresses. Rotating IP_HASH_SALT resets everyone's rate-limit window.
 */
export function hashIp(ip: string, salt: string): string {
  return sha256(`${salt}:${ip}`)
}
