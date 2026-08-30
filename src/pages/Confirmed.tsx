import { Link, useLocation } from 'react-router-dom'
import {
  CalendarButton,
  DoorPanel,
  EventDetails,
  fineStyle,
  headingStyle,
  subStyle,
} from '../components/confirmation'
import PaperPage from '../components/PaperPage'
import PriceComparison from '../components/PriceComparison'
import { INK } from '../components/form/Field'
import { calendarUrl, fill, LISTS, type TicketType } from '../config/event'
import { useNoIndex } from '../lib/useNoIndex'
import { useViewport } from '../lib/viewport'
import { ROUTES } from '../routes'

/**
 * `/confirmed` — where every signup lands, whichever list it was.
 *
 * Reached by submitting the form, never linked and never indexed. The build plan is
 * explicit that a submission ends on a page and not on an inline success message: this
 * is the most attentive that person will ever be, and it is the last chance to answer
 * a question before it becomes an argument at the door.
 *
 * WHY ROUTER STATE AND NOT A QUERY STRING. The name and email arrive through
 * `navigate(..., { state })`. Putting them in the URL would leak them into browser
 * history, into any analytics that records paths, and into the Referer header of every
 * outbound click. Router state is in memory and goes nowhere.
 *
 * The cost is that a refresh or a pasted link has no state, which is handled rather
 * than guarded: `Confirmation` renders a version with no personalisation instead of a
 * blank page or a redirect. Someone who reloads this page still needs the door
 * instructions.
 *
 * NOT the only confirmation page any more. `/vip-confirmed` serves the Brevo-hosted VIP
 * form, which has no ticket type and never reaches /api/signup. The layout both pages
 * share lives in src/components/confirmation.tsx; what stays here is everything that
 * depends on a LISTS entry, which is exactly what that page does not have.
 */

export type ConfirmedState = {
  firstName: string
  lastName: string
  email: string
  /** false when they were already on the list — same page, one different line. */
  isNew: boolean
  /**
   * Which list was joined. OPTIONAL, and defaulted to the guestlist below.
   *
   * The default is not laziness, it is back-compatibility: this page used to hardcode the
   * guestlist, so a history entry pushed before this field existed carries no value and
   * has to keep rendering the page it was written for. Every new submission sets it.
   */
  ticketType?: TicketType
}

function readState(value: unknown): ConfirmedState | null {
  if (typeof value !== 'object' || value === null) return null
  const s = value as Partial<ConfirmedState>
  if (typeof s.firstName !== 'string' || typeof s.email !== 'string') return null
  return {
    firstName: s.firstName,
    lastName: typeof s.lastName === 'string' ? s.lastName : '',
    email: s.email,
    isNew: s.isNew !== false,
    // Router state is in-memory and same-origin, but it is still not something this page
    // controls, so an unrecognised value falls back rather than indexing LISTS with it.
    ticketType: s.ticketType && s.ticketType in LISTS ? s.ticketType : undefined,
  }
}

export default function Confirmed() {
  useNoIndex()
  const vp = useViewport()
  const state = readState(useLocation().state)
  const cfg = LISTS[state?.ticketType ?? 'presale-guestlist']

  /**
   * The price comparison and the door panel belong to a list with a DOOR RATE, and only
   * the guestlist has one.
   *
   * This page rendered both unconditionally while the guestlist was the only list that
   * reached it. It is now also where the public mailing list lands, and showing that
   * person a $5-versus-$30 comparison and instructions to bring cash and arrive before
   * the cutoff would promise them a spot at the door that nobody is holding. The door
   * panel was already conditional; the comparison was not.
   */
  const hasDoorRate = cfg.priceCents > 0

  return (
    <PaperPage>
      <div style={{ maxWidth: 640 }}>
        {/*
          The headline still distinguishes a repeat submission: someone filling the form
          a second time is asking whether the first one worked, and "already" answers
          that. The BODY no longer does, because the next thing they need is their inbox
          either way, and the old version spent a paragraph explaining that they had made
          a redundant submission.
        */}
        <h1 style={headingStyle(vp)}>
          {state?.isNew === false ? cfg.copy.alreadyTitle : cfg.copy.successTitle}
        </h1>

        {/*
          No separate no-state wording any more. This sentence names nobody, so a refresh
          or a pasted link renders exactly the same correct line as a fresh submission,
          and there is no second copy of it to keep in sync. The placeholders are still
          filled so a future list can personalise this without touching the page.
        */}
        <p style={{ ...subStyle(vp), marginTop: 14 }}>
          {fill(state?.isNew === false ? cfg.copy.alreadyBody : cfg.copy.successBody, {
            firstName: state?.firstName ?? '',
            name: state ? fullName(state) : '',
            email: state?.email ?? '',
          })}
        </p>

        {hasDoorRate && <PriceComparison vp={vp} variant="calm" />}

        {cfg.doorInstructions && (
          <DoorPanel
            title={cfg.doorInstructions.title}
            // Without state we cannot name them, so the line falls back to describing
            // the name rather than printing an empty one.
            lines={cfg.doorInstructions.lines.map((line) =>
              fill(line, { name: state ? fullName(state) : 'the name you entered' }),
            )}
          />
        )}

        {cfg.copy.correctionNote && (
          <p style={{ ...fineStyle, marginTop: 14 }}>
            {cfg.copy.correctionNote}{' '}
            {/* The form THEY used. This was ROUTES.GUESTLIST unconditionally, which was
                only ever right while one list reached this page: a friends & family
                signup following it would land on the promoter form and be counted
                against the wrong pool. */}
            <Link to={cfg.formHref ?? ROUTES.GUESTLIST} style={{ color: INK }}>
              Back to the form
            </Link>
            .
          </p>
        )}

        {/* The "check your inbox" note that used to sit here is gone: the subhead above
            now says exactly that, and repeating it either side of the door panel made
            the page look like it had lost its place. */}

        <CalendarButton href={calendarUrl()} />

        <EventDetails vp={vp} />
      </div>
    </PaperPage>
  )
}

function fullName(state: ConfirmedState): string {
  return `${state.firstName} ${state.lastName}`.trim()
}
