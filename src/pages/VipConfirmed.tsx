import {
  CalendarButton,
  DoorPanel,
  EventDetails,
  headingStyle,
  subStyle,
} from '../components/confirmation'
import PaperPage from '../components/PaperPage'
import { calendarUrl, VIP_CONFIRMED_COPY } from '../config/event'
import { useNoIndex } from '../lib/useNoIndex'
import { useViewport } from '../lib/viewport'

/**
 * `/vip-confirmed` — where the VIP guest list lands.
 *
 * The same page as /confirmed next door, built from the same three blocks in
 * src/components/confirmation.tsx, and deliberately so: somebody who joined this list
 * should not be able to tell they were handled by a different system.
 *
 * Everything that makes it a different FILE rather than a branch inside Confirmed comes
 * from one fact — this list has no ListConfig. Confirmed is driven end to end by
 * `LISTS[ticketType]`: the headline, the body, the door panel and the "back to the form"
 * link all read off it, and it picks the entry out of router state. The VIP form is
 * hosted by Brevo, has no ticket type, writes nothing to Supabase, and arrives here on a
 * cold redirect with no state at all. A `ticketType ? … : …` in that component would have
 * been a second page wearing the first one's clothes.
 *
 * NO PriceComparison IMPORT, and that is the point of the page rather than an omission.
 * Confirmed gates it on `cfg.priceCents > 0`; this list is free entry, so there is no
 * door rate, nothing to compare, and no gate to write. Same for the door panel's cash
 * line and the arrival cutoff — see VIP_CONFIRMED_COPY.
 *
 * No useLocation and no state type. Nothing navigates here from inside the app, so there
 * is nothing to read and no personalisation to lose.
 */
export default function VipConfirmed() {
  useNoIndex()
  const vp = useViewport()

  return (
    <PaperPage>
      <div style={{ maxWidth: 640 }}>
        <h1 style={headingStyle(vp)}>{VIP_CONFIRMED_COPY.title}</h1>

        <p style={{ ...subStyle(vp), marginTop: 14 }}>{VIP_CONFIRMED_COPY.body}</p>

        {/* Its own marginTop, because the PriceComparison that supplies the gap on
            /confirmed is exactly what this page does not have. See DoorPanel. */}
        <DoorPanel
          title={VIP_CONFIRMED_COPY.doorTitle}
          lines={VIP_CONFIRMED_COPY.doorLines}
          marginTop={28}
        />

        <CalendarButton href={calendarUrl()} />

        <EventDetails vp={vp} />
      </div>
    </PaperPage>
  )
}
