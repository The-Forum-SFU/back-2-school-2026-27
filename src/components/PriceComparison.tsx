import { FONT } from '../assets'
import { EVENT, money, percentOff, savedVersusTicket } from '../config/event'
import type { Viewport } from '../lib/viewport'
import { ACCENT_RED, HAIRLINE, INK, MUTED, RULE } from './form/Field'

/**
 * What everyone else pays, then what you pay. One graphic, read left to right.
 *
 * THE ARGUMENT IS THE ANCHOR AND THE TYPE SCALE, in that order. The struck-through
 * regular price on the left is what the figure beside it is read against, and the
 * guestlist rate is set several times the size of anything else on the block. That is
 * the whole persuasion.
 *
 * This replaces a three-row ledger. Same numbers, same rules, but the two prices that
 * carry the argument now sit SIDE BY SIDE across a divider rather than stacked as the
 * first and second entries of a list. Stacked, the anchor and the offer were two rows
 * of a table and the reader had to hold one in their head to feel the other. Beside
 * each other they are a single comparison, which is the only thing this block is for.
 *
 * The late rate moved below the rule for the same reason. It is not a third option
 * competing with the other two, it is what happens if you turn up late, so it reads as
 * a sentence rather than as a price row. Deliberately not sized to compete.
 *
 * NO BACKGROUND, deliberately. This sits on the ruled sheet, and an earlier version
 * built from filled cards painted over the ruling with its own near-white fill, which
 * made the block read as something pasted onto the page. Hairline rules give it all the
 * structure it needs and let the paper run through, so it belongs to the sheet.
 *
 * Every figure is derived from EVENT.pricing, including the savings and the "half off"
 * claim at the bottom. That is a requirement, not a preference: the TicketWeb fee inside
 * `ticketAllInCents` is unconfirmed, so a literal "$25" here (or in an exported graphic)
 * becomes wrong the moment the real fee lands. See savedVersusTicket, and the note on
 * `stillOff` below for the sentence that is easiest to get wrong.
 *
 * TYPE WEIGHTS ARE 500 AND 700 ONLY. index.html loads exactly those two, so a 600
 * anywhere in here silently renders as one of them. The source mockup for this block
 * used 600 on the small labels and the struck price; both are 500 here, which keeps the
 * mockup's own 600-against-700 contrast intact within the weights we actually ship.
 * Widen the font request before reaching for another weight.
 *
 * COPY RULE, carried over from the mockup and load-bearing: "regular door entry", never
 * "regular ticket". The guestlist spot is not a ticket, the door instructions on the
 * confirmation page depend on people holding that distinction, and a block that calls
 * the thing above it a ticket invites them to expect one.
 */

/**
 * The struck anchor only. Lighter than MUTED, which Field.tsx warns not to go past.
 *
 * That warning is about 12px fine print, where a printed blue rule crossing a line of
 * pale grey reads as a strikethrough. It does not apply to 36px display type that is
 * ALREADY struck through on purpose: there is no ambiguity left to create, and the
 * number needs to sit clearly behind the one it is being compared with.
 */
const FAINT = 'rgba(0,0,0,0.37)'

/**
 * The closing paragraph. Darker than MUTED because it is not a caption: someone who
 * arrives late is charged this, so it has to survive being read properly.
 */
const BODY = 'rgba(0,0,0,0.76)'

/**
 * `sell` is the version above the form, sized to argue. `calm` is the confirmation
 * page's: same layout, same numbers, roughly half the scale, and the accent dropped to
 * ink. It is confirming a decision that has already been made, so it states the rate
 * rather than pushing it.
 */
type Props = { vp: Viewport; variant?: 'sell' | 'calm' }

export default function PriceComparison({ vp, variant = 'sell' }: Props) {
  const p = EVENT.pricing
  const calm = variant === 'calm'
  const mobile = vp.isMobile

  /**
   * "Half off" is a CLAIM, not a label, and it is true only while the late rate is
   * exactly half the anchor. Both sides move with the unconfirmed TicketWeb fee, so
   * this checks the arithmetic every render and falls back to the real percentage
   * rather than letting a fee change quietly turn the sentence into a lie.
   */
  const stillOff =
    p.doorLateCents * 2 === p.ticketAllInCents
      ? 'half off'
      : `${percentOff(p.doorLateCents)}% off`

  return (
    <section
      aria-label="What you pay"
      style={{
        maxWidth: calm ? 520 : 720,
        marginTop: calm ? 24 : vp.isDesktop ? 40 : 28,
        marginBottom: calm ? 28 : vp.isDesktop ? 48 : 36,
      }}
    >
      <div
        style={{
          display: 'flex',
          // Stretch plus `marginTop: auto` on each body is what bottom-aligns the two
          // columns. Their heads are wildly different heights and their prices differ
          // by a factor of three, so aligning anything at the TOP leaves the struck
          // anchor floating beside the middle of the number it is anchoring.
          alignItems: 'stretch',
          ...(mobile
            ? { flexDirection: 'column', gap: 22 }
            : { gap: 'clamp(20px, 5vw, 48px)' }),
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            ...(mobile
              ? { paddingBottom: 20, borderBottom: `1px solid ${HAIRLINE}` }
              : {
                  // Narrow on purpose. The anchor is context, and a column wide enough
                  // to balance the offer would make it look like an alternative.
                  flex: '0 0 clamp(112px, 20%, 148px)',
                  paddingRight: 'clamp(18px, 4vw, 36px)',
                  borderRight: `1px solid ${HAIRLINE}`,
                }),
          }}
        >
          <div style={headSlot(mobile)}>
            <p style={labelStyle}>Regular door entry</p>
          </div>

          <div style={bodySlot(mobile)}>
            <p
              style={{
                ...priceStyle,
                fontSize: mobile ? 40 : calm ? 30 : 'clamp(2.25rem, 7vw, 3.25rem)',
                lineHeight: '95%',
                letterSpacing: '-0.03em',
                color: FAINT,
                textDecoration: 'line-through',
                // Scales with nothing: at the default hairline the rule reads as a
                // printed line crossing the number rather than as a strikethrough.
                textDecorationThickness: 3,
                marginBottom: mobile ? 4 : 8,
              }}
            >
              {money(p.ticketAllInCents)}
            </p>
            <p style={subStyle(calm)}>With fees</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto' }}>
          <div style={headSlot(mobile)}>
            <p style={labelStyle}>With discounted guestlist</p>
            {/* The condition attached to the price, sitting with it rather than under
                it. This is the one thing on the block someone can fail to do. */}
            <p
              style={{
                ...labelStyle,
                letterSpacing: '0.1em',
                fontWeight: 700,
                color: INK,
              }}
            >
              Checked in before{' '}
              <span style={{ color: calm ? INK : ACCENT_RED }}>{p.doorCutoff}</span>
            </p>
          </div>

          <div style={bodySlot(mobile)}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: mobile ? 14 : 'clamp(14px, 3vw, 26px)',
                marginBottom: 10,
              }}
            >
              <p
                style={{
                  ...priceStyle,
                  fontSize: calm ? 'clamp(3rem, 11vw, 4.25rem)' : 'clamp(4.5rem, 19vw, 8.5rem)',
                  lineHeight: '80%',
                  // Tighter than anything else on the page. At this size the default
                  // spacing opens a gap between the glyphs that reads as two marks.
                  letterSpacing: '-0.055em',
                  fontWeight: 700,
                  color: INK,
                }}
              >
                {money(p.doorEarlyCents)}
              </p>

              {/* Outlined rather than filled on the confirmation page. The shape and the
                  layout stay identical, so the two pages are recognisably the same
                  block, but a red slab is a pitch and this page has nothing left to
                  pitch. */}
              <p
                style={{
                  fontFamily: FONT,
                  fontWeight: 700,
                  fontSize: calm ? 12 : 'clamp(0.75rem, 1.7vw, 0.875rem)',
                  lineHeight: '100%',
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  borderRadius: 999,
                  padding: '10px 18px',
                  ...(calm
                    ? { color: INK, border: `1px solid ${RULE}` }
                    : { color: '#fff', background: ACCENT_RED, border: '1px solid transparent' }),
                }}
              >
                Save {money(savedVersusTicket(p.doorEarlyCents))}
              </p>
            </div>
            <p style={subStyle(calm)}>No fees</p>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: calm ? 24 : 'clamp(24px, 4.5vw, 36px)',
          paddingTop: calm ? 16 : 'clamp(16px, 2.6vw, 22px)',
          borderTop: `1px solid ${HAIRLINE}`,
          // Measured in characters, not pixels: this is the only real paragraph on the
          // block and 58ch is a line length that stays readable at every size below.
          maxWidth: '58ch',
        }}
      >
        <p
          style={{
            ...labelStyle,
            fontWeight: 700,
            color: calm ? MUTED : ACCENT_RED,
            marginBottom: 7,
          }}
        >
          Checked in after {p.doorCutoff}
        </p>
        <p
          style={{
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: calm ? 15 : 'clamp(0.9375rem, 2vw, 1rem)',
            lineHeight: '155%',
            letterSpacing: '-0.02em',
            color: BODY,
          }}
        >
          You will be charged the regular discounted guestlist rate at{' '}
          <strong style={{ color: INK, fontWeight: 700 }}>{money(p.doorLateCents)}</strong>.
          That is still {stillOff}!
        </p>
      </div>
    </section>
  )
}

/**
 * Reserves a fixed head height so the two columns' bodies bottom-align against each
 * other rather than against whatever their own labels happened to wrap to. Two lines of
 * label at 11px/150% is 33px; the extra room is for the third line the right-hand label
 * takes at tablet widths, which would otherwise push its price out of line with the
 * anchor. Collapsed on mobile, where the columns are stacked and there is nothing to
 * align to.
 */
const headSlot = (mobile: boolean) => (mobile ? undefined : { minHeight: 52 })

const bodySlot = (mobile: boolean) => ({
  marginTop: 'auto',
  paddingTop: mobile ? 8 : 'clamp(8px, 2vw, 14px)',
})

const priceStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  color: INK,
}

const labelStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 11,
  lineHeight: '150%',
  // Positive tracking, unlike everything else here. All-caps at 11px has no ascenders
  // or descenders to carry word shape and leans entirely on letter separation.
  letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
  color: MUTED,
}

const subStyle = (calm: boolean) => ({
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: calm ? 14 : 15,
  lineHeight: '140%',
  letterSpacing: '-0.02em',
  color: MUTED,
})
