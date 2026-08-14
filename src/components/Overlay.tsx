import { motion } from 'motion/react'
import { FONT, LOGO_BEAR, LOGO_WORDMARK } from '../assets'
import { EVENT } from '../config/event'
import type { Viewport } from '../lib/viewport'

const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1]
const DURATION = 0.6

/** Entry animation: fade up. Staggered by `delay` across the overlay. */
const riseIn = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION, ease: EASE, delay },
})

const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: DURATION, ease: EASE, delay },
})

/** Every overlay layer sits above the panel and never eats pointer events. */
const overlayBase = {
  position: 'fixed' as const,
  pointerEvents: 'none' as const,
  zIndex: 20,
  mixBlendMode: 'exclusion' as const,
}

/** Intrinsic height/width of the two logo files. */
const BEAR_ASPECT = 184 / 190
const WORD_ASPECT = 143 / 1100

/**
 * Bear badge + "THE FORUM" wordmark, rendered as two independent fixed layers
 * rather than one flex row.
 *
 * They have to stay separate because they need opposite blending: the bear is
 * full colour and must not be touched, while the wordmark is white and relies
 * on `exclusion` to read black over the light hero and white over the black
 * panel. Nesting them would break both — a parent that creates a stacking
 * context confines a child's blending to that context, so an inner wordmark
 * never sees the page backdrop and just stays white. Keeping `mixBlendMode` and
 * the animated `opacity` on the same top-level element is what makes it blend
 * correctly through the entry fade.
 */
export function LogoMark({ vp }: { vp: Viewport }) {
  const width = vp.isMobile ? 150 : vp.isTablet ? 266 : 355
  const inset = vp.isMobile ? 16 : 32

  const bearWidth = Math.round(width * 0.18)
  const gap = Math.round(width * 0.05)
  const wordWidth = width - bearWidth - gap

  // Optically centre the wordmark against the taller bear badge.
  const bearHeight = bearWidth * BEAR_ASPECT
  const wordHeight = wordWidth * WORD_ASPECT
  const wordTop = inset + (bearHeight - wordHeight) / 2

  return (
    <>
      <motion.div
        {...riseIn(0)}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 20,
          top: inset,
          left: inset,
          width: bearWidth,
        }}
      >
        <img
          src={LOGO_BEAR}
          alt="The Forum University"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </motion.div>

      <motion.div
        {...riseIn(0)}
        style={{
          ...overlayBase,
          top: wordTop,
          left: inset + bearWidth + gap,
          width: wordWidth,
        }}
      >
        <img
          src={LOGO_WORDMARK}
          alt=""
          aria-hidden="true"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </motion.div>
    </>
  )
}

export function Caption({ vp }: { vp: Viewport }) {
  return (
    <motion.div
      {...riseIn(0.3)}
      style={{
        ...overlayBase,
        left: vp.isMobile ? 16 : 32,
        top: vp.isDesktop ? 244 : vp.isTablet ? 180 : 118,
        width: vp.isDesktop ? 692 : vp.isTablet ? 'calc(50vw - 48px)' : 'calc(100vw - 32px)',
        fontFamily: FONT,
        fontWeight: 500,
        fontSize: 12,
        lineHeight: '140%',
        letterSpacing: '-0.04em',
        color: '#FFFFFF',
      }}
    >
      Back 2 School 2026 - Low-rise, glitter, chrome, and everything 2001 forgot to leave behind.
    </motion.div>
  )
}

/** Jumps to the signup section below the scroll experience. */
function scrollToSignup() {
  const el = document.getElementById('signup')
  if (!el) return
  // Instant, not smooth. The RAF loop renders every intermediate frame, so smooth-
  // scrolling five viewports would strobe the panel slide, the card scale-ins and the
  // outro fade past in about a second.
  window.scrollTo({ top: el.offsetTop })
}

/**
 * [ TICKETS ], top right.
 *
 * `overlayBase` disables pointer events for every layer, so an interactive element
 * re-enables them on itself only.
 *
 * Three states, in priority order: an external link once General On-Sale opens, a
 * jump to the signup section on a route that has one, and otherwise plain inert text
 * — a route with no bottom section has nowhere to send anyone, and a button that
 * silently does nothing is worse than a label.
 */
export function HeaderNav({ vp, hasBottom }: { vp: Viewport; hasBottom: boolean }) {
  const external = EVENT.tickets.enabled && EVENT.tickets.url

  const textStyle = {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: vp.isDesktop ? 15 : 13,
    color: '#fff',
    whiteSpace: 'nowrap' as const,
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    pointerEvents: 'auto' as const,
    textDecoration: 'none',
    letterSpacing: 'inherit',
  }

  return (
    <motion.div
      {...riseIn(0.15)}
      style={{
        ...overlayBase,
        top: vp.isMobile ? 16 : 32,
        right: vp.isMobile ? 16 : 32,
        height: 30,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
    >
      {external ? (
        <a href={EVENT.tickets.url} target="_blank" rel="noopener noreferrer" style={textStyle}>
          [ TICKETS ]
        </a>
      ) : hasBottom ? (
        <button type="button" onClick={scrollToSignup} style={textStyle}>
          [ TICKETS ]
        </button>
      ) : (
        <span style={{ ...textStyle, cursor: 'default', pointerEvents: 'none' }}>
          [ TICKETS ]
        </span>
      )}
    </motion.div>
  )
}

/**
 * Hero affordance that skips the scroll experience and lands on the form.
 *
 * Sits below the Caption on the same left rail, and inherits the exclusion blending
 * so it reads correctly over both the light hero and the black panel.
 */
export function ScrollCue({ vp }: { vp: Viewport }) {
  return (
    <motion.div
      {...riseIn(0.45)}
      style={{
        ...overlayBase,
        left: vp.isMobile ? 16 : 32,
        top: vp.isDesktop ? 300 : vp.isTablet ? 236 : 174,
      }}
    >
      <button
        type="button"
        onClick={scrollToSignup}
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: vp.isDesktop ? 15 : 13,
          letterSpacing: '-0.02em',
          textTransform: 'uppercase',
          color: '#fff',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          pointerEvents: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        [ GET ON THE LIST ↓ ]
      </button>
    </motion.div>
  )
}

export function EventInfo({ vp }: { vp: Viewport }) {
  const desktop = vp.isDesktop
  const circle = desktop ? 30 : 20

  return (
    <motion.div
      id="outro-info"
      data-outro-offset={desktop ? 166 : 132}
      {...fadeIn(0.45)}
      style={{
        ...overlayBase,
        ...(desktop
          ? { right: 32, bottom: 80, width: 330 }
          : { left: 0, right: 0, bottom: 48 }),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Shrink-wraps to the width of "BACK 2 SCHOOL" so the badge can sit on
          the text's left edge while the group as a whole stays centred on the
          same axis as "SEPT 26" and the view button. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          marginBottom: desktop ? 32 : 12,
        }}
      >
        {/* Hangs left of the text's edge so the badge reads as a deliberate
            offset mark rather than a flush-aligned bullet. The negative margin
            overflows the block without widening it, so the text below stays
            centred on the same axis as "SEPT 26". */}
        <div
          style={{
            position: 'relative',
            width: circle,
            height: circle,
            marginLeft: desktop ? -12 : -8,
          }}
        >
          <svg
            width={circle}
            height={circle}
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="20"
              cy="20"
              r="18.75"
              stroke="#fff"
              strokeWidth={desktop ? 2.5 : 2}
            />
          </svg>
          <span
            id="circle-symbol"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT,
              fontWeight: 500,
              // A single glyph can carry more weight than the old 3-character
              // "Y2K" did in the same circle.
              fontSize: desktop ? 17 : 12,
              lineHeight: 1,
              letterSpacing: '-0.04em',
              textTransform: 'uppercase',
              color: '#fff',
            }}
          >
            ★
          </span>
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: desktop ? 30 : 20,
            lineHeight: '100%',
            textAlign: 'center',
            letterSpacing: '-0.04em',
            textTransform: 'uppercase',
            color: '#fff',
          }}
        >
          BACK 2 SCHOOL
          <br />
          &ldquo;2026&rdquo;
        </div>
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: desktop ? 80 : 60,
          lineHeight: '100%',
          textAlign: 'center',
          letterSpacing: '-0.04em',
          color: '#fff',
        }}
      >
        SEPT 26
      </div>
    </motion.div>
  )
}

export function Footer({ vp }: { vp: Viewport }) {
  const desktop = vp.isDesktop
  const textStyle = {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: desktop ? 13 : 11,
    letterSpacing: '-0.02em',
    textTransform: 'uppercase' as const,
    color: '#fff',
    whiteSpace: 'nowrap' as const,
  }

  return (
    <div
      id="outro-footer"
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 20,
        mixBlendMode: 'exclusion',
        left: 16,
        right: desktop ? undefined : 16,
        bottom: desktop ? 32 : 24,
        opacity: 0,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: desktop ? 80 : undefined,
        justifyContent: desktop ? undefined : 'space-between',
      }}
    >
      <span style={textStyle}>The Forum University 2026</span>
      <span style={textStyle}>Privacy Policy</span>
    </div>
  )
}
