import { FONT } from '../assets'
import { EVENT, money, percentOff } from '../config/event'
import type { Viewport } from '../lib/viewport'
import { INK, RULE } from './form/Field'

/**
 * The regular ticket price struck through, then the two door rates.
 *
 * This is the persuasion on the page, and the size difference between the two boxes
 * is the argument: the early rate is roughly twice the late one. If you restyle this,
 * keep the 2fr/1fr split and keep the highlighted box dominant on mobile too.
 *
 * Every figure is derived from EVENT.pricing, including the percentages. That is a
 * requirement, not a preference — the TicketWeb fee the percentages divide by is
 * unconfirmed, so a literal "84% off" here (or in an exported graphic) becomes wrong
 * the moment the real fee lands.
 */

/**
 * `sell` is the version above the form, sized to argue. `calm` is the confirmation
 * page's: same numbers, same layout, roughly half the scale. It is confirming a
 * decision that has already been made, so it states the rate rather than pushing it.
 */
type Props = { vp: Viewport; variant?: 'sell' | 'calm' }

export default function PriceComparison({ vp, variant = 'sell' }: Props) {
  const p = EVENT.pricing
  const calm = variant === 'calm'

  return (
    <section
      aria-label="What you pay"
      style={{
        maxWidth: calm ? 460 : 640,
        marginTop: calm ? 24 : vp.isDesktop ? 40 : 28,
        marginBottom: calm ? 28 : vp.isDesktop ? 48 : 36,
      }}
    >
      {/*
        The struck-through "REGULAR TICKET / $23 + fees" anchor row used to sit here and
        its contents were removed. The empty wrapper went with them rather than being
        left to paint a stray rule above the boxes — restoring the row means bringing
        back both, not just the div.
      */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: vp.isMobile ? '1fr' : '2fr 1fr',
          gap: 12,
          alignItems: 'stretch',
        }}
      >
        <Rate
          when={`Before ${p.doorCutoff}`}
          amount={money(p.doorEarlyCents)}
          discount={percentOff(p.doorEarlyCents)}
          size={calm ? 44 : vp.isDesktop ? 84 : 64}
          highlighted
        />
        <Rate
          when={`After ${p.doorCutoff}`}
          amount={money(p.doorLateCents)}
          discount={percentOff(p.doorLateCents)}
          size={calm ? 26 : vp.isDesktop ? 44 : 34}
        />
      </div>
    </section>
  )
}

function Rate({
  when,
  amount,
  discount,
  size,
  highlighted = false,
}: {
  when: string
  amount: string
  discount: number
  size: number
  highlighted?: boolean
}) {
  const color = highlighted ? '#fff' : INK

  return (
    <div
      style={{
        background: highlighted ? INK : 'rgba(255,255,255,0.62)',
        border: `1px solid ${highlighted ? INK : RULE}`,
        borderRadius: 4,
        padding: highlighted ? '20px 22px 22px' : '16px 18px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        color,
        // The muted box is not just smaller type, it is quieter overall.
        opacity: highlighted ? 1 : 0.78,
      }}
    >
      <p style={{ ...labelStyle, color }}>{when}</p>
      <p
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: size,
          lineHeight: '100%',
          letterSpacing: '-0.05em',
          color,
          margin: '10px 0 12px',
        }}
      >
        {amount}
      </p>
      <p style={{ ...metaStyle, color }}>{discount}% off</p>
      <p style={{ ...metaStyle, color, opacity: 0.75 }}>No ticketing fees</p>
    </div>
  )
}

const labelStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: '-0.02em',
  textTransform: 'uppercase' as const,
  color: INK,
}

const metaStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 12,
  lineHeight: '150%',
  letterSpacing: '-0.02em',
}
