import { EventDetails } from './ListBottom'
import ListSection from './ListSection'
import { useViewport } from '../lib/viewport'

/**
 * What `/` puts on the paper sheet at the end of the landing scroll: the mailing list.
 *
 * It used to swap itself for the ticket block at the drop. That job moved up to the route:
 * `/` now forwards to `/tickets` the moment tickets are live, so by the time there is
 * anything to sell this component is not on screen to sell it. See App.tsx.
 *
 * Which means this only ever renders BEFORE the drop, or after one where the TicketWeb
 * link never landed. Both are the same situation from here: there is nothing to buy yet,
 * so take the address and mail them when there is.
 *
 * The form is the SAME component and the same fields as the guestlist route, because it
 * is the same signup; only the list behind it differs. `mailing-list` has no capacity and
 * no door rate, which is what keeps a public page from handing out discounted spots. See
 * the note on that entry in src/config/event.ts.
 *
 * No page chrome of its own, matching ListBottom: LandingShell owns the sheet, the
 * padding and the max width.
 */
export default function LandingBottom() {
  const vp = useViewport()

  return (
    <>
      <ListSection ticketType="mailing-list" />
      <EventDetails vp={vp} />
    </>
  )
}
