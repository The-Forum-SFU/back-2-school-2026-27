/**
 * Event + ticket-list content. Swap this file, not the components.
 *
 * The windows and capacities here MIRROR the `ticket_lists` table so the page can
 * render a correct first frame with no spinner. The database is authoritative — on
 * any disagreement, `/api/list-status` wins. Keep the two in sync when editing.
 *
 * NAMING: the paid table option is "Table Service" everywhere, never "bottle
 * service". Deliberate legal-liability decision — do not let a variant into copy,
 * form values, database values, Brevo tags, alt text, or metadata.
 *
 * COPY RULES from the build plan, which apply to every string in this file:
 *   - No em dashes in user-facing copy.
 *   - Never publish guestlist inventory. No string may state how many spots exist,
 *     are taken, or remain. That is why there is no `showRemainingBelow` any more
 *     and why `capacity` below is a server mirror that nothing renders.
 *   - Prices and percentages come from EVENT.pricing, never from a literal, so the
 *     unconfirmed TicketWeb fee can move without leaving a stale number behind.
 */

import { ROUTES } from '../routes'

export type TicketType =
  | 'presale-guestlist'
  | 'early-access'
  | 'general-onsale'
  | 'table-service'

export type ListPhase = 'before' | 'open' | 'closed' | 'full'

export type SignupCopy = {
  // --- Section header, above the form ---
  heading: string
  subheading: string
  /**
   * Quiet line under the subheading carrying the when and where. Split out from
   * `subheading`, which used to be a four-fact paragraph doing both jobs: the pitch
   * wants to be read and the logistics want to be scanned, and one paragraph cannot be
   * both. Rendered small and muted.
   */
  detailsLine?: string
  /** Small kicker over the heading. */
  eyebrow?: string

  // --- The form block itself ---
  /** Heading on the form, distinct from the section heading above it. */
  formHeading?: string
  formSubheading?: string
  /**
   * Always-visible note under the email field. Required, not optional: every list
   * mails a confirmation, so every list needs the address to be one that receives it.
   */
  emailNote: string
  submitLabel: string
  /** Tinted panel directly above the submit button. */
  termsTitle?: string
  termsLines?: readonly string[]

  // --- Terminal states. `{firstName}`, `{name}` and `{email}` are filled in. ---
  successTitle: string
  successBody: string
  /** "Entered your name wrong? …" */
  correctionNote?: string
  /**
   * The repeat-submission pair, shown when the server answers `already_registered`.
   *
   * The TITLE still says "already", because someone who fills the form twice is asking
   * whether it worked the first time and the answer to that is the useful one. The BODY
   * is deliberately the same string as `successBody`: whatever brought them back, the
   * next thing they need is their inbox, and a body explaining that they had made a
   * redundant submission answered a question nobody asked.
   */
  alreadyTitle: string
  alreadyBody: string
  closedTitle: string
  closedBody: string

  // --- Exact strings stored verbatim with each row. See submissions.consent_text. ---
  consentLabel: string
  /**
   * Small print under the opt-in: rates, frequency, and how to get out. Part of the
   * consent record, not decoration, so SignupForm joins it onto `consentLabel` for
   * `submissions.consent_text` rather than storing only the headline sentence.
   */
  consentFinePrint?: string
  /**
   * Passive notice above the submit button, NOT a checkbox — pressing submit is the
   * act of agreement. Rendered as
   * `{privacyNotice} <a>{privacyLinkText}</a>. {privacyNoticeAfter}`
   */
  privacyNotice: string
  privacyLinkText: string
  privacyHref: string
  /** Sentence after the privacy link. Omitted when a list has nothing to add. */
  privacyNoticeAfter?: string
}

export type ListConfig = {
  ticketType: TicketType
  label: string
  blurb: string
  /**
   * Mirrors ticket_lists.capacity so the server contract stays visible here. Nothing
   * renders it: publishing guestlist inventory is forbidden, and the only user-facing
   * effect of the cap is that the form is replaced by the closed panel.
   */
  capacity: number | null
  /** ISO with an EXPLICIT offset — a bare string parses as local time. */
  opensAt: string
  closesAt: string
  priceCents: number
  minAge: number
  /** Discriminates the page body. Only 'signup' is implemented this pass. */
  mode: 'signup' | 'checkout' | 'inquiry'
  checkoutUrl?: string
  /** Shown on the success state. Only lists with a physical door have one. */
  doorInstructions?: { title: string; lines: readonly string[] }
  /** Where a full/closed list sends people next. `enabled: false` renders text, not a link. */
  nextStep: {
    enabled: boolean
    href: string
    label: string
    availableFrom?: string
  } | null
  /** Shown on the full/closed panel. `time: null` omits the time entirely. */
  ticketDrop?: { date: string; time: string | null; label: string }
  copy: SignupCopy
}

export const EVENT = {
  name: 'Rewind',
  tagline: "SFU's Biggest Back to School Party",
  pitch: "SFU's Biggest Throwback Party",
  campaignTagline: "SFU's biggest back to school throwback party",
  hashtags: ['#Rewind', '#SFU', '#Throwback'],

  /**
   * DOOR DATE. Load-bearing three times over: the client 19+ gate computes age
   * against it, the copy below renders it, and `ticket_lists.door_date` has to match
   * or the client and server disagree about who is old enough.
   *
   * This said 2026-09-26 until the deployed database was checked: every row in
   * `ticket_lists` has `door_date = 2026-09-20`, which is what claim_signup has been
   * enforcing all along, and which matches the build plan's "Sunday, September 20".
   * The 26th was a stale value here and in the landing overlay, and it meant the
   * form's own age check ran against a date six days later than the server's.
   */
  doorDate: '2026-09-20',
  timeZone: 'America/Vancouver',

  venue: {
    name: 'Celebrities Nightclub',
    // TODO: unconfirmed. Rendered only when non-null, so nothing shows a placeholder.
    address: null as string | null,
    ageRestriction: '19+',
    idRequirement: 'two pieces of government ID',
    doorsOpen: '9:30 PM',
    // TODO: unconfirmed. Rendered only when non-null.
    doorsClose: null as string | null,
  },

  /**
   * Machine-readable times for the add-to-calendar link only. Local to `timeZone`,
   * which the link passes through as `ctz` so nothing here has to do UTC arithmetic.
   *
   * `endLocal` is an assumption, not a published fact — a calendar entry needs an end
   * and "2 AM" is the honest guess for a nightclub. It is never rendered as copy, so
   * it cannot contradict the venue's actual closing time once that is confirmed.
   */
  calendar: {
    startLocal: '21:30',
    endLocal: '02:30',
  },

  /**
   * Every price on the page, in one place.
   *
   * `ticketAllInCents` is the one to watch: every percentage the page shows is
   * computed from it (see `percentOff`), because the TicketWeb fee behind it is
   * still unconfirmed. Keep it a number here rather than baking "84% OFF" into a
   * graphic, or a fee change silently leaves a wrong figure on the page.
   */
  pricing: {
    /** Regular ticket, face value before fees. */
    ticketCents: 2300,
    /** Regular ticket, all-in with fees. TODO: fee unconfirmed, roughly $8. */
    ticketAllInCents: 3000,
    /** Early bird tickets, for the public page when it lands. */
    earlyBirdCents: 800,
    earlyBirdCount: 80,
    /** Discounted guestlist door rates, either side of the cutoff. */
    doorEarlyCents: 500,
    doorLateCents: 1500,
    doorCutoff: '10:30 PM',
  },

  socialProof: {
    pastAttendance: 700,
    /**
     * The figure the hero quotes. Forward-looking and deliberately NOT `pastAttendance`,
     * which is what a previous event actually drew: "turn up with 800+" is a claim about
     * the room on the night. Kept as a number so the two can never drift apart in copy.
     */
    expectedAttendance: 800,
    // TODO: sellout-speed stat, if the team wants one alongside the attendance figure.
    selloutSpeed: null as string | null,
  },

  /**
   * The instant regular tickets go on sale. ISO with an EXPLICIT offset, for the usual
   * reason and one extra: this drives the live countdown on the landing hero, so an
   * hour of drift is not a subtle bug, it is visible on screen.
   *
   * SINGLE SOURCE OF TRUTH for the drop. `general-onsale.opensAt` and the presale
   * panel's `ticketDrop.date` both read from it below, so the clock ticking on the hero
   * can never disagree with the date printed on the closed panel.
   *
   * TODO: the TIME is unconfirmed — the build plan writes it as "xxPM", which is why
   * `ticketDrop.time` is still null and no time is printed anywhere. Midnight is what
   * general-onsale.opensAt has said all along, so the countdown inherits that rather
   * than inventing a second guess. Set the real hour here once it is confirmed and
   * everything downstream follows.
   */
  ticketDropAt: '2026-08-24T00:00:00-07:00',

  /**
   * The [ TICKETS ] control in the landing-page header.
   * While `enabled` is false it scrolls to the signup section instead of linking out,
   * so there is never a dead link. Flip on Aug 24 when General On-Sale opens.
   */
  tickets: {
    enabled: false,
    // TODO: confirm the TicketWeb event URL.
    url: '',
  },
} as const

/** "$5" / "$23". Cents are rendered only when there are any. */
export function money(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

/**
 * Discount off the ALL-IN ticket price, rounded to a whole percent.
 *
 * Against the all-in price and not the $23 face value, deliberately: $5 versus $31
 * is what someone actually saves. Never hard-code the result — the fee it divides
 * by is unconfirmed.
 */
export function percentOff(cents: number): number {
  const full = EVENT.pricing.ticketAllInCents
  return Math.round(((full - cents) / full) * 100)
}

/**
 * What a door rate saves against the ALL-IN ticket price, in cents.
 *
 * Same anchor and same reasoning as percentOff, which it sits beside rather than
 * replaces: the page shows the dollar figure because "$26" is more concrete than "84%"
 * at these amounts, while percentOff stays the source for ad copy that wants the
 * percentage. Both divide by the same unconfirmed fee, so neither may be hard-coded.
 *
 * Floored at zero so a rate above the ticket price reads as no saving rather than as a
 * negative one.
 */
export function savedVersusTicket(cents: number): number {
  return Math.max(0, EVENT.pricing.ticketAllInCents - cents)
}

/**
 * Month abbreviations for the hero stamp, written out rather than taken from
 * `toLocaleString({ month: 'short' })`.
 *
 * Intl gives "Sep", and the display type has always read "SEPT". These are the
 * everyday North American abbreviations, which is what a poster uses.
 */
const STAMP_MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUNE',
  'JULY', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC',
]

/** "SEPT 20" — the display stamp over the hero. Uppercase, no year. */
export function formatDoorStamp(): string {
  const date = new Date(`${EVENT.doorDate}T12:00:00Z`)
  return `${STAMP_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`
}

/** "Sunday, September 20" — weekday and date, no year. */
export function formatDoorDate(): string {
  return new Date(`${EVENT.doorDate}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** Fills `{firstName}`-style placeholders in copy. Unknown keys are left alone. */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match)
}

/**
 * Google Calendar template link for the event.
 *
 * A hosted link rather than a downloaded .ics: almost all of this traffic is
 * Instagram's in-app browser, where a file download either does nothing visible or
 * dead-ends in a viewer with no way back. A URL opens.
 *
 * `ctz` carries the timezone so the times below stay local wall-clock times and no
 * UTC conversion happens here — the one place that arithmetic could go wrong by an
 * hour twice a year.
 */
export function calendarUrl(): string {
  const day = EVENT.doorDate.replace(/-/g, '')
  // Doors are at night, so the end time lands on the following day.
  const next = new Date(`${EVENT.doorDate}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const nextDay = next.toISOString().slice(0, 10).replace(/-/g, '')

  const start = `${day}T${EVENT.calendar.startLocal.replace(':', '')}00`
  const end = `${nextDay}T${EVENT.calendar.endLocal.replace(':', '')}00`

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${EVENT.name}: ${EVENT.tagline}`,
    dates: `${start}/${end}`,
    ctz: EVENT.timeZone,
    location: EVENT.venue.address
      ? `${EVENT.venue.name}, ${EVENT.venue.address}`
      : EVENT.venue.name,
    details: `Doors ${EVENT.venue.doorsOpen}. ${EVENT.venue.ageRestriction}, ${EVENT.venue.idRequirement}.`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

const P = EVENT.pricing
const DOOR_EARLY = money(P.doorEarlyCents)
const DOOR_LATE = money(P.doorLateCents)

/**
 * The landing hero, which belongs to the EVENT and not to any one list: `/` and the
 * guestlist route render the same scroll experience, so this text is read by someone
 * who may have arrived from anywhere and must not assume a list.
 *
 * Two separate lines rather than one string. The caption sits in an exclusion blending
 * group on the left rail and the hero artwork starts around 450px in, so a single long
 * line runs into the bear and inverts mid-sentence. See Caption in Overlay.tsx.
 */
export const HERO_COPY = {
  headline: EVENT.tagline,
  subline: `Turn up with ${EVENT.socialProof.expectedAttendance}+ students at Vancouver's favourite nightclub.`,
  /**
   * Label over the hero countdown, on the routes that have no form to send anyone to.
   *
   * "Tickets", not "regular tickets": the first 80 through the door on drop day are the
   * early birds, so a countdown promising regular tickets would be counting down to a
   * price most of the people watching it will not pay. This also matches the wording
   * RsvpClosed already uses on the presale panel ("Tickets drop August 24th"), which is
   * the other place the same moment is named.
   */
  countdownLabel: 'Tickets drop in',
}

/**
 * Shared consent wording.
 *
 * There is no age checkbox any more. The birthdate is the attestation, and it is a
 * stronger one than a tick — see the note in src/lib/signupApi.ts.
 *
 * `privacyHref` reads from ROUTES rather than repeating the path. It used to be the
 * literal '/privacy' with no route behind it, so the link resolved through the
 * catch-all onto the landing page: every signup was told it agreed to a document it
 * could not open, while `submissions.privacy_text` recorded that it had. Pointing both
 * at one constant is what stops that reopening.
 */
const CONSENT_COPY = {
  consentLabel:
    'Opt in to email and SMS from The Forum to get first access to exclusive pre-sales, ' +
    'discounts and giveaways.',
  consentFinePrint:
    'Msg and data rates may apply, frequency varies. Reply STOP or use the unsubscribe ' +
    'link any time.',
  privacyNotice: 'By signing up you agree to our',
  privacyLinkText: 'Privacy Policy',
  privacyHref: ROUTES.PRIVACY,
  privacyNoticeAfter:
    'We will contact you via email regarding important event information.',
}

/**
 * Field-level guidance, shared by every list because the fields are.
 *
 * `emailNote` is the preventive half of a pair. The other half is a hard rejection of
 * @sfu.ca in src/lib/validate.ts and its server twin api/_lib/validate.ts: SFU's
 * filters quarantine bulk mail, so a confirmation sent there usually never arrives and
 * the person is left with no record of the spot they claimed. This note is what stops
 * someone typing one in the first place, which is a much better outcome than the
 * error. Change the rule and change this line with it.
 *
 * It deliberately no longer explains WHY. The reason lives in SFU_EMAIL_ERROR, which is
 * what someone sees if they type one anyway, and that is the moment the explanation is
 * worth reading. Under the field, before anything is typed, the instruction is the only
 * part that does any work: this hint sits on screen for every single person who fills
 * the form, and the shorter it is the more likely it is actually read.
 */
const FIELD_COPY = {
  emailNote: 'Please avoid using an @sfu.ca address.',
}

/**
 * The confirmation subhead, shared by the first signup and a repeat one.
 *
 * One constant rather than the same sentence typed twice, so the two can never drift.
 * Only the headline differs between those states; see the note on SignupCopy.
 */
const CONFIRMATION_BODY =
  'Check your inbox for your confirmation email and instructions. Check spam and ' +
  'promotions too if you do not see it.'

export const LISTS: Record<TicketType, ListConfig> = {
  'presale-guestlist': {
    ticketType: 'presale-guestlist',
    label: 'Discounted Guestlist',
    blurb: 'No ticketing fees. Pay at the door.',
    capacity: 75,
    opensAt: '2026-08-10T00:00:00-07:00',
    closesAt: '2026-08-25T23:59:59-07:00',
    priceCents: P.doorEarlyCents,
    minAge: 19,
    mode: 'signup',
    doorInstructions: {
      title: 'Important note',
      // One paragraph rather than four bullets. Every fact here is a condition of
      // getting in at the rate they were promised, and a bulleted list invites skimming
      // exactly the line someone cannot afford to miss.
      lines: [
        `Arrive by ${EVENT.venue.doorsOpen} when doors open. Give the staff the exact name ` +
          `you entered, {name}, and bring ${DOOR_EARLY} cash and ${EVENT.venue.idRequirement}. ` +
          `You need to be checked in before ${P.doorCutoff} for the ${DOOR_EARLY} rate. If you ` +
          `arrive after ${P.doorCutoff}, you will be charged a regular discounted rate at ${DOOR_LATE}.`,
      ],
    },
    nextStep: {
      // No TicketWeb URL yet, so this renders as text. Flipping EVENT.tickets.enabled
      // once the URL lands turns it into the button, with no change here.
      enabled: EVENT.tickets.enabled && Boolean(EVENT.tickets.url),
      href: EVENT.tickets.url,
      label: 'Get tickets',
    },
    ticketDrop: {
      // Date half of EVENT.ticketDropAt, so this panel and the hero countdown name the
      // same day by construction. The offset is Pacific and the time is midnight, so
      // slicing the ISO string is exact here — no timezone arithmetic to get wrong.
      date: EVENT.ticketDropAt.slice(0, 10),
      // TODO: drop time unconfirmed ("xxPM"). Null omits it rather than printing a placeholder.
      time: null,
      label: 'Wave 1',
    },
    copy: {
      eyebrow: 'Early access',
      heading: 'Discounted Guestlist',
      // The pitch only. What used to be here was four facts in one paragraph, which
      // meant the reason to come and the logistics of coming competed for the same
      // sentence. The when and where moved to `detailsLine` below.
      subheading:
        `Join us at ${EVENT.tagline}. This year, with a special throwback edition. We will be ` +
        'playing your favourite songs throughout the last decades, where you will be able to ' +
        'sing along!',
      detailsLine: `${formatDoorDate()}. ${EVENT.venue.name}. Doors ${EVENT.venue.doorsOpen}.`,

      formHeading: 'Get on the list',
      formSubheading: 'Enter the name you will give at the door.',
      submitLabel: `Claim my ${DOOR_EARLY} spot`,
      termsTitle: 'Please note',
      termsLines: [
        `This is not a ticket. It is an RSVP that grants you discounted access at the door ` +
          `before ${P.doorCutoff} for ${DOOR_EARLY}.`,
      ],

      successTitle: 'You are on the list.',
      successBody: CONFIRMATION_BODY,
      // Different headline, same body. See the note on the type.
      alreadyTitle: 'You are already on the list.',
      alreadyBody: CONFIRMATION_BODY,
      closedTitle: 'The discounted guestlist is full',
      closedBody: `Tickets are the next best thing, and the first ${P.earlyBirdCount} are ${money(P.earlyBirdCents)}.`,

      ...CONSENT_COPY,
      ...FIELD_COPY,
    },
  },

  // --- Deferred. Seeded so the template and the DB need no migration later. ---
  'early-access': {
    ticketType: 'early-access',
    label: 'Early Access List',
    blurb: 'First crack at the Wave 1 ticket drop. No discount.',
    capacity: 50,
    opensAt: '2026-08-20T00:00:00-07:00',
    closesAt: '2026-08-24T23:59:59-07:00',
    priceCents: 0,
    minAge: 19,
    mode: 'signup',
    nextStep: null,
    copy: {
      heading: 'Early Access List',
      subheading: 'Get in before general on-sale',
      submitLabel: 'Join the list',
      successTitle: 'You are on the list.',
      successBody: 'We will email you the moment Wave 1 opens.',
      alreadyTitle: 'You are already on the list.',
      alreadyBody: 'No need to sign up twice. We have you down.',
      closedTitle: 'Early Access Closed',
      closedBody: 'The early access list is closed.',
      ...CONSENT_COPY,
      ...FIELD_COPY,
    },
  },

  'general-onsale': {
    ticketType: 'general-onsale',
    label: 'General On-Sale',
    blurb: 'Standard tickets through TicketWeb.',
    capacity: null,
    // Same instant the hero counts down to, by construction. Still mirrors
    // ticket_lists.opens_at — the value is unchanged, only where it is written.
    opensAt: EVENT.ticketDropAt,
    closesAt: '2026-09-20T23:59:59-07:00',
    priceCents: 0,
    minAge: 19,
    // Not a signup at all — a checkout handoff. Not implemented this pass.
    mode: 'checkout',
    checkoutUrl: '',
    nextStep: null,
    copy: {
      heading: 'Tickets',
      subheading: 'General on-sale',
      submitLabel: 'Buy tickets',
      successTitle: '',
      successBody: '',
      alreadyTitle: '',
      alreadyBody: '',
      closedTitle: 'Sales Closed',
      closedBody: 'General on-sale has ended.',
      ...CONSENT_COPY,
      ...FIELD_COPY,
    },
  },

  'table-service': {
    ticketType: 'table-service',
    label: 'Table Service',
    blurb: 'Inquiry-based. Our team will reach out with availability and pricing.',
    capacity: null,
    // Window is TBD; the DB row ships inactive so the server rejects regardless.
    opensAt: '2026-08-10T00:00:00-07:00',
    closesAt: '2026-09-25T23:59:59-07:00',
    priceCents: 0,
    minAge: 19,
    mode: 'inquiry',
    nextStep: null,
    copy: {
      heading: 'Table Service',
      subheading: 'Inquire about availability',
      submitLabel: 'Send inquiry',
      successTitle: 'Inquiry received',
      successBody: 'We will be in touch shortly with availability and pricing.',
      alreadyTitle: 'We already have your inquiry',
      alreadyBody: 'Our team will reach out. No need to send another.',
      closedTitle: 'Table Service Closed',
      closedBody: 'Table service inquiries are closed.',
      ...CONSENT_COPY,
      ...FIELD_COPY,
    },
  },
}

/**
 * Pure phase resolution — same inputs, same answer, so it's trivially testable and
 * safe to call every render.
 *
 * Answers the window question ONLY. It can never return 'full', because capacity is
 * knowable only to the database and the API no longer sends a count to reason from.
 * That's why ListSection reconciles against /api/list-status and lets the server win.
 */
export function resolveListPhase(cfg: ListConfig, now: Date): ListPhase {
  if (now.getTime() < new Date(cfg.opensAt).getTime()) return 'before'
  if (now.getTime() > new Date(cfg.closesAt).getTime()) return 'closed'
  return 'open'
}

/** "August 24th" — month and ordinal day, no year. */
export function formatDropDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  const month = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  const day = date.getUTCDate()
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th'
  return `${month} ${day}${suffix}`
}

/** "August 20" — for "opens ..." lines. */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: EVENT.timeZone,
  })
}
