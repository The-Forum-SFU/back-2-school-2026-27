import { Navigate, useLocation } from 'react-router-dom'
import LandingShell from '../components/LandingShell'
import OutroSignup from '../components/OutroSignup'
import TicketCta from '../components/TicketCta'
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
 * NO `bottom`, AND THAT IS STILL HALF THE MECHANISM. `LandingShell` derives `hasBottom`
 * from it, and the controls that used to travel down the page read that flag: the header
 * renders `[ TICKETS ]` as an external link rather than a scroll button, and
 * `useAutoAdvance` switches itself off because there is nowhere to advance to. Nothing in
 * this file has to say any of that. Putting a section back below would silently turn the
 * header into a scroll again.
 *
 * `openOnOutro` IS THE OTHER HALF, and it deletes the hero.
 *
 * There is no split-slider on this route any more. The bear was four viewports of something
 * to play with standing in front of the one screen that carried the offer, on the page every
 * ad points at from the drop onward. That screen — the key art, the date stamp, a ticket
 * link and the mailing list — is now what somebody LANDS on, the gallery is what they scroll
 * into, and the same screen closes the page. Two ways to buy on the first frame, the header
 * control and the filled link in the block below the date stamp, and neither of them is
 * four screens down.
 *
 * No `rail` either, and passing one would do nothing: the rail is a slot on a hero that no
 * longer exists. The GET TICKETS pill it used to hold is the TicketCta below.
 */
export default function Tickets() {
  const live = useTicketsLive()
  const { search } = useLocation()

  // Carries the query string back the same way `/` carries it forward. See the note there.
  if (!live) return <Navigate to={{ pathname: ROUTES.LANDING, search }} replace />

  return (
    <LandingShell
      openOnOutro
      /*
        The order is the hierarchy. Buying is what this page is for, so the filled ticket
        link goes above the two fields that are the consolation prize for not buying today.
      */
      outro={
        <>
          <TicketCta />
          <OutroSignup />
        </>
      }
    />
  )
}
