/**
 * Every path in the app, in one place.
 *
 * The guestlist suffix is the whole security model for that page — not linked, not
 * indexed, not in the sitemap, so the only way in is being sent the link. Having it in
 * two files is how one of them ends up stale and a confirmation page links back to a
 * 404, so both the router and anything that links to it read from here.
 *
 * Changing GUESTLIST invalidates every link already sitting in a DM or a group chat.
 * Treat it as permanent once it has been shared.
 *
 * No "rewind" segment on purpose: the event gets its own subdomain, and
 * rewind.…/rewind/list-… is a stutter.
 */
export const ROUTES = {
  LANDING: '/',
  GUESTLIST: '/list-rphjpp4n',
  /** Where every guestlist submission lands. */
  CONFIRMED: '/confirmed',
  /**
   * Alias for CONFIRMED. The build plan writes this path as `/…/confirmed`; "confirmation"
   * is the spelling people reach for from memory. One redirect is cheaper than a
   * support message about a blank page.
   */
  CONFIRMATION: '/confirmation',
} as const
