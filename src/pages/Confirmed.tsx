import { Link, useLocation } from 'react-router-dom'
import { FONT } from '../assets'
import PaperPage from '../components/PaperPage'
import PriceComparison from '../components/PriceComparison'
import { INK, MUTED, RULE } from '../components/form/Field'
import { calendarUrl, EVENT, fill, formatDoorDate, LISTS } from '../config/event'
import { useNoIndex } from '../lib/useNoIndex'
import { useViewport, type Viewport } from '../lib/viewport'
import { ROUTES } from '../routes'

/**
 * `/confirmed` — where every guestlist submission lands.
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
 */

export type ConfirmedState = {
  firstName: string
  lastName: string
  email: string
  /** false when they were already on the list — same page, one different line. */
  isNew: boolean
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
  }
}

export default function Confirmed() {
  useNoIndex()
  const vp = useViewport()
  const state = readState(useLocation().state)
  const cfg = LISTS['presale-guestlist']

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

        <PriceComparison vp={vp} variant="calm" />

        {cfg.doorInstructions && (
          <section
            style={{
              background: 'rgba(0,0,0,0.05)',
              border: `1px solid ${RULE}`,
              borderRadius: 4,
              padding: '16px 18px',
            }}
          >
            <h2 style={{ ...panelTitleStyle }}>{cfg.doorInstructions.title}</h2>
            <ul style={listReset}>
              {cfg.doorInstructions.lines.map((line) => (
                <li key={line} style={panelItemStyle}>
                  {/* Without state we cannot name them, so the line falls back to
                      describing the name rather than printing an empty one. */}
                  {fill(line, { name: state ? fullName(state) : 'the name you entered' })}
                </li>
              ))}
            </ul>
          </section>
        )}

        {cfg.copy.correctionNote && (
          <p style={{ ...fineStyle, marginTop: 14 }}>
            {cfg.copy.correctionNote}{' '}
            <Link to={ROUTES.GUESTLIST} style={{ color: INK }}>
              Back to the form
            </Link>
            .
          </p>
        )}

        {/* The "check your inbox" note that used to sit here is gone: the subhead above
            now says exactly that, and repeating it either side of the door panel made
            the page look like it had lost its place. */}

        <a
          href={calendarUrl()}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 28,
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: vp.isMobile ? 15 : 17,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: '#fff',
            background: INK,
            borderRadius: 999,
            padding: vp.isMobile ? '16px 28px' : '18px 36px',
            textDecoration: 'none',
          }}
        >
          Add to calendar
        </a>

        <EventDetails vp={vp} />
      </div>
    </PaperPage>
  )
}

function fullName(state: ConfirmedState): string {
  return `${state.firstName} ${state.lastName}`.trim()
}

function EventDetails({ vp }: { vp: Viewport }) {
  const { venue } = EVENT
  const lines = [
    `${EVENT.name}: ${EVENT.tagline}`,
    formatDoorDate(),
    `Doors ${venue.doorsOpen}${venue.doorsClose ? ` to ${venue.doorsClose}` : ''}`,
    venue.address ? `${venue.name}, ${venue.address}` : venue.name,
    `${venue.ageRestriction}, ${venue.idRequirement}`,
  ]

  return (
    <section
      style={{
        marginTop: vp.isDesktop ? 72 : 56,
        paddingTop: vp.isDesktop ? 32 : 24,
        borderTop: `1px solid ${RULE}`,
      }}
    >
      <h2 style={{ ...bodyStyle, color: MUTED, marginBottom: 14, textTransform: 'uppercase' }}>
        Event details
      </h2>
      {lines.map((line, i) => (
        <p key={line} style={{ ...bodyStyle, marginTop: i === 0 ? 0 : 4 }}>
          {line}
        </p>
      ))}
    </section>
  )
}

function headingStyle(vp: Viewport) {
  return {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: vp.isDesktop ? 64 : 40,
    lineHeight: '95%',
    letterSpacing: '-0.04em',
    textTransform: 'uppercase' as const,
    color: INK,
  }
}

function subStyle(vp: Viewport) {
  return {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: vp.isDesktop ? 19 : 16,
    lineHeight: '140%',
    letterSpacing: '-0.02em',
    color: INK,
  }
}

const bodyStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 13,
  lineHeight: '160%',
  letterSpacing: '-0.02em',
  color: INK,
}

const fineStyle = { ...bodyStyle, fontSize: 12, color: MUTED }

const panelTitleStyle = {
  ...bodyStyle,
  fontSize: 12,
  textTransform: 'uppercase' as const,
  marginBottom: 8,
}

const panelItemStyle = { ...bodyStyle, fontSize: 12, lineHeight: '150%' }

const listReset = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
}
