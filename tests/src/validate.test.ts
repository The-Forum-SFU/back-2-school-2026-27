import { describe, expect, it } from 'vitest'
import {
  ageOn,
  composeDob,
  EMPTY_VALUES,
  isRealDate,
  validateSignup,
  type SignupValues,
} from '../../src/lib/validate'
import { validateSignup as validateOnServer } from '../../api/_lib/validate'

/**
 * The client half of a deliberately duplicated pair. src/lib/validate.ts and
 * api/_lib/validate.ts are kept in sync by hand, so the last block here is a drift
 * guard: the same inputs must be accepted or rejected by both.
 */

const OPTS = { minAge: 19, doorDate: '2026-09-20' }

function values(overrides: Partial<SignupValues> = {}): SignupValues {
  return {
    ...EMPTY_VALUES,
    firstName: 'Jordan',
    lastName: 'Nguyen',
    email: 'jordan@example.com',
    phone: '604 555 0123',
    dobYear: '2004',
    dobMonth: '4',
    dobDay: '12',
    ...overrides,
  }
}

describe('composeDob', () => {
  it('zero-pads the month and day the selects hand it', () => {
    expect(composeDob(values({ dobMonth: '4', dobDay: '2' }))).toBe('2004-04-02')
    expect(composeDob(values({ dobMonth: '12', dobDay: '31' }))).toBe('2004-12-31')
  })

  it('returns nothing until all three parts are chosen', () => {
    expect(composeDob(values({ dobMonth: '' }))).toBe('')
    expect(composeDob(values({ dobDay: '' }))).toBe('')
    expect(composeDob(values({ dobYear: '' }))).toBe('')
  })
})

describe('isRealDate and ageOn', () => {
  it('rejects a date that only exists after JS rolls it over', () => {
    expect(isRealDate('2005-02-29')).toBe(false)
    expect(isRealDate('2004-02-29')).toBe(true)
  })

  it('counts age at the door date, not today', () => {
    expect(ageOn('2007-09-20', '2026-09-20')).toBe(19)
    expect(ageOn('2007-09-21', '2026-09-20')).toBe(18)
  })
})

describe('validateSignup', () => {
  it('accepts a filled form and returns the composed date of birth', () => {
    const result = validateSignup(values(), OPTS)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.dob).toBe('2004-04-12')
  })

  it('requires every field except the opt-in', () => {
    const result = validateSignup(EMPTY_VALUES, OPTS)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.fieldErrors).sort()).toEqual([
      'dobYear',
      'email',
      'firstName',
      'lastName',
      'phone',
    ])
  })

  it('never requires the opt-in — CASL says consent has to be freely given', () => {
    expect(validateSignup(values({ consentOptIn: false }), OPTS).ok).toBe(true)
    expect(validateSignup(values({ consentOptIn: true }), OPTS).ok).toBe(true)
  })

  it('has no age or privacy checkbox left to require', () => {
    // The form has one checkbox. If either of these ever comes back as a required
    // field, the build plan's form spec has been broken.
    const result = validateSignup(EMPTY_VALUES, OPTS)
    if (result.ok) return
    expect(result.fieldErrors).not.toHaveProperty('ageConfirmed')
    expect(result.fieldErrors).not.toHaveProperty('privacyAccepted')
  })

  describe('the 19+ gate', () => {
    it('admits someone who turns 19 exactly on the night', () => {
      const result = validateSignup(
        values({ dobYear: '2007', dobMonth: '9', dobDay: '20' }),
        OPTS,
      )
      expect(result.ok).toBe(true)
    })

    it('rejects someone who turns 19 the day after', () => {
      const result = validateSignup(
        values({ dobYear: '2007', dobMonth: '9', dobDay: '21' }),
        OPTS,
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.fieldErrors.dobYear).toMatch(/19 or older/)
    })

    it('admits someone who is 18 today but 19 by the door date', () => {
      // Gating on today would silently cost every signup with a birthday between now
      // and the event.
      const result = validateSignup(
        values({ dobYear: '2007', dobMonth: '9', dobDay: '1' }),
        OPTS,
      )
      expect(result.ok).toBe(true)
    })

    it('reports an impossible birthday as impossible, not as underage', () => {
      const result = validateSignup(
        values({ dobYear: '2005', dobMonth: '2', dobDay: '29' }),
        OPTS,
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.fieldErrors.dobYear).toMatch(/does not exist/)
    })
  })

  it('accepts phone numbers in the shapes people actually type', () => {
    for (const phone of ['6045550123', '(604) 555-0123', '604-555-0123', '+1 604 555 0123']) {
      expect(validateSignup(values({ phone }), OPTS).ok, phone).toBe(true)
    }
  })

  it('rejects a phone with too few or too many digits', () => {
    for (const phone of ['12345', '1'.repeat(16)]) {
      expect(validateSignup(values({ phone }), OPTS).ok, phone).toBe(false)
    }
  })
})

describe('twin-file drift', () => {
  /**
   * The two validators are duplicated on purpose (see the header of either file), which
   * makes drift the obvious failure mode. Every case below is run through both.
   *
   * Only shape is compared, not messages: the client says "That date does not exist",
   * the server says "Enter a valid date", and those are allowed to differ.
   */
  const cases: [string, Partial<SignupValues>][] = [
    ['a good submission', {}],
    ['empty first name', { firstName: '  ' }],
    ['over-long first name', { firstName: 'a'.repeat(81) }],
    ['empty last name', { lastName: '' }],
    ['over-long last name', { lastName: 'a'.repeat(81) }],
    ['email with no @', { email: 'nope' }],
    ['email with no dot', { email: 'a@b' }],
    ['email with a space', { email: 'a b@c.com' }],
    ['over-long email', { email: `${'a'.repeat(250)}@b.com` }],
    ['empty phone', { phone: '' }],
    ['short phone', { phone: '12345' }],
    ['16-digit phone', { phone: '1'.repeat(16) }],
    ['formatted phone', { phone: '(604) 555-0123' }],
    ['international phone', { phone: '+44 20 7946 0958' }],
    ['impossible date', { dobYear: '2005', dobMonth: '2', dobDay: '29' }],
    ['leap day', { dobYear: '2004', dobMonth: '2', dobDay: '29' }],
  ]

  it.each(cases)('agrees on %s', (_label, overrides) => {
    const v = values(overrides)
    const client = validateSignup(v, OPTS)

    const server = validateOnServer({
      ticketType: 'presale-guestlist',
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      phone: v.phone,
      dob: composeDob(v),
      // The form no longer collects either; the client sends both as true.
      ageConfirmed: true,
      privacyAccepted: true,
      consentOptIn: v.consentOptIn,
    })

    expect(server.ok).toBe(client.ok)

    if (client.ok && server.ok) {
      // Both must agree on the value that ends up in the database, not just on pass/fail.
      expect(server.normalized.dob).toBe(client.dob)
      expect(server.normalized.email).toBe(v.email.trim().toLowerCase())
    }
  })

  it('leaves the age gate to the client and the database, never to the API validator', () => {
    // The server twin deliberately does NOT check age: only claim_signup knows each
    // list's door_date. An underage body must pass shape validation and be rejected
    // later, or the door date would end up duplicated in a third place.
    const underage = values({ dobYear: '2015', dobMonth: '1', dobDay: '1' })
    expect(validateSignup(underage, OPTS).ok).toBe(false)
    expect(
      validateOnServer({
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        phone: '6045550123',
        dob: composeDob(underage),
        ageConfirmed: true,
        privacyAccepted: true,
      }).ok,
    ).toBe(true)
  })
})
