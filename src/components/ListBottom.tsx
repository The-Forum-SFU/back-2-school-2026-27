import { FONT } from '../assets'
import { EVENT, formatDoorDate, type TicketType } from '../config/event'
import { useViewport, type Viewport } from '../lib/viewport'
import ListSection from './ListSection'
import { INK, MUTED, RULE } from './form/Field'

/**
 * What a signup route puts at the end of the landing scroll: the block for its list,
 * then the event details.
 *
 * No page chrome of its own — no logo, no min-height, no outer padding. LandingShell
 * owns all of that, so this stays a section that drops into the bottom of the scroll
 * without fighting the shell around it.
 *
 * The details below stay on the page in every phase, including once the list is full.
 * Only the form itself is ever replaced.
 */
export default function ListBottom({ ticketType }: { ticketType: TicketType }) {
  const vp = useViewport()

  return (
    <>
      <ListSection ticketType={ticketType} />
      <EventDetails vp={vp} />
    </>
  )
}

/**
 * The facts, in the order someone needs them on the night.
 *
 * Built from EVENT rather than written out, so the door date exists in exactly one
 * place — see the TODO on EVENT.doorDate. The address line renders only once there is
 * an address; an empty "Celebrities Nightclub," is worse than the venue name alone.
 *
 * Exported because LandingBottom ends with the same block. These are the venue's facts,
 * not the list's, so every route that reaches the bottom of the scroll shows them and a
 * second copy would be a second place for the door time to go stale.
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
        maxWidth: 640,
        marginTop: vp.isDesktop ? 96 : 64,
        paddingTop: vp.isDesktop ? 32 : 24,
        borderTop: `1px solid ${RULE}`,
      }}
    >
      <h3 style={{ ...lineStyle, color: MUTED, marginBottom: 14, textTransform: 'uppercase' }}>
        Event details
      </h3>
      {lines.map((line, i) => (
        <p key={line} style={{ ...lineStyle, marginTop: i === 0 ? 0 : 4 }}>
          {line}
        </p>
      ))}
    </section>
  )
}

const lineStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 13,
  lineHeight: '160%',
  letterSpacing: '-0.02em',
  color: INK,
}
