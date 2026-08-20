import { useRef, type ReactNode } from 'react'
import BlackPanel from './BlackPanel'
import CustomCursor from './CustomCursor'
import DropCountdown from './DropCountdown'
import HeroCanvas, { type RailOccupant } from './HeroCanvas'
import KeyArt from './KeyArt'
import { Caption, EventInfo, Footer, HeaderNav, LogoMark, ScrollCue } from './Overlay'
import { GROUND } from '../theme'
import { useTicketsLive } from '../lib/useDropped'
import { columnsFor, useViewport } from '../lib/viewport'
import { useAutoAdvance } from '../lib/useAutoAdvance'
import { useScrollEngine } from '../lib/useScrollEngine'

/**
 * The full landing experience — hero split-slider, gallery panel, outro — wrapped so
 * that every route can reuse it with its own ending.
 *
 * `bottom` is whatever that route puts at the end of the scroll: the guestlist form
 * and price comparison there, something else later, nothing at all on /. It is
 * deliberately a prop rather than baked in, because most routes will not have a form
 * and none of them should inherit another route's.
 *
 * The key art is NOT a prop. Every route that renders this shell gets it, because the
 * outro belongs to the EVENT rather than to whatever list a route happens to own, and a
 * campaign screen that appears on one route and not another is a campaign screen someone
 * has to remember to add. It goes INSIDE the outro as a fixed layer that fades up with
 * it: that screen was an almost empty white one carrying a wordmark, a date stamp and a
 * footer, which is a whole viewport of scroll spent on very little. It now fades to navy
 * with the artwork on it. So the run of surfaces is black gallery, navy outro, cream form,
 * and not four of them: the key art is not a surface of its own, it is what the outro is
 * FOR.
 *
 * `rail` picks the hero's one left-rail occupant. It used to be inferred from whether
 * `bottom` was present, which held only while `/` was the sole route without a form: the
 * moment the landing page got one, the inference silently traded its countdown for a
 * scroll cue. What goes on the rail is a decision about what a route is FOR, not about
 * whether it happens to have a section underneath, so it is a prop now.
 *
 * The scroll experience itself is identical on every route. Only these two change.
 */
export default function LandingShell({
  bottom,
  rail = 'cue',
}: {
  bottom?: ReactNode
  /**
   * 'cue' jumps to the form below. 'countdown' counts down to the ticket drop.
   *
   * Also sizes the mobile artwork crop, since the two occupants are very different
   * heights and the band above the image has to clear whichever one is there. See
   * MOBILE_TOP in HeroCanvas.
   */
  rail?: RailOccupant
}) {
  const vp = useViewport()
  const cols = columnsFor(vp)

  const spacerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const hasCursor = vp.isDesktop && !vp.isTouch

  /**
   * Whether a section follows the scroll experience. The key art does NOT count: it is a
   * fixed layer inside the spacer, not a sibling below it, so the thing that covers the
   * fixed stack is still the form sheet and `coverStart`/`coverEnd` still measure against
   * that. See useScrollEngine.
   */
  const hasBottom = Boolean(bottom)

  /**
   * Whether the header may link out to TicketWeb, on the same live clock the landing
   * page's own section switches on.
   *
   * The SAME predicate the two routes redirect on, not a second expression that means the
   * same thing. Computed here rather than inside HeaderNav so there is one timer for the
   * whole shell, and so the header cannot end up a state behind the page it sits on.
   */
  const ticketsLive = useTicketsLive()

  useScrollEngine({ spacerRef, panelRef, wrapRef, cols, hasBottom })

  /**
   * Takes a visitor who has not touched anything down to the form after a few seconds.
   * Gated on `hasBottom` for the same reason ScrollCue is: a route with no form below
   * has nowhere to send anyone. Skipped under reduced motion, where an unrequested
   * five-viewport jump is exactly what the preference is asking us not to do.
   */
  useAutoAdvance({ enabled: hasBottom && !vp.reducedMotion })

  return (
    <>
      <div
        id="scroll-spacer"
        ref={spacerRef}
        style={{
          position: 'relative',
          userSelect: 'none',
          background: '#fff',
          height: '500vh',
          cursor: hasCursor ? 'none' : 'auto',
        }}
      >
        <HeroCanvas vp={vp} rail={rail} />

        <BlackPanel panelRef={panelRef} wrapRef={wrapRef} cols={cols} />

        {/*
          The outro ground. White until the campaign art existed, black now that something
          has to sit on it: a poster this saturated wants nothing behind it. Same value as
          the gallery panel above, so the two read as one dark room the photos leave and
          the artwork arrives in, rather than as two surfaces meeting. See GROUND.
        */}
        <div
          id="outro-overlay"
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 12, background: GROUND, opacity: 0 }}
        />

        {/*
          The key art, between the outro ground and the overlay type.

          z-index 14 puts it over the ground at 12 and under the text at 20, and it
          carries NO `mixBlendMode` on purpose: everything at 20 is white type that leans
          on `exclusion`, and a full-colour poster in that group would invert into
          nonsense. The layers it sits between are laid out so they never overlap it.

          Opacity is driven per frame by useScrollEngine off the same `outro` ramp as the
          ground, so the artwork arrives with the surface rather than being there all
          along behind a white sheet.
        */}
        <div
          id="outro-keyart"
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 14, opacity: 0 }}
        >
          <KeyArt />
        </div>

        <LogoMark vp={vp} />
        <HeaderNav vp={vp} hasBottom={hasBottom} ticketsLive={ticketsLive} />
        <Caption vp={vp} />
        {/*
          One rail slot, two occupants, never both: they render in the same place.

          The guestlist route takes the cue, which jumps straight down to its form. `/`
          takes the countdown, because the drop is the thing that page is about and
          `useAutoAdvance` below already carries anyone idle down to the form without
          needing a button to do it. Past the drop the countdown hands over to a GET
          TICKETS pill on its own. See DropCountdown.
        */}
        {rail === 'countdown' ? (
          <DropCountdown vp={vp} hasBottom={hasBottom} />
        ) : (
          <ScrollCue vp={vp} />
        )}
        <EventInfo vp={vp} />
        <Footer vp={vp} />

        {hasCursor && <CustomCursor />}
      </div>

      {/*
        A SIBLING of the spacer, not a child.

        The spacer carries `userSelect: 'none'` and `cursor: 'none'` inline, and both
        inherit — a form nested inside would be unselectable and cursorless. As a
        sibling it escapes both without touching the spacer's styles.

        z-index 60 is what makes the transition feel like part of the page rather than
        a cut. It puts this section ABOVE every fixed layer (panel 10, overlay 12,
        text 20, divider 40, cursor 50), so as you keep scrolling past the outro this
        panel simply rides up over it — exactly the way the black gallery panel slides
        up over the hero at the start. The scroll engine then hides the fixed stack
        only once this has fully covered the viewport, so nothing ever blinks out
        on screen.
      */}
      {bottom && (
        <section
          id="signup"
          className="paper-surface"
          style={{
            position: 'relative',
            zIndex: 60,
            minHeight: '100vh',

            // Horizontal padding clears the red margin rule that `.paper-surface`
            // draws at --margin-x (16px mobile, 32px desktop), so body text starts
            // in the gutter to its right the way writing on a real sheet does.
            padding: vp.isMobile ? '64px 28px 96px' : '112px 64px 160px',

            // The leading edge of the sheet.
            //
            // Load-bearing while the outro was white: the paper is very nearly white too,
            // so without an edge the two merged and the whole move read as the page going
            // blank. The outro is navy now and the contrast does that job on its own, but
            // the rule and the shadow are what sell one surface passing OVER another
            // rather than two colours meeting, which is the same move the gallery panel
            // makes over the hero. Kept for that.
            borderTop: '1px solid rgba(0,0,0,0.35)',
            boxShadow: '0 -14px 34px rgba(0,0,0,0.22), 0 -2px 6px rgba(0,0,0,0.10)',
          }}
        >
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>{bottom}</div>
        </section>
      )}
    </>
  )
}
