import { Navigate, useLocation } from 'react-router-dom'
import LandingShell from '../components/LandingShell'
import { EventDetails } from '../components/ListBottom'
import TicketsSection from '../components/TicketsSection'
import { useTicketsLive } from '../lib/useDropped'
import { useViewport } from '../lib/viewport'
import { ROUTES } from '../routes'

/**
 * `/tickets` — the ticket page, and where `/` forwards everyone from the drop onward.
 *
 * Same scroll experience and same key art as the landing page; only the sheet at the end
 * differs, which is the whole reason LandingShell takes `bottom` as a prop.
 *
 * The other half of the pair. `/` redirects here while `useTicketsLive()` is true, and
 * this redirects back while it is false, so before the drop and after a manual pull this
 * address is not a page selling nothing. Both sides read the SAME predicate, which is what
 * makes a loop impossible rather than merely unlikely: for any answer it gives, exactly
 * one of the two routes wants to move.
 *
 * `rail="countdown"` looks wrong here and is not. Past the drop DropCountdown has no time
 * left to show and hands its slot over to a GET TICKETS pill, so the hero carries a way to
 * buy for anyone who never scrolls. It duplicates the embed below on purpose: a framed
 * third-party checkout is the most likely thing on this page to come up blank, and a plain
 * link out is what survives that.
 */
export default function Tickets() {
  const live = useTicketsLive()
  const { search } = useLocation()

  // Carries the query string back the same way `/` carries it forward. See the note there.
  if (!live) return <Navigate to={{ pathname: ROUTES.LANDING, search }} replace />

  return <LandingShell bottom={<TicketsBottom />} rail="countdown" />
}

function TicketsBottom() {
  const vp = useViewport()
  return (
    <>
      <TicketsSection vp={vp} />
      <EventDetails vp={vp} />
    </>
  )
}
