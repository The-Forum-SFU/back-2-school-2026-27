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
 */

export type TicketType =
  | 'presale-guestlist'
  | 'early-access'
  | 'general-onsale'
  | 'table-service'

export type ListPhase = 'before' | 'open' | 'closed' | 'full'

export type SignupCopy = {
  heading: string
  subheading: string
  submitLabel: string
  successTitle: string
  successBody: string
  alreadyTitle: string
  alreadyBody: string
  closedTitle: string
  closedBody: string
  /** Exact strings stored verbatim with each row — see submissions.consent_text. */
  ageLabel: string
  privacyLabel: string
  privacyLinkText: string
  privacyHref: string
  consentLabel: string
}

export type ListConfig = {
  ticketType: TicketType
  label: string
  blurb: string
  capacity: number | null
  /** ISO with an EXPLICIT offset — a bare string parses as local time. */
  opensAt: string
  closesAt: string
  priceCents: number
  minAge: number
  /** Only reveal scarcity near the end; "40 spots left" is not scarcity. */
  showRemainingBelow: number
  /** Discriminates the page body. Only 'signup' is implemented this pass. */
  mode: 'signup' | 'checkout' | 'inquiry'
  checkoutUrl?: string
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

  /** Taken from the landing page's own "SEPT 26". Load-bearing: the 19+ gate uses it. */
  doorDate: '2026-09-26',
  timeZone: 'America/Vancouver',

  venue: {
    name: 'Celebrities Nightclub',
    ageRestriction: '19+',
    doorsOpen: '9:30pm',
    // TODO: unconfirmed. Rendered only when non-null, so nothing shows a placeholder.
    doorsClose: null as string | null,
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

const PRIVACY_COPY = {
  ageLabel: 'I confirm I am 19 years of age or older on the night of the event.',
  privacyLabel: 'I have read and agree to the',
  privacyLinkText: 'Privacy Policy',
  privacyHref: '/privacy',
  // TODO: interim wording — final opt-in copy pending from the team. Whatever renders
  // here is stored verbatim per row, so the change is NOT retroactive. Replace before launch.
  consentLabel: 'Send me event updates and announcements by email and SMS.',
}

export const LISTS: Record<TicketType, ListConfig> = {
  'presale-guestlist': {
    ticketType: 'presale-guestlist',
    label: 'Discounted Guestlist',
    blurb: '$5 at the door. Sign up only — no payment now.',
    capacity: 75,
    opensAt: '2026-08-10T00:00:00-07:00',
    closesAt: '2026-08-25T23:59:59-07:00',
    priceCents: 500,
    minAge: 19,
    showRemainingBelow: 20,
    mode: 'signup',
    nextStep: {
      // /early-access does not exist yet. Shipping a link to a 404 is worse than
      // shipping no link, so this renders as text until that route lands.
      enabled: false,
      href: '/early-access',
      label: 'Join the Early Access List',
      availableFrom: '2026-08-20T00:00:00-07:00',
    },
    ticketDrop: {
      date: '2026-08-24',
      // TODO: drop time unconfirmed ("xxPM"). Null omits it rather than printing a placeholder.
      time: null,
      label: 'Wave 1',
    },
    copy: {
      heading: 'Discounted Guestlist',
      subheading: '$5 at the door — 75 spots',
      submitLabel: 'Claim my spot',
      successTitle: "You're on the list",
      successBody:
        'Check your email for confirmation. Bring ID — 19+, no exceptions. $5 cash at the door.',
      alreadyTitle: "You're already on the list",
      alreadyBody:
        "No need to sign up twice — we've got you. Check your email for the original confirmation.",
      closedTitle: 'RSVP Closed',
      closedBody: 'The discounted guestlist is full.',
      ...PRIVACY_COPY,
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
    showRemainingBelow: 15,
    mode: 'signup',
    nextStep: null,
    copy: {
      heading: 'Early Access List',
      subheading: 'Get in before general on-sale',
      submitLabel: 'Join the list',
      successTitle: "You're on the list",
      successBody: "We'll email you the moment Wave 1 opens.",
      alreadyTitle: "You're already on the list",
      alreadyBody: "No need to sign up twice — we've got you.",
      closedTitle: 'Early Access Closed',
      closedBody: 'The early access list is closed.',
      ...PRIVACY_COPY,
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
    showRemainingBelow: 0,
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
      ...PRIVACY_COPY,
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
    showRemainingBelow: 0,
    mode: 'inquiry',
    nextStep: null,
    copy: {
      heading: 'Table Service',
      subheading: 'Inquire about availability',
      submitLabel: 'Send inquiry',
      successTitle: 'Inquiry received',
      successBody: "We'll be in touch shortly with availability and pricing.",
      alreadyTitle: 'We already have your inquiry',
      alreadyBody: "Our team will reach out — no need to send another.",
      closedTitle: 'Table Service Closed',
      closedBody: 'Table service inquiries are closed.',
      ...PRIVACY_COPY,
    },
  },
}

/**
 * Pure phase resolution — same inputs, same answer, so it's trivially testable and
 * safe to call every render.
 *
 * `remaining` is only knowable from the server, so a client-only call can return
 * 'open' for a list that is actually full. That's why ListSection reconciles against
 * /api/list-status and lets the server win.
 */
export function resolveListPhase(
  cfg: ListConfig,
  now: Date,
  remaining?: number | null,
): ListPhase {
  if (remaining !== null && remaining !== undefined && remaining <= 0) return 'full'
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
