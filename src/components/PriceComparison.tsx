import { FONT } from '../assets'
import { EVENT, money, savedVersusTicket } from '../config/event'
import type { Viewport } from '../lib/viewport'
import { HAIRLINE, INK, MARGIN_RED, MUTED, RULE } from './form/Field'

/**
 * What everyone else pays, then what you pay. A ledger, not a pair of cards.
 *
 * THE ARGUMENT IS THE ANCHOR AND THE TYPE SCALE, in that order. The struck-through
 * ticket price at the top is what every figure below is read against, and the early
 * rate is set several times the size of anything else on the block. That is the whole
 * persuasion. It replaces an earlier version built from two filled boxes where a black
 * panel and a 2fr/1fr grid did the same job with far more furniture.
 *
 * NO BACKGROUND, deliberately. This sits on the ruled sheet, and the old cards painted
 * over the ruling with their own near-white fill, which made the block read as
 * something pasted onto the page. Hairline rules between rows give it all the structure
 * it needs and let the paper run through, so it belongs to the sheet.
 *
 * Every figure is derived from EVENT.pricing, including the savings. That is a
 * requirement, not a preference: the TicketWeb fee inside `ticketAllInCents` is
 * unconfirmed, so a literal "$26" here (or in an exported graphic) becomes wrong the
 * moment the real fee lands. See savedVersusTicket.
 *
 * TYPE WEIGHTS ARE 500 AND 700 ONLY. index.html loads exactly those two, so a 600
 * anywhere in here silently renders as one of them. Widen the font request before
 * reaching for another weight.
 */

/**
 * `sell` is the version above the form, sized to argue. `calm` is the confirmation
 * page's: same rows, same numbers, roughly half the scale, and the accent dropped to
 * ink. It is confirming a decision that has already been made, so it states the rate
 * rather than pushing it.
 */
type Props = { vp: Viewport; variant?: 'sell' | 'calm' }

export default function PriceComparison({ vp, variant = 'sell' }: Props) {
  const p = EVENT.pricing
  const calm = variant === 'calm'
  const big = calm ? 40 : vp.isDesktop ? 60 : 46
  // A saving only earns the red when it is still trying to persuade someone.
  const accent = calm ? MUTED : MARGIN_RED

  return (
    <section
      aria-label="What you pay"
      style={{
        maxWidth: calm ? 460 : 560,
        marginTop: calm ? 24 : vp.isDesktop ? 40 : 28,
        marginBottom: calm ? 28 : vp.isDesktop ? 48 : 36,
      }}
    >
      <p style={{ ...eyebrowStyle, color: MUTED }}>Without a guestlist spot</p>

      {/* The anchor. Struck through because it is the number NOT being paid, and muted
          because it is context for the rows below rather than an offer of its own. */}
      <Row
        label="Regular ticket, with fees"
        labelStyle={{ ...rowLabelStyle, color: MUTED }}
        amount={money(p.ticketAllInCents)}
        amountSize={calm ? 22 : 26}
        amountColor={MUTED}
        struck
        borderColor={RULE}
      />

      <p style={{ ...eyebrowStyle, color: accent, marginTop: calm ? 16 : 20 }}>
        What you pay
      </p>

      <Row
        label={`Checked in before ${p.doorCutoff}`}
        labelStyle={{ ...rowLabelStyle, color: INK, fontWeight: 700 }}
        note="No ticketing fees"
        amount={money(p.doorEarlyCents)}
        amountSize={big}
        amountColor={INK}
        badge={`You save ${money(savedVersusTicket(p.doorEarlyCents))}`}
        badgeColor={accent}
        badgeWeight={calm ? 500 : 700}
        borderColor={HAIRLINE}
      />

      <Row
        label={`Checked in after ${p.doorCutoff}`}
        labelStyle={{ ...rowLabelStyle, color: MUTED }}
        note="No ticketing fees"
        amount={money(p.doorLateCents)}
        amountSize={calm ? 22 : 28}
        amountColor={MUTED}
        badge={`You save ${money(savedVersusTicket(p.doorLateCents))}`}
        badgeColor={MUTED}
        badgeWeight={500}
        borderColor={HAIRLINE}
      />
    </section>
  )
}

type RowProps = {
  label: string
  labelStyle: React.CSSProperties
  note?: string
  amount: string
  amountSize: number
  amountColor: string
  struck?: boolean
  badge?: string
  badgeColor?: string
  badgeWeight?: 500 | 700
  /** Rule UNDER the row, so every row is closed off by one. */
  borderColor: string
}

function Row({
  label,
  labelStyle,
  note,
  amount,
  amountSize,
  amountColor,
  struck = false,
  badge,
  badgeColor,
  badgeWeight = 500,
  borderColor,
}: RowProps) {
  return (
    <div
      style={{
        display: 'flex',
        // Bottom-aligned, not centred: the label sits on the same line as the base of
        // the number however many lines either side runs to, which is what makes a
        // column of very differently sized prices still read as a list.
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 0 14px',
        borderBottom: `1px solid ${borderColor}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={labelStyle}>{label}</p>
        {note && <p style={{ ...noteStyle, marginTop: 5 }}>{note}</p>}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p
          style={{
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: amountSize,
            lineHeight: '100%',
            // Tightens as it grows: at 60px the default spacing opens a gap between
            // the glyphs of "$15" that reads as two separate marks.
            letterSpacing: amountSize > 40 ? '-0.05em' : '-0.04em',
            color: amountColor,
            textDecoration: struck ? 'line-through' : undefined,
          }}
        >
          {amount}
        </p>
        {badge && (
          <p
            style={{
              ...badgeStyle,
              color: badgeColor,
              fontWeight: badgeWeight,
              marginTop: 8,
            }}
          >
            {badge}
          </p>
        )}
      </div>
    </div>
  )
}

const eyebrowStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 11,
  lineHeight: '150%',
  // Positive tracking, unlike everything else here. All-caps at 11px has no ascenders
  // or descenders to carry word shape and leans entirely on letter separation.
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  marginBottom: 2,
}

const rowLabelStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 13,
  lineHeight: '135%',
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
}

const noteStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 12,
  lineHeight: '140%',
  letterSpacing: '-0.02em',
  color: MUTED,
}

const badgeStyle = {
  fontFamily: FONT,
  fontSize: 11,
  lineHeight: '140%',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
}
