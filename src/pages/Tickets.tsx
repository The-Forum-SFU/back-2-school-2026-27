import { Navigate, useLocation } from 'react-router-dom'
import LandingShell from '../components/LandingShell'
import OutroSignup from '../components/OutroSignup'
import { useTicketsLive } from '../lib/useDropped'
import { ROUTES } from '../routes'

/**
 * `/tickets` — the ticket page, and where `/` forwards everyone from the drop onward.
 *
 * The other half of the pair. `/` redirects here while `useTicketsLive()` is true, and
 * this redirects back while it is false, so before the drop and after a manual pull this
 * address is not a page selling nothing. Both sides read the SAME predicate, which is what
 * makes a loop impossible rather than merely unlikely: for any answer it gives, exactly
 * one of the two routes wants to move.
 *
 * THIS PAGE DOES NOT SELL. It links out.
 *
 * It used to embed TicketWeb's checkout in an iframe on a sheet of paper at the end of the
 * scroll, with a plain link above the frame as an escape hatch. The frame is gone and so is
 * the sheet. A third-party checkout framed inside Instagram's in-app browser — which is
 * most of this traffic — fails often enough that the escape hatch was carrying the page,
 * and a link that always works beats a frame that usually does.
 *
 * NO `bottom`, AND THAT IS THE WHOLE MECHANISM. `LandingShell` derives `hasBottom` from it,
 * and every control that used to travel down the page reads that flag: the header renders
 * `[ TICKETS ]` as an external link rather than a scroll button, the hero rail hands the
 * countdown's slot to a plain GET TICKETS link with no arrow on it, and `useAutoAdvance`
 * switches itself off because there is nowhere to advance to. Nothing in this file has to
 * say any of that. Putting a section back below would silently turn all three into scrolls
 * again.
 *
 * `rail="countdown"` looks wrong here and is not. Past the drop DropCountdown has no time
 * left to show and hands its slot over to the ticket link, so the hero carries a way to buy
 * for anyone who never scrolls.
 *
 * What is left at the end of the scroll is the key art and one short thing to do: the
 * mailing-list strip, on the outro screen itself. See the `outro` prop on LandingShell.
 */
export default function Tickets() {
  const live = useTicketsLive()
  const { search } = useLocation()

  // Carries the query string back the same way `/` carries it forward. See the note there.
  if (!live) return <Navigate to={{ pathname: ROUTES.LANDING, search }} replace />

  return <LandingShell outro={<OutroSignup />} rail="countdown" />
}
