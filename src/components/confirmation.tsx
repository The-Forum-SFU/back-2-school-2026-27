import { FONT } from '../assets'
import { EVENT, formatDoorDate } from '../config/event'
import { useViewport, type Viewport } from '../lib/viewport'
import { INK, MUTED, RULE } from './form/Field'

/**
 * The pieces every confirmation page is built from: one type scale, one door panel, one
 * event details block.
 *
 * All of this was private to Confirmed.tsx while that was the only page a submission
 * could land on. There are two now — `/confirmed` for everything that writes through
 * /api/signup, and `/vip-confirmed` for the Brevo-hosted VIP form — and the facts in
 * EventDetails are the venue's, not one list's. Two hand-maintained copies of a door
 * time is how one page ends up telling people 9:30 and the other 10:00, and nobody
 * finds out until they are standing outside.
 *
 * Nothing here knows which list it is rendering for. Copy is passed in; the only values
 * these read for themselves come from EVENT, which is true for every list.
 */

/**
 * The grey panel carrying whatever a person has to do at the door.
 *
 * Takes its lines rather than reading them from a list config, because the VIP list has
 * no ListConfig to read — its form lives in Brevo and it has no ticket type. See
 * VIP_CONFIRMED_COPY in src/config/event.ts.
 *
 * One paragraph per line, not bullets. Every line here is a condition of getting in, and
 * a bulleted list invites skimming exactly the one someone cannot afford to miss.
 *
 * `marginTop` DEFAULTS TO 0 because on /confirmed nothing needs one: PriceComparison sits
 * directly above and already carries `marginBottom: 28`. /vip-confirmed has no price
 * comparison to inherit that from, so the panel would collide with the paragraph above
 * it, and it passes its own. Stated as a prop rather than left to margin collapsing —
 * these are siblings in normal flow so collapsing would in fact work, but it would make
 * this page's spacing a silent dependency on a component it does not render.
 */
export function DoorPanel({
  title,
  lines,
  marginTop = 0,
}: {
  title: string
  lines: readonly string[]
  marginTop?: number
}) {
  return (
    <section
      style={{
        marginTop,
        background: 'rgba(0,0,0,0.05)',
        border: `1px solid ${RULE}`,
        borderRadius: 4,
        padding: '16px 18px',
      }}
    >
      <h2 style={panelTitleStyle}>{title}</h2>
      <ul style={listReset}>
        {lines.map((line) => (
          <li key={line} style={panelItemStyle}>
            {line}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The event facts, at the foot of every confirmation page.
 *
 * Reads EVENT directly and takes no props on purpose: these are the same five lines
 * whichever list somebody joined, and a page that could pass its own would be a page
 * that could disagree with the door panel above it.
 */
export function EventDetails({ vp }: { vp: Viewport }) {
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

/**
 * The Add to calendar button.
 *
 * `calendarUrl()` is not called in here: it is passed in, so the one place that builds
 * the link stays the config module and this stays a button.
 */
export function CalendarButton({ href }: { href: string }) {
  const vp = useViewport()

  return (
    <a
      href={href}
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
  )
}

export function headingStyle(vp: Viewport) {
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

export function subStyle(vp: Viewport) {
  return {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: vp.isDesktop ? 19 : 16,
    lineHeight: '140%',
    letterSpacing: '-0.02em',
    color: INK,
  }
}

export const bodyStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 13,
  lineHeight: '160%',
  letterSpacing: '-0.02em',
  color: INK,
}

export const fineStyle = { ...bodyStyle, fontSize: 12, color: MUTED }

export const panelTitleStyle = {
  ...bodyStyle,
  fontSize: 12,
  textTransform: 'uppercase' as const,
  marginBottom: 8,
}

export const panelItemStyle = { ...bodyStyle, fontSize: 12, lineHeight: '150%' }

export const listReset = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
}
