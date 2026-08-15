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
  /** Small kicker over the heading. */
  eyebrow?: string

  // --- The form block itself ---
  /** Heading on the form, distinct from the section heading above it. */
  formHeading?: string
  formSubheading?: string
  submitLabel: string
  /** Tinted panel directly above the submit button. */
  termsTitle?: string
  termsLines?: readonly string[]

  // --- Terminal states. `{firstName}`, `{name}` and `{email}` are filled in. ---
  successTitle: string
  successBody: string
  /** "We just sent your confirmation to {email}." */
  confirmationNote?: string
  /** "Entered your name wrong? …" */
  correctionNote?: string
  alreadyTitle: string
  alreadyBody: string
  closedTitle: string
  closedBody: string

  // --- Exact strings stored verbatim with each row. See submissions.consent_text. ---
  consentLabel: string
  /** Disclosure under the opt-in. Guestlist lists only; omitted elsewhere. */
  venueShareNote?: string
  /**
   * Passive notice above the submit button, NOT a checkbox — pressing submit is the
   * act of agreement. Rendered as `{privacyNotice} <a>{privacyLinkText}</a>.`
   */
  privacyNotice: string
  privacyLinkText: string
  privacyHref: string
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
    endLocal: '02:00',
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
    ticketAllInCents: 3100,
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
    // TODO: sellout-speed stat, if the team wants one alongside the attendance figure.
    selloutSpeed: null as string | null,
  },

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
const TICKET = money(P.ticketCents)

/**
 * Shared consent wording.
 *
 * There is no age checkbox any more. The birthdate is the attestation, and it is a
 * stronger one than a tick — see the note in src/lib/signupApi.ts.
 *
 * TODO: `privacyHref` points at a route that does not exist yet.
 */
const CONSENT_COPY = {
  consentLabel:
    'Opt in to email and SMS from The Forum. First access to presales, member pricing, and giveaways.',
  privacyNotice: 'By signing up you agree to our',
  privacyLinkText: 'Privacy Policy',
  privacyHref: '/privacy',
}

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
      title: 'On the night',
      lines: [
        `Arrive by ${EVENT.venue.doorsOpen} when doors open. The line moves slowly after ten.`,
        'Give the staff the exact name you entered: {name}.',
        `Bring ${DOOR_EARLY} cash and ${EVENT.venue.idRequirement}.`,
        `Check in before ${P.doorCutoff} for the ${DOOR_EARLY} rate. After that it is ${DOOR_LATE}.`,
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
      date: '2026-08-24',
      // TODO: drop time unconfirmed ("xxPM"). Null omits it rather than printing a placeholder.
      time: null,
      label: 'Wave 1',
    },
    copy: {
      eyebrow: 'Early access',
      heading: 'Discounted Guestlist',
      subheading:
        `Rewind, SFU's biggest back to school party. ${formatDoorDate()} at ${EVENT.venue.name}. ` +
        `Tickets go on sale at ${TICKET} plus fees. Put your name on this list and you are in ` +
        `for ${DOOR_EARLY} cash before ${P.doorCutoff}.`,

      formHeading: 'Get on the list',
      formSubheading: 'Enter the name you will give at the door.',
      submitLabel: `Claim my ${DOOR_EARLY} spot`,
      termsTitle: 'Before you submit',
      termsLines: [
        'This is an RSVP, not a ticket. Nothing is charged now.',
        `${DOOR_EARLY} cash at the door if you are checked in before ${P.doorCutoff}. ${DOOR_LATE} after.`,
        'Check your email for your confirmation and door instructions.',
      ],

      successTitle: 'You are on the list.',
      successBody: `{firstName}, your name is down for ${DOOR_EARLY} entry before ${P.doorCutoff}.`,
      confirmationNote:
        'We just sent your confirmation to {email}. Not in your inbox in five minutes? ' +
        'Check spam or promotions.',
      correctionNote:
        'Entered your name wrong? Fill the form again with the correct name and we will use ' +
        'the most recent entry.',
      alreadyTitle: 'You are already on the list.',
      alreadyBody:
        'No need to sign up twice. We have your name down, and your confirmation is already ' +
        'in your inbox.',
      closedTitle: 'The discounted guestlist is full',
      closedBody: `Tickets are the next best thing, and the first ${P.earlyBirdCount} are ${money(P.earlyBirdCents)}.`,

      venueShareNote: `We share your name with our venue partner, ${EVENT.venue.name}, for guestlist check-in only.`,
      ...CONSENT_COPY,
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
    },
  },

  'general-onsale': {
    ticketType: 'general-onsale',
    label: 'General On-Sale',
    blurb: 'Standard tickets through TicketWeb.',
    capacity: null,
    opensAt: '2026-08-24T00:00:00-07:00',
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
