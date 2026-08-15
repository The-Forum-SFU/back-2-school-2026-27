import { describe, expect, it } from 'vitest'
import {
  hashDob,
  hashEmail,
  hashIp,
  hashName,
  hashPhone,
  resolveIpSalt,
  sha256,
} from '../../api/_lib/hash'

/**
 * Two separate concerns live in this file.
 *
 * Meta's hashes must be NORMALISED before hashing or the match rate silently drops to
 * zero — a wrongly-normalised hash is still a valid-looking hash, so nothing errors and
 * nobody notices. Those tests pin the normalisation, not the algorithm.
 *
 * The IP salt is an anti-abuse control. Its tests are about what must never happen:
 * an empty salt, a salt that is the service-role key, or a hash that survives a salt
 * rotation.
 */

const HEX_64 = /^[0-9a-f]{64}$/

describe('sha256', () => {
  it('matches the known digest for the empty string', () => {
    expect(sha256('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('is stable and hex-encoded', () => {
    expect(sha256('rewind')).toBe(sha256('rewind'))
    expect(sha256('rewind')).toMatch(HEX_64)
  })
})

describe('Meta normalisation', () => {
  it('lowercases and trims email before hashing', () => {
    const canonical = hashEmail('jordan@example.com')
    expect(hashEmail('  JORDAN@Example.COM  ')).toBe(canonical)
    expect(hashEmail('jordan@example.co')).not.toBe(canonical)
  })

  it('reduces a phone to digits with a country code', () => {
    const canonical = hashPhone('+16045550123')
    expect(hashPhone('(604) 555-0123')).toBe(canonical)
    expect(hashPhone('604.555.0123')).toBe(canonical)
    expect(hashPhone('6045550123')).toBe(canonical)
  })

  it('lowercases and trims names', () => {
    expect(hashName('  Jordan ')).toBe(hashName('jordan'))
    expect(hashName('NGUYEN')).toBe(hashName('nguyen'))
  })

  it('strips separators from the date of birth, as Meta wants YYYYMMDD', () => {
    expect(hashDob('2004-04-12')).toBe(sha256('20040412'))
  })
})

describe('hashIp', () => {
  it('never returns the raw address and is stable for the same salt', () => {
    const hash = hashIp('203.0.113.7', 'pepper')
    expect(hash).toMatch(HEX_64)
    expect(hash).not.toContain('203.0.113.7')
    expect(hashIp('203.0.113.7', 'pepper')).toBe(hash)
  })

  it('changes completely when the salt rotates, which is what resets rate-limit windows', () => {
    expect(hashIp('203.0.113.7', 'pepper-a')).not.toBe(hashIp('203.0.113.7', 'pepper-b'))
  })

  it('separates the salt from the address so two inputs cannot collide by concatenation', () => {
    // Without a delimiter, ('ab', 'c') and ('a', 'bc') would hash identically.
    expect(hashIp('c', 'ab')).not.toBe(hashIp('bc', 'a'))
  })
})

describe('resolveIpSalt', () => {
  const KEY = 'service-role-key-value'

  it('uses the configured salt when there is one', () => {
    expect(resolveIpSalt('configured-pepper', KEY)).toEqual({
      salt: 'configured-pepper',
      derived: false,
    })
  })

  it('derives a salt rather than returning nothing when IP_HASH_SALT is unset', () => {
    // The whole point: the previous behaviour was to skip storing ip_hash, which turned
    // the per-IP limit in claim_signup into a no-op that still looked active.
    for (const missing of [undefined, '']) {
      const result = resolveIpSalt(missing, KEY)
      expect(result.derived).toBe(true)
      expect(result.salt).toMatch(HEX_64)
    }
  })

  it('never leaks the service-role key it derives from', () => {
    const { salt } = resolveIpSalt(undefined, KEY)
    expect(salt).not.toContain(KEY)
    expect(salt).not.toBe(sha256(KEY))
  })

  it('derives a different salt per key, so two projects never share a window', () => {
    expect(resolveIpSalt(undefined, 'key-a').salt).not.toBe(
      resolveIpSalt(undefined, 'key-b').salt,
    )
  })

  it('is deterministic, so a window survives a cold start', () => {
    expect(resolveIpSalt(undefined, KEY).salt).toBe(resolveIpSalt(undefined, KEY).salt)
  })
})
