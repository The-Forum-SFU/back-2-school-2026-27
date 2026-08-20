import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { captureAttribution } from '../lib/attribution'
import { initMetaPixel, trackPageView } from '../lib/metaPixel'
import { useTicketsLive } from '../lib/useDropped'
import { ROUTES } from '../routes'

/**
 * Ad tracking for the whole app. Renders nothing.
 *
 * Mounted ONCE, directly inside the router in main.tsx, above `<Routes>`. Everything it
 * does used to live in `ListSection`, which is a section of the signup form — so the
 * pixel and the attribution capture existed only on the routes that render a form.
 * That left the two most valuable pages untracked: `/tickets`, which is where every ad
 * points from the drop onward, and `/confirmed`, which is where a conversion lands.
 * Neither renders a ListSection.
 *
 * Three jobs, in this order:
 *
 *   1. Capture attribution before anything can navigate away from the landing URL.
 *   2. Initialise the pixel. Idempotent, and a no-op with no VITE_META_PIXEL_ID.
 *   3. Fire PageView once per distinct path the visitor actually lands on.
 *
 * Step 3 is the part a single-page app has to do by hand. The pixel fires its own
 * PageView on script load and never again; a client-side route change is a new page to
 * the visitor and a no-op to Meta. Without this, `/` collects every page view in the
 * session and no other route reports one.
 */
export default function PageTracking() {
  const { pathname } = useLocation()
  const ticketsLive = useTicketsLive()

  /**
   * The last path a PageView was sent for.
   *
   * A ref rather than state, because recording it must not cause a render. Never reset
   * on cleanup: under StrictMode React mounts, unmounts and remounts this in dev, and a
   * reset there would double every PageView while developing.
   */
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    captureAttribution()
    initMetaPixel()
  }, [])

  useEffect(() => {
    // A path nobody stays on is not a page view. See below.
    if (isTransient(pathname, ticketsLive)) return
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    trackPageView()
  }, [pathname, ticketsLive])

  return null
}

/**
 * Is this path one the router immediately redirects away from?
 *
 * Four of this app's paths are pure forwards, and every one of them is rendered for a
 * moment before it moves. Counting those moments would report TWO page views for one
 * visit, and it would do it to exactly the traffic that is being paid for: after the
 * drop, an ad click on `/` renders `/`, redirects to `/tickets`, and lands. One visit.
 *
 * It cannot be solved by effect ordering. The routes are lazy, so the redirect does not
 * even render until its chunk has downloaded — a network round trip AFTER this
 * component's effect has already run for the path being left. The only reliable way to
 * skip a transient path is to know which paths are transient, which is what this is.
 *
 * `ticketsLive` is the SAME predicate `/` and `/tickets` redirect on, passed in rather
 * than re-derived, so this cannot come to a different conclusion than the routes do.
 * See useTicketsLive.
 */
function isTransient(pathname: string, ticketsLive: boolean): boolean {
  // `/` forwards to `/tickets` once tickets are on sale, and `/tickets` forwards back
  // until they are. Whichever way it points, one of the two is a doorway.
  if (pathname === ROUTES.LANDING) return ticketsLive
  if (pathname === ROUTES.TICKETS) return !ticketsLive
  // A permanent alias for /confirmed, and never a destination.
  if (pathname === ROUTES.CONFIRMATION) return true
  // Everything unrecognised hits the catch-all and lands on `/`, which reports itself.
  // A mistyped guestlist link is the common case and it is not a visit to that page.
  return !KNOWN_PATHS.has(pathname)
}

const KNOWN_PATHS: ReadonlySet<string> = new Set([
  ROUTES.LANDING,
  ROUTES.TICKETS,
  ROUTES.GUESTLIST,
  ROUTES.CONFIRMED,
  ROUTES.PRIVACY,
])
