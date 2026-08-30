/**
 * Every path in the app, in one place.
 *
 * A guestlist suffix is obscurity, NOT a security boundary. Be precise about this,
 * because it used to be written up here as "the only way in is being sent the link"
 * and that is not true in production: this object ships in the entry chunk, which
 * every visitor to the public landing page downloads, so every `/list-…` path is
 * readable in devtools by anyone who loads the site. That is inherent to a client-side
 * router — it has to know a path to match it — and no client-side check can fix it.
 *
 * It is accepted deliberately. The things that actually protect a guestlist are
 * server-side and unaffected: each list has its own capacity in `ticket_lists`,
 * enforced inside `claim_signup` under a row lock, submissions are rate limited per IP
 * hash, and the window closes on its own. The exposure is people outside the intended
 * promoter distribution taking discounted spots, which is bounded by that cap, not
 * unbounded loss. If it ever needs to be a real boundary, that means a server-side
 * gate (a signed token checked in /api), not a longer random suffix.
 *
 * Still not linked, not indexed and not in the sitemap — see useNoIndex. Having a
 * path in two files is how one of them ends up stale and a confirmation page links
 * back to a 404, so both the router and anything that links to it read from here.
 *
 * Changing either guestlist path invalidates every link already sitting in a DM or a
 * group chat. Treat them as permanent once they have been shared.
 *
 * No "rewind" segment on purpose: the event gets its own subdomain, and
 * rewind.…/rewind/list-… is a stutter.
 */
export const ROUTES = {
  LANDING: '/',
  GUESTLIST: '/list-rphjpp4n',
  /**
   * The friends & family guestlist. Same page as GUESTLIST above, same door rate, its
   * own route and — the part that matters — its own `ticket_type`, so its cap of 75
   * counts only its own signups. See LISTS['friends-family'] in src/config/event.ts.
   *
   * A SEPARATE PATH, not a query string on the one above. `?list=friends` would put the
   * choice of list in the hands of whoever holds the original link, and a person who
   * found `/list-rphjpp4n` could walk into whichever pool still had room. Two paths mean
   * two audiences that can only spend their own allocation.
   *
   * Same permanence rule as GUESTLIST: once this is in a group chat, it is fixed.
   */
  FRIENDS_GUESTLIST: '/list-8h7uimig',
  /** Where every guestlist submission lands. */
  CONFIRMED: '/confirmed',
  /**
   * Where the VIP guest list lands, and the one route here that nothing in this app
   * navigates to.
   *
   * The VIP form is a Brevo-hosted document at public/vip.html, outside the router
   * entirely, so the only way anyone arrives is Brevo's own "after submission → redirect
   * to a URL" setting pointing at this path. That is a dashboard setting, not code: until
   * somebody flips it, this page is correct and unreachable.
   *
   * A cold page load with no router state, therefore, ALWAYS. VipConfirmed takes no state
   * and reads none — see the note on VIP_CONFIRMED_COPY in src/config/event.ts.
   *
   * Guessable on purpose, unlike the two list routes above. There is nothing on it worth
   * protecting: no name, no email, no offer, and no way to join anything from it. It is
   * still noindex, because a confirmation page has no business in search results.
   *
   * Not '/vip/confirmed': `/vip` is a rewrite to a static file in vercel.json, and a path
   * underneath it would read like it belongs to that document rather than to the SPA.
   */
  VIP_CONFIRMED: '/vip-confirmed',
  /**
   * Alias for CONFIRMED. The build plan writes this path as `/…/confirmed`; "confirmation"
   * is the spelling people reach for from memory. One redirect is cheaper than a
   * support message about a blank page.
   */
  CONFIRMATION: '/confirmation',
  /**
   * The ticket page, and where `/` sends everyone once tickets are on sale.
   *
   * A separate route rather than a section that swaps in place, so the two states of this
   * campaign are two addresses: before the drop `/` collects addresses, after it `/`
   * redirects here and this sells. That means a link posted on the day lands on a page
   * that is about buying rather than on a page that used to be about waiting, and the
   * redirect is live, so a tab already open on `/` at 11:59 moves itself at noon.
   *
   * The redirect runs BOTH ways and off one predicate, `useTicketsLive`, which is what
   * makes a loop impossible: whichever answer it gives, exactly one of the two routes
   * wants to redirect. Before the drop this one sends people back to `/`.
   *
   * Public and indexable. Do not call useNoIndex on it.
   */
  TICKETS: '/tickets',
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
