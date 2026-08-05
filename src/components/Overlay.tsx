import { motion } from 'motion/react'
import { FONT, LOGO_BEAR, LOGO_WORDMARK } from '../assets'
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

export function HeaderNav({ vp }: { vp: Viewport }) {
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
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: vp.isDesktop ? 15 : 13,
          color: '#fff',
          whiteSpace: 'nowrap',
        }}
      >
        [ TICKETS ]
      </span>
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

export function ViewButton({ vp }: { vp: Viewport }) {
  const desktop = vp.isDesktop

  return (
    <div
      id="outro-buy"
      style={{
        ...overlayBase,
        ...(desktop
          ? { right: 32, bottom: 32, width: 330, height: 174 }
          : { left: 16, right: 16, bottom: 60, height: 100 }),
        transformOrigin: 'right bottom',
        transform: 'scale(0)',
        background: '#fff',
        borderRadius: 1335,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: desktop ? 110 : 72,
          lineHeight: '100%',
          letterSpacing: '-0.04em',
          color: '#fff',
          mixBlendMode: 'exclusion',
        }}
      >
        view
      </span>
    </div>
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
