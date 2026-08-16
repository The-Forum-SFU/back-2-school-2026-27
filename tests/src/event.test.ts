import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  calendarUrl,
  EVENT,
  fill,
  formatDoorDate,
  formatDoorStamp,
  formatDropDate,
  formatShortDate,
  LISTS,
  money,
  percentOff,
  resolveListPhase,
  type ListConfig,
} from '../../src/config/event'

/**
 * The config is where the build plan's rules actually live, so this file is half
 * unit tests and half compliance checks on the copy itself.
 *
 * The compliance half is the part worth keeping: "no em dashes", "never publish
 * guestlist inventory" and "the kicker always travels with the name" are the kind of
 * rule that gets broken by someone editing one string in a hurry.
 */

const GUESTLIST = LISTS['presale-guestlist']

/** Every user-facing string in the config, with a path for a readable failure. */
function allCopy(): [string, string][] {
  const out: [string, string][] = []
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') out.push([path, value])
    else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`))
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`)
    }
  }
  for (const [type, cfg] of Object.entries(LISTS)) walk(cfg, type)
  return out
}

describe('money', () => {
  it('renders whole dollars without a decimal', () => {
    expect(money(500)).toBe('$5')
    expect(money(2300)).toBe('$23')
    expect(money(0)).toBe('$0')
  })

  it('shows cents only when there are any', () => {
    expect(money(2350)).toBe('$23.50')
    expect(money(1)).toBe('$0.01')
  })
})

describe('percentOff', () => {
  it('measures against the all-in price, not the face value', () => {
    // $5 against $31 all-in is 84% off. Against the $23 face value it would be 78%,
    // which is the wrong number and the reason this is computed rather than written.
    expect(percentOff(EVENT.pricing.doorEarlyCents)).toBe(84)
    expect(percentOff(EVENT.pricing.doorLateCents)).toBe(52)
  })

  it('moves with the fee, which is the whole point of not baking it into a graphic', () => {
    const asIf = (allIn: number, price: number) => Math.round(((allIn - price) / allIn) * 100)
    expect(asIf(2800, 500)).not.toBe(percentOff(500))
  })

  it('is 0 at full price and 100 when free', () => {
    expect(percentOff(EVENT.pricing.ticketAllInCents)).toBe(0)
    expect(percentOff(0)).toBe(100)
  })
})

describe('date formatting', () => {
  it('renders the door date as a weekday and date', () => {
    expect(formatDoorDate()).toBe('Sunday, September 20')
  })

  it('renders the hero stamp the way a poster would, not the way Intl would', () => {
    // Intl's `month: 'short'` gives "Sep"; the display type has always read "SEPT".
    expect(formatDoorStamp()).toBe('SEPT 20')
  })

  it('agrees with the door date the database enforces', () => {
    // ticket_lists.door_date is 2026-09-20. If this drifts, the form's own 19+ check
    // runs against a different date than claim_signup, and the two disagree about who
    // is old enough at the door.
    expect(EVENT.doorDate).toBe('2026-09-20')
    expect(new Date(`${EVENT.doorDate}T12:00:00Z`).getUTCDay()).toBe(0) // a Sunday
  })

  it('adds the right ordinal suffix to a drop date', () => {
    expect(formatDropDate('2026-08-01')).toBe('August 1st')
    expect(formatDropDate('2026-08-02')).toBe('August 2nd')
    expect(formatDropDate('2026-08-03')).toBe('August 3rd')
    expect(formatDropDate('2026-08-04')).toBe('August 4th')
    expect(formatDropDate('2026-08-11')).toBe('August 11th')
    expect(formatDropDate('2026-08-12')).toBe('August 12th')
    expect(formatDropDate('2026-08-13')).toBe('August 13th')
    expect(formatDropDate('2026-08-21')).toBe('August 21st')
    expect(formatDropDate('2026-08-24')).toBe('August 24th')
  })

  it('renders an opens-at instant in the event timezone', () => {
    expect(formatShortDate('2026-08-10T00:00:00-07:00')).toBe('August 10')
  })
})

describe('fill', () => {
  it('substitutes known placeholders', () => {
    expect(fill('{firstName}, you are in.', { firstName: 'Jordan' })).toBe('Jordan, you are in.')
    expect(fill('{a}{b}', { a: '1', b: '2' })).toBe('12')
  })

  it('leaves an unknown placeholder visible rather than printing "undefined"', () => {
    expect(fill('Hi {nobody}', {})).toBe('Hi {nobody}')
  })

  it('handles a template with no placeholders and an empty template', () => {
    expect(fill('plain', { a: 'b' })).toBe('plain')
    expect(fill('', {})).toBe('')
  })
})

describe('calendarUrl', () => {
  const url = new URL(calendarUrl())
  const params = url.searchParams

  it('points at the Google Calendar template, not a downloaded file', () => {
    // Almost all traffic is Instagram's in-app browser, where a download dead-ends.
    expect(url.host).toBe('calendar.google.com')
    expect(params.get('action')).toBe('TEMPLATE')
  })

  it('starts at the door time and ends on the following day', () => {
    expect(params.get('dates')).toBe('20260920T213000/20260921T020000')
  })

  it('passes the timezone rather than converting to UTC by hand', () => {
    expect(params.get('ctz')).toBe('America/Vancouver')
  })

  it('carries the full name lockup and the venue', () => {
    expect(params.get('text')).toBe("Rewind: SFU's Biggest Back to School Party")
    expect(params.get('location')).toBe('Celebrities Nightclub')
  })
})

describe('resolveListPhase', () => {
  const cfg = { opensAt: '2026-08-10T00:00:00-07:00', closesAt: '2026-08-25T23:59:59-07:00' } as ListConfig

  it('answers the window question', () => {
    expect(resolveListPhase(cfg, new Date('2026-08-01T00:00:00Z'))).toBe('before')
    expect(resolveListPhase(cfg, new Date('2026-08-15T00:00:00Z'))).toBe('open')
    expect(resolveListPhase(cfg, new Date('2026-09-01T00:00:00Z'))).toBe('closed')
  })

  it('is exact at both boundaries', () => {
    expect(resolveListPhase(cfg, new Date('2026-08-10T07:00:00Z'))).toBe('open')
    expect(resolveListPhase(cfg, new Date('2026-08-10T06:59:59Z'))).toBe('before')
    expect(resolveListPhase(cfg, new Date('2026-08-26T06:59:59Z'))).toBe('open')
    expect(resolveListPhase(cfg, new Date('2026-08-26T07:00:00Z'))).toBe('closed')
  })

  it('can never return "full" on its own', () => {
    // Capacity is knowable only to the database, and the API sends no count to reason
    // from. A client that could decide "full" would be guessing.
    const samples = ['2026-08-01', '2026-08-15', '2026-09-01'].map(
      (d) => resolveListPhase(cfg, new Date(`${d}T00:00:00Z`)),
    )
    expect(samples).not.toContain('full')
  })
})

describe('copy compliance', () => {
  it('uses no em dashes anywhere in user-facing copy', () => {
    for (const [path, text] of allCopy()) {
      expect(text, `${path}: ${text}`).not.toMatch(/—/)
    }
  })

  /**
   * The check above only ever walked src/config/event.ts, so a rendered string written
   * straight into a component was never covered. That is not hypothetical: the
   * full/closed panel shipped `${next.label} — details coming soon.`, which renders the
   * moment the guestlist fills or the window shuts, and this suite passed the whole time.
   *
   * Comments are stripped first because the prose in these files uses em dashes heavily
   * and legitimately. What is left is code, where the only place an em dash can appear
   * is a string literal or JSX text — both of which reach the page.
   */
  it('uses no em dashes in strings written directly into components', () => {
    const dirs = ['src/components', 'src/components/form', 'src/pages']
    const files = dirs.flatMap((dir) =>
      readdirSync(join(process.cwd(), dir))
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => join(dir, f)),
    )
    // Guards the guard: a bad path list would make this pass by scanning nothing.
    expect(files.length).toBeGreaterThan(10)

    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

    for (const file of files) {
      const code = stripComments(readFileSync(join(process.cwd(), file), 'utf8'))
      code.split('\n').forEach((line, i) => {
        expect(line, `${file}:${i + 1}: ${line.trim()}`).not.toMatch(/—/)
      })
    }
  })

  it('publishes no guestlist inventory', () => {
    // "No page shows how many spots exist, are taken or remain." The ticket count is
    // the documented exception and lives on the public page, not on this list.
    //
    // The lookbehind lets a PRICE sit next to the word: "Claim my $5 spot" is the
    // approved button label, "75 spots" is the thing that must never appear.
    for (const [path, text] of allCopy()) {
      expect(text, `${path}: ${text}`).not.toMatch(/(?<!\$)\b\d+\s*(spots?|places?|seats?)\b/i)
      expect(text, `${path}: ${text}`).not.toMatch(/spots? (left|remaining|available)/i)
      expect(text, `${path}: ${text}`).not.toMatch(/\bof 75\b/)
    }
  })

  it('never lets the name travel without its kicker', () => {
    expect(EVENT.name).toBe('Rewind')
    expect(EVENT.tagline).toBe("SFU's Biggest Back to School Party")
  })

  it('carries the form spec verbatim on the guestlist', () => {
    const c = GUESTLIST.copy
    expect(c.consentLabel).toBe(
      'Opt in to email and SMS from The Forum. First access to presales, member pricing, and giveaways.',
    )
    expect(c.venueShareNote).toBe(
      'We share your name with our venue partner, Celebrities Nightclub, for guestlist check-in only.',
    )
    expect(`${c.privacyNotice} ${c.privacyLinkText}.`).toBe(
      'By signing up you agree to our Privacy Policy.',
    )
    expect(c.formHeading).toBe('Get on the list')
    expect(c.formSubheading).toBe('Enter the name you will give at the door.')
    expect(c.submitLabel).toBe('Claim my $5 spot')
    expect(c.termsTitle).toBe('Before you submit')
    expect(c.termsLines).toEqual([
      'This is an RSVP, not a ticket. Nothing is charged now.',
      '$5 cash at the door if you are checked in before 10:30 PM. $15 after.',
      'Check your email for your confirmation and door instructions.',
    ])
  })

  it('derives every price in the copy from EVENT.pricing', () => {
    // A literal would survive a fee change and quietly contradict the rest of the page.
    const c = GUESTLIST.copy
    expect(c.submitLabel).toContain(money(EVENT.pricing.doorEarlyCents))
    expect(c.subheading).toContain(money(EVENT.pricing.ticketCents))
    expect(c.subheading).toContain(EVENT.pricing.doorCutoff)
    expect(c.closedBody).toContain(money(EVENT.pricing.earlyBirdCents))
    expect(c.closedBody).toContain(String(EVENT.pricing.earlyBirdCount))
  })

  it('gives the guestlist door instructions naming the exact door name', () => {
    const lines = GUESTLIST.doorInstructions?.lines ?? []
    expect(lines.some((l) => l.includes('{name}'))).toBe(true)
    expect(lines.some((l) => l.includes(EVENT.venue.idRequirement))).toBe(true)
    expect(lines.some((l) => l.includes(EVENT.pricing.doorCutoff))).toBe(true)
  })

  it('adds the venue disclosure only where names are actually shared', () => {
    expect(GUESTLIST.copy.venueShareNote).toBeTruthy()
    expect(LISTS['general-onsale'].copy.venueShareNote).toBeUndefined()
  })

  it('mirrors the database capacity without any component being able to show it', () => {
    expect(GUESTLIST.capacity).toBe(75)
    // Nothing may turn it into copy.
    for (const [, text] of allCopy()) expect(text).not.toContain('75')
  })

  it('never ships a link to a route that does not exist', () => {
    // nextStep renders as plain text until it is enabled, so a missing TicketWeb URL
    // is a sentence and not a 404.
    for (const cfg of Object.values(LISTS)) {
      if (cfg.nextStep?.enabled) expect(cfg.nextStep.href).toBeTruthy()
    }
  })
})
