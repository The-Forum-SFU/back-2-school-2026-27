import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { FONT, LOGO_BEAR, LOGO_WORDMARK } from '../assets'
import { EVENT, formatDoorStamp, HERO_COPY } from '../config/event'
import { scrollToSignup } from '../lib/scrollToSignup'
import type { Viewport } from '../lib/viewport'
import { ROUTES } from '../routes'

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

/**
 * The plain wrapper is what the scroll engine fades, and it has to be plain.
 *
 * The engine writes `style.opacity` on `#hero-caption` to take this off screen during the
 * outro, and the element inside ALREADY animates opacity through Motion on entry. Writing
 * to a property Motion owns is how you get one of them silently winning. So the entry
 * animation stays on the inner element and the scroll-driven fade gets its own.
 *
 * `mixBlendMode` moves up here with it. It has to sit on the outermost element or the
 * blend is confined to a stacking context that never sees the page backdrop, which is the
 * trap documented in the README. Blending applies to the whole subtree as a group, so the
 * text inside still inverts correctly.
 */
export function Caption({ vp }: { vp: Viewport }) {
  return (
    <div
      id="hero-caption"
      style={{
        ...overlayBase,
        left: vp.isMobile ? 16 : 32,
        top: vp.isDesktop ? 244 : vp.isTablet ? 180 : 118,
        width: vp.isDesktop ? 692 : vp.isTablet ? 'calc(50vw - 48px)' : 'calc(100vw - 32px)',
      }}
    >
    <motion.div
      {...riseIn(0.3)}
      style={{
        fontFamily: FONT,
        fontWeight: 500,
        fontSize: 12,
        lineHeight: '140%',
        letterSpacing: '-0.04em',
        color: '#FFFFFF',
      }}
    >
      {/*
        Keep EACH LINE short. The caption sits on the left rail in an exclusion group,
        and the hero artwork starts around 450px in: any line long enough to reach it
        inverts against the bear instead of the white behind it, and the tail of the
        sentence turns colour.

        Two block-level lines rather than one run of text is what buys the headroom.
        This used to be a single sentence carrying the name, the kicker and a flavour
        line, which at ~82 characters was already past that 450px mark on one line and
        relied on the wrap landing somewhere kind.
      */}
      <div>{HERO_COPY.headline}</div>
      <div style={{ marginTop: 4 }}>{HERO_COPY.subline}</div>
    </motion.div>
    </div>
  )
}


/**
 * The header control, top right.
 *
 * `overlayBase` disables pointer events for every layer, so an interactive element
 * re-enables them on itself only.
 *
 * Three states. What it SAYS is decided by whether tickets are on sale; what it DOES is
 * decided by whether this route has a section below:
 *
 *   has a section     scrolls to it, labelled [ TICKETS ] when selling, [ RSVP ] before
 *   selling, no section   links out to TicketWeb
 *   neither           plain inert text, because a button that silently does nothing is
 *                     worse than a label
 *
 * Splitting those two questions is what fixed `/tickets`. It used to link out the moment
 * tickets were live, which on the one page that has the checkout embedded in it meant the
 * header sent people away from the thing they were standing on. The external escape hatch
 * still exists and belongs next to the frame that might fail, not in the header.
 *
 * `ticketsLive` is passed in rather than read here, and the distinction it draws matters:
 * the TicketWeb URL went into config days before the sale opened, so a check for the URL
 * alone put a live [ TICKETS ] link on the header of a page counting down to the drop.
 * Following it landed on a real TicketWeb page selling nothing. The shell computes this
 * from the same live clock that swaps the section below, so the header and the section
 * can never disagree about whether tickets exist.
 *
 * All three stay bracketed text. The brackets ARE the affordance in this header, and
 * the hero's one real button is the cue on the left rail — a second boxed control up
 * here would split the emphasis rather than add to it. Bigger type is the whole change.
 */
export function HeaderNav({
  vp,
  hasBottom,
  ticketsLive,
}: {
  vp: Viewport
  hasBottom: boolean
  ticketsLive: boolean
}) {
  const external = ticketsLive && EVENT.tickets.url && !hasBottom

  const textStyle = {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: vp.isDesktop ? 19 : 16,
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
        /*
          The label follows what is actually down there. "RSVP" on a route whose section is
          a list form, where nothing is charged and no ticket is issued: a header that
          promises tickets and delivers a signup is the mismatch people bounce on. The same
          scroll reads "TICKETS" on the route whose section is the checkout.
        */
        <button type="button" onClick={scrollToSignup} style={textStyle}>
          {ticketsLive ? '[ TICKETS ]' : '[ RSVP ]'}
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
 * The one slot on the hero's left rail, below the Caption, that carries a route's
 * main thing to look at.
 *
 * Shared rather than written twice because two different components occupy it and
 * only ever one at a time: ScrollCue on a route with a form below it, DropCountdown
 * on a route without. They have to land in exactly the same place, and the mobile
 * clearance below depends on it — HeroCanvas.MOBILE_TOP crops the artwork at 244 and
 * is sized against whatever sits here, so a taller occupant means moving that number
 * too. Anything placed here should stay under about 60px tall.
 *
 * Centred on mobile, where the occupant sits alone in the white band above the hero
 * rather than on a rail with anything to align to.
 */
export function heroRailSlot(vp: Viewport) {
  return {
    ...overlayBase,
    ...(vp.isMobile
      ? { left: 0, right: 0, display: 'flex', justifyContent: 'center' }
      : { left: 32 }),
    top: vp.isDesktop ? 300 : vp.isTablet ? 236 : 174,
  }
}

/**
 * The rail slot as an element, so both occupants land in the same DOM shape.
 *
 * Exists for the same reason as the wrapper on Caption: the scroll engine fades
 * `#hero-rail` out across the outro, and it cannot do that on an element Motion is
 * already animating the opacity of. The wrapper is plain and carries the position and
 * the blend; the occupant animates itself inside it.
 *
 * Fading out at all is a decision worth stating. The countdown and the caption are the
 * HERO's copy, and the outro is four viewports past it: leaving them on screen there kept
 * a clock and a tagline sitting over the key art, and there was no room for the artwork
 * with them in place. The [ RSVP ] control in the header does not fade, so the affordance
 * survives the handoff even though this does.
 */
export function HeroRail({ vp, children }: { vp: Viewport; children: ReactNode }) {
  return (
    <div id="hero-rail" style={heroRailSlot(vp)}>
      {children}
    </div>
  )
}

/**
 * The pill on the hero rail, as one style rather than three copies of it.
 *
 * Three controls wear it and only ever one at a time: the ScrollCue below, the RSVP
 * under the countdown, and the GET TICKETS link the countdown turns into after the drop.
 * They have to be the same object, or the same position on the same rail changes size
 * depending on the date.
 *
 * Outlined, never filled. The whole overlay blends with `exclusion`, so a solid fill
 * inverts as a slab and reads as a hole punched in the artwork, while an outline inverts
 * as a hairline and keeps the hero visible through the button. `lineHeight: 1` is what
 * makes the padding symmetric; the font's own line box would otherwise sit the label low.
 *
 * `small` is the compact variant, for when the pill is stacked UNDER something rather
 * than sitting on the rail alone. Mobile is the constraint: HeroCanvas crops the artwork
 * at MOBILE_TOP and everything in this slot has to clear it, so the countdown plus a
 * full-size pill would run into the bear. See the note on MOBILE_TOP in HeroCanvas.
 */
export function railPillStyle(vp: Viewport, small = false) {
  const desktop = vp.isDesktop
  return {
    display: 'inline-block',
    fontFamily: FONT,
    fontWeight: 500 as const,
    fontSize: desktop ? (small ? 16 : 19) : small ? 13 : 16,
    lineHeight: 1,
    letterSpacing: '-0.02em',
    textTransform: 'uppercase' as const,
    color: '#fff',
    background: 'none',
    border: `${desktop ? 2 : 1.5}px solid #fff`,
    borderRadius: 999,
    padding: desktop
      ? small
        ? '13px 26px'
        : '16px 32px'
      : small
        ? '10px 20px'
        : '13px 24px',
    cursor: 'pointer',
    pointerEvents: 'auto' as const,
    whiteSpace: 'nowrap' as const,
    textDecoration: 'none',
  }
}

/**
 * Hero affordance that skips the scroll experience and lands on the form.
 *
 * Sits in the rail slot above, and inherits the exclusion blending so it reads
 * correctly over both the light hero and the black panel.
 *
 * The one control on the hero drawn as an actual button. It is the only thing here we
 * want pressed, and as 15px bracketed text it sat in the same register as the caption
 * above it — indistinguishable from the copy it was competing with. The pill replaces
 * the brackets rather than joining them: an outline around a bracketed label is the
 * same enclosure drawn twice.
 */
export function ScrollCue({ vp }: { vp: Viewport }) {
  return (
    <HeroRail vp={vp}>
      <motion.div {...riseIn(0.45)}>
        <button type="button" onClick={scrollToSignup} style={railPillStyle(vp)}>
          GET ON THE LIST ↓
        </button>
      </motion.div>
    </HeroRail>
  )
}

/**
 * How far EventInfo lifts on the outro, in px.
 *
 * The lift is what OPENS the band the outro block sits in, so how far it has to travel
 * depends on what the route put there. `/` passes no `outro` block at all and keeps the
 * original figure; `/tickets` stacks a ticket link on top of the mailing-list strip, which
 * is roughly 48px taller than the strip was on its own.
 *
 * Read in two places that must not disagree: `data-outro-offset` below, which the scroll
 * engine drives the translate off, and `frame()` in KeyArt, whose bottom inset has to clear
 * whatever EventInfo ends up covering. LandingShell computes this once and hands it to
 * both, which is the only reason they cannot drift apart.
 */
export function eventInfoLift(vp: Viewport, hasOutroBlock: boolean): number {
  if (!hasOutroBlock) return vp.isDesktop ? 166 : 132
  return vp.isDesktop ? 196 : 180
}

export function EventInfo({ vp, lift }: { vp: Viewport; lift: number }) {
  const desktop = vp.isDesktop
  const circle = desktop ? 30 : 20

  return (
    <motion.div
      id="outro-info"
      data-outro-offset={lift}
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
      {/* Shrink-wraps to the width of the kicker so the badge can sit on the text's
          left edge while the group as a whole stays centred on the same axis as the
          date stamp and the view button. */}
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
            centred on the same axis as the date stamp. */}
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
        {/*
          The name, then the kicker directly beneath it, smaller and lighter.
          The build plan is firm that these two travel together: "Rewind" on its own
          means nothing to anyone who has not already seen the campaign, so it never
          appears without the line that says what it is.
        */}
        {/* Heavier below desktop, where this sits on the hero scrim at a third of the
            desktop size. index.html loads 500 and 700 — nothing else, so no other
            weight can be used here without widening that request first. */}
        <div
          style={{
            fontFamily: FONT,
            fontWeight: desktop ? 500 : 700,
            fontSize: desktop ? 38 : 24,
            lineHeight: '100%',
            textAlign: 'left',
            letterSpacing: '-0.04em',
            textTransform: 'uppercase',
            color: '#fff',
          }}
        >
          {EVENT.name}
        </div>
        {/*
          The weakest element on the page, and below desktop three of its properties
          were working against it: 11px, dimmed to 0.8, and set in NEGATIVE tracking
          while uppercase. All-caps has no ascenders or descenders to carry word shape,
          so it leans entirely on letter separation — tightening it is the one change
          that costs nothing and hurts most. Desktop is unchanged; it is bigger, and it
          sits in the empty margin rather than on the photo.
        */}
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: desktop ? 13 : 12,
            lineHeight: '130%',
            textAlign: 'left',
            letterSpacing: desktop ? '-0.02em' : '0.02em',
            textTransform: 'uppercase',
            color: '#fff',
            opacity: desktop ? 0.8 : 1,
            marginTop: desktop ? 8 : 5,
            // Widened with the type so the line still breaks in two. This also sets the
            // inner block's width, and with it the axis the badge and name align on —
            // see the shrink-wrap note above.
            maxWidth: desktop ? 240 : 208,
          }}
        >
          {EVENT.tagline}
        </div>
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontWeight: desktop ? 500 : 700,
          fontSize: desktop ? 80 : 60,
          lineHeight: '100%',
          textAlign: 'center',
          letterSpacing: '-0.04em',
          color: '#fff',
        }}
      >
        {formatDoorStamp()}
      </div>
    </motion.div>
  )
}

export function Footer({
  vp,
  startVisible = false,
}: {
  vp: Viewport
  /**
   * True on a route whose FIRST screen is the outro, where this belongs to the view
   * somebody lands on rather than to one four viewports down.
   *
   * The scroll engine overwrites `opacity` on the frame after mount either way, so this
   * only decides what the one frame before that paints. Without it a route that opens on
   * the outro flashes a footerless screen on load.
   */
  startVisible?: boolean
}) {
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
        opacity: startVisible ? 1 : 0,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: desktop ? 80 : undefined,
        justifyContent: desktop ? undefined : 'space-between',
      }}
    >
      <span style={textStyle}>The Forum University 2026</span>
      {/*
        A real link now that /privacy exists. `pointerEvents` is re-enabled on this one
        element because the wrapper disables it for the whole footer layer, the same way
        HeaderNav does.

        The outro footer fades in with `opacity` and is only ever visible at the very
        bottom of the scroll, so this is never a tap target sitting invisibly over the
        hero. New tab, matching the consent notice on the form: an in-app navigation
        from the form would unmount it and destroy everything typed.
      */}
      <a
        href={ROUTES.PRIVACY}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...textStyle, pointerEvents: 'auto', textDecoration: 'none' }}
      >
        Privacy Policy
      </a>
    </div>
  )
}
