import { Navigate, useLocation } from 'react-router-dom'
import LandingShell from './components/LandingShell'
import LandingBottom from './components/LandingBottom'
import { useTicketsLive } from './lib/useDropped'
import { ROUTES } from './routes'

/**
 * `/` — the public landing page, before tickets go on sale.
 *
 * The scroll experience, the campaign key art on the outro, and a form that puts people
 * on the mailing list so the drop can be announced to them.
 *
 * ONCE TICKETS ARE LIVE THIS PAGE STOPS EXISTING and forwards to /tickets. The redirect
 * is driven by `useTicketsLive`, which is a live clock rather than a value read at mount,
 * so somebody who opened this at 11:59 to wait for noon is moved by it rather than left
 * looking at a form that has closed. `replace` keeps the back button out of a bounce.
 *
 * The forward is deliberately NOT unconditional on the date. `useTicketsLive` also asks
 * whether there is a ticket link to forward to, so a drop that arrives before the
 * TicketWeb URL does leaves this page doing what it was doing rather than sending
 * everyone somewhere empty.
 *
 * This route had no bottom section at all until tickets were announced, on the reasoning
 * that a form belongs to a route that owns a specific list. It still does. The difference
 * is that `/` now owns one: `mailing-list`, which is public, uncapped and grants nothing
 * at the door. The discounted guestlist stays where it was, on its own unlisted route, and
 * neither page can inherit the other's form.
 */
export default function App() {
  const live = useTicketsLive()
  const { search } = useLocation()

  /*
    The query string travels with them.

    `<Navigate to="/tickets">` drops it, and this is the route ads point at: after the
    drop, a click arriving on `/?fbclid=…&utm_source=ig` would have been forwarded to a
    clean URL and the attribution lost before anything read it. `captureAttribution` reads
    `location.search` and runs from a component further down the page, which by then is on
    the other side of this redirect. Carrying it across is what keeps a paid click
    attributable. It is also what makes `?preview=tickets` survive the hop.
  */
  if (live) return <Navigate to={{ pathname: ROUTES.TICKETS, search }} replace />

  return <LandingShell bottom={<LandingBottom />} rail="countdown" />
}
