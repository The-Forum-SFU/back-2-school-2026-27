/**
 * Every path in the app, in one place.
 *
 * The guestlist suffix is obscurity, NOT a security boundary. Be precise about this,
 * because it used to be written up here as "the only way in is being sent the link"
 * and that is not true in production: this object ships in the entry chunk, which
 * every visitor to the public landing page downloads, so `/list-rphjpp4n` is readable
 * in devtools by anyone who loads the site. That is inherent to a client-side router
 * — it has to know a path to match it — and no client-side check can fix it.
 *
 * It is accepted deliberately. The things that actually protect the guestlist are
 * server-side and unaffected: capacity is capped at 75 in `ticket_lists` and enforced
 * inside `claim_signup` under a row lock, submissions are rate limited per IP hash,
 * and the window closes on its own. The exposure is people outside the intended
 * promoter distribution taking discounted spots, which is bounded by that cap, not
 * unbounded loss. If it ever needs to be a real boundary, that means a server-side
 * gate (a signed token checked in /api), not a longer random suffix.
 *
 * Still not linked, not indexed and not in the sitemap — see useNoIndex. Having the
 * path in two files is how one of them ends up stale and a confirmation page links
 * back to a 404, so both the router and anything that links to it read from here.
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
  /**
   * Public and INDEXABLE, unlike everything else here except the landing page.
   *
   * The signup form links to this from the notice above its submit button, and
   * `submissions.privacy_text` records that sentence verbatim as a legal record. Until
   * this route existed, that link opened the catch-all redirect and landed on the hero,
   * so the page every signup is told it agreed to was one it could never read.
   *
   * Do NOT call useNoIndex on the page behind this. A privacy policy is meant to be
   * found.
   */
  PRIVACY: '/privacy',
} as const
