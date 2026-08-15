import { describe, expect, it } from 'vitest'
import {
  ATTRIBUTION_VALUE_MAX,
  ageOn,
  clampText,
  EVENT_ID_MAX,
  isRealDate,
  RECORDED_TEXT_MAX,
  toE164,
  validateSignup,
} from '../../api/_lib/validate'
import type { SignupRequest } from '../../api/_lib/types'

/**
 * The AUTHORITATIVE validator. Everything the client checks, the server rechecks here,
 * because a hand-rolled POST never runs any of the client's code.
 */

/** A body that passes, so each test can break exactly one thing. */
function validBody(overrides: Partial<SignupRequest> = {}): Partial<SignupRequest> {
  return {
    ticketType: 'presale-guestlist',
    firstName: 'Jordan',
    lastName: 'Nguyen',
    email: 'jordan@example.com',
    phone: '604 555 0123',
    dob: '2004-04-12',
    ageConfirmed: true,
    privacyAccepted: true,
    consentOptIn: false,
    ...overrides,
  }
}

describe('toE164', () => {
  it('assumes North America for a bare 10-digit number', () => {
    expect(toE164('6045550123')).toBe('+16045550123')
    expect(toE164('(604) 555-0123')).toBe('+16045550123')
    expect(toE164(' 604.555.0123 ')).toBe('+16045550123')
  })

  it('keeps an explicit country code', () => {
    expect(toE164('+16045550123')).toBe('+16045550123')
    expect(toE164('+44 20 7946 0958')).toBe('+442079460958')
  })

  it('strips a 00 international prefix only when there is no +', () => {
    expect(toE164('00442079460958')).toBe('+442079460958')
    // With a +, the leading zeros are part of what the user typed and are kept, which
    // then fails the length check rather than silently producing a different number.
    expect(toE164('+00442079460958')).toBe('+00442079460958')
  })

  it('rejects anything outside 11 to 15 digits once normalised', () => {
    expect(toE164('123456789')).toBeNull()
    expect(toE164('1234567890123456')).toBeNull()
    expect(toE164('')).toBeNull()
    expect(toE164('not a phone')).toBeNull()
  })
})

describe('isRealDate', () => {
  it('accepts real calendar dates', () => {
    expect(isRealDate('2004-04-12')).toBe(true)
    expect(isRealDate('2004-02-29')).toBe(true) // leap year
  })

  it('rejects dates that roll over rather than existing', () => {
    // The trap this exists for: new Date('2005-02-29') silently becomes March 1.
    expect(isRealDate('2005-02-29')).toBe(false)
    expect(isRealDate('2004-04-31')).toBe(false)
    expect(isRealDate('2004-13-01')).toBe(false)
    expect(isRealDate('2004-00-10')).toBe(false)
  })

  it('rejects anything that is not exactly YYYY-MM-DD', () => {
    expect(isRealDate('2004-4-12')).toBe(false)
    expect(isRealDate('12/04/2004')).toBe(false)
    expect(isRealDate('2004-04-12T00:00:00Z')).toBe(false)
    expect(isRealDate('')).toBe(false)
  })
})

describe('ageOn', () => {
  it('counts whole years at the given date', () => {
    expect(ageOn('2007-09-20', '2026-09-20')).toBe(19) // birthday ON the door date
    expect(ageOn('2007-09-21', '2026-09-20')).toBe(18) // one day short
    expect(ageOn('2007-09-19', '2026-09-20')).toBe(19)
  })

  it('handles a 29 February birthday without drifting', () => {
    expect(ageOn('2004-02-29', '2026-02-28')).toBe(21)
    expect(ageOn('2004-02-29', '2026-03-01')).toBe(22)
  })
})

describe('clampText', () => {
  it('trims and returns undefined for anything empty or non-string', () => {
    expect(clampText('  hello  ', 50)).toBe('hello')
    expect(clampText('   ', 50)).toBeUndefined()
    expect(clampText('', 50)).toBeUndefined()
    expect(clampText(undefined, 50)).toBeUndefined()
    expect(clampText(null, 50)).toBeUndefined()
    expect(clampText(42, 50)).toBeUndefined()
    expect(clampText({ toString: () => 'x' }, 50)).toBeUndefined()
  })

  it('truncates rather than rejecting, so a long value cannot be used as storage', () => {
    const huge = 'a'.repeat(10_000)
    expect(clampText(huge, RECORDED_TEXT_MAX)).toHaveLength(RECORDED_TEXT_MAX)
    expect(clampText(huge, EVENT_ID_MAX)).toHaveLength(EVENT_ID_MAX)
    expect(clampText(huge, ATTRIBUTION_VALUE_MAX)).toHaveLength(ATTRIBUTION_VALUE_MAX)
  })

  it('leaves a value at exactly the limit alone', () => {
    const exact = 'b'.repeat(RECORDED_TEXT_MAX)
    expect(clampText(exact, RECORDED_TEXT_MAX)).toBe(exact)
  })
})

describe('validateSignup', () => {
  it('accepts a well-formed body and normalises it', () => {
    const result = validateSignup(
      validBody({ firstName: '  Jordan ', email: 'JORDAN@Example.COM ' }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.normalized).toEqual({
      firstName: 'Jordan',
      lastName: 'Nguyen',
      email: 'jordan@example.com',
      phone: '+16045550123',
      dob: '2004-04-12',
    })
  })

  it.each([
    ['missing first name', { firstName: '' }, 'firstName'],
    ['whitespace-only first name', { firstName: '   ' }, 'firstName'],
    ['over-long first name', { firstName: 'a'.repeat(81) }, 'firstName'],
    ['missing last name', { lastName: '' }, 'lastName'],
    ['over-long last name', { lastName: 'a'.repeat(81) }, 'lastName'],
    ['missing email', { email: '' }, 'email'],
    ['email with no @', { email: 'nope' }, 'email'],
    ['email with no dot', { email: 'a@b' }, 'email'],
    ['email with a space', { email: 'a b@c.com' }, 'email'],
    ['over-long email', { email: `${'a'.repeat(250)}@b.com` }, 'email'],
    ['missing phone', { phone: '' }, 'phone'],
    ['short phone', { phone: '12345' }, 'phone'],
    ['missing dob', { dob: '' }, 'dob'],
    ['impossible dob', { dob: '2005-02-29' }, 'dob'],
    ['dob before 1920', { dob: '1919-01-01' }, 'dob'],
    ['dob in the future', { dob: '2999-01-01' }, 'dob'],
  ])('rejects %s', (_label, overrides, field) => {
    const result = validateSignup(validBody(overrides as Partial<SignupRequest>))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors[field as keyof typeof result.fieldErrors]).toBeTruthy()
  })

  it('rejects a phone that is only long enough because of punctuation', () => {
    // Without the raw-length cap, this reduces to nothing after \D is stripped but
    // still walks through as a "string that was provided".
    const result = validateSignup(validBody({ phone: '-'.repeat(5000) }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors.phone).toBeTruthy()
  })

  it('re-checks both attestations, because a hand-rolled POST sends whatever it likes', () => {
    for (const missing of [{ ageConfirmed: false }, { privacyAccepted: false }] as const) {
      const result = validateSignup(validBody(missing))
      expect(result.ok).toBe(false)
    }
    expect(validateSignup(validBody({ ageConfirmed: undefined })).ok).toBe(false)
    // Truthy-but-not-true must not pass: the check is `!== true` for this reason.
    expect(validateSignup(validBody({ ageConfirmed: 'yes' as never })).ok).toBe(false)
  })

  it('never requires consentOptIn — under CASL it cannot be a condition of signing up', () => {
    expect(validateSignup(validBody({ consentOptIn: false })).ok).toBe(true)
    expect(validateSignup(validBody({ consentOptIn: undefined })).ok).toBe(true)
  })

  it('reports every bad field at once rather than one per round trip', () => {
    const result = validateSignup(validBody({ firstName: '', email: 'x', phone: '' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.fieldErrors).sort()).toEqual(['email', 'firstName', 'phone'])
  })

  it('does not throw on a body with nothing in it', () => {
    expect(() => validateSignup({})).not.toThrow()
    expect(validateSignup({}).ok).toBe(false)
  })

  it('does not throw when fields are the wrong type entirely', () => {
    const hostile = {
      firstName: { $ne: null },
      lastName: ['a'],
      email: 12345,
      phone: null,
      dob: { toString: () => '2004-04-12' },
    } as unknown as Partial<SignupRequest>
    expect(() => validateSignup(hostile)).not.toThrow()
    expect(validateSignup(hostile).ok).toBe(false)
  })
})
