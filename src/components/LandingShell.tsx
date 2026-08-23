import { useRef, type ReactNode } from 'react'
import BlackPanel from './BlackPanel'
import CustomCursor from './CustomCursor'
import DropCountdown from './DropCountdown'
import HeroCanvas, { type RailOccupant } from './HeroCanvas'
import KeyArt from './KeyArt'
import {
  Caption,
  EventInfo,
  eventInfoLift,
  Footer,
  HeaderNav,
  LogoMark,
  ScrollCue,
} from './Overlay'
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
 * `openOnOutro` deletes step 1. See its own note below.
 *
 * The scroll experience itself is otherwise identical on every route.
 */
export default function LandingShell({
  bottom,
  outro,
  rail = 'cue',
  openOnOutro = false,
}: {
  bottom?: ReactNode
  /**
   * A block placed ON the outro screen itself, in the band the footer and EventInfo leave
   * between them. Fades in on the tail of the outro ramp and is inert until it does.
   *
   * THE OTHER PLACE A ROUTE CAN PUT SOMETHING, and deliberately not a variant of `bottom`.
   * That prop is a sheet of paper that rides up OVER the whole fixed stack, which ends the
   * scroll on a new surface and takes the footer with it. This one ends the scroll where the
   * scroll already ended. `/tickets` uses it because it has nothing to sell on a page of its
   * own any more: it links out to TicketWeb, so the screen is the artwork plus the ticket
   * link and the mailing list.
   *
   * Passing one also WIDENS the band, since the block has to fit in it: `eventInfoLift`
   * keys off whether this prop is present, and below desktop that lift comes off the
   * poster. See KeyArt.
   *
   * The two are not mutually exclusive in code, but a route wanting both would be a route
   * showing two forms, so nothing passes both today.
   */
  outro?: ReactNode
  /**
   * 'cue' jumps to the form below. 'countdown' counts down to the ticket drop.
   *
   * Also sizes the mobile artwork crop, since the two occupants are very different
   * heights and the band above the image has to clear whichever one is there. See
   * MOBILE_TOP in HeroCanvas.
   *
   * Ignored entirely under `openOnOutro`, which renders no hero for it to sit on.
   */
  rail?: RailOccupant
  /**
   * NO HERO. The page opens on the outro screen, scrolls into the gallery, and ends on the
   * outro screen again.
   *
   * `/tickets` is the route that wants this and the reason it exists. That page sells
   * nothing of its own — it links out — so the split-slider hero was four screens of
   * something to play with in front of the one screen that carried the offer: the artwork,
   * the date, a ticket link and the mailing list. Opening on that screen puts the offer
   * first, and the gallery becomes what somebody scrolls INTO rather than past.
   *
   * Three things follow from it and none are separate decisions:
   *
   *   - HeroCanvas, the Caption and the rail occupant are not rendered. All three are the
   *     hero's own copy and there is nothing left for them to sit on.
   *   - The spacer's ground turns black, because the white behind the hero was the hero's.
   *   - Every layer of the outro screen starts at full rather than at zero, since the frame
   *     before the scroll engine's first tick is now a frame somebody is looking at.
   *
   * The crossfade itself is one extra ramp in useScrollEngine. See `intro` there.
   */
  openOnOutro?: boolean
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

  /**
   * How far EventInfo lifts, and with it how much of the screen the outro band takes.
   *
   * Computed once here and handed to both readers rather than worked out twice. KeyArt's
   * bottom inset below desktop is derived from the same number — the artwork is what pays
   * for the band — so the two cannot drift apart. See `eventInfoLift` in Overlay.tsx.
   */
  const infoLift = eventInfoLift(vp, Boolean(outro))

  /**
   * What every layer of the outro screen paints on the one frame before the scroll engine's
   * first tick.
   *
   * Zero everywhere the outro is an ending, which is the state those layers have always
   * started in. One on a route that opens on it, where that frame is the landing screen and
   * a zero would flash an empty ground on load. The engine overwrites all of it either way.
   */
  const restOpacity = openOnOutro ? 1 : 0

  useScrollEngine({ spacerRef, panelRef, wrapRef, cols, hasBottom, openOnOutro })

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
          // Black on a route with no hero: the white was the hero's studio ground, and
          // behind an outro screen it is a white flash between the artwork clearing and
          // the gallery panel arriving over it.
          background: openOnOutro ? GROUND : '#fff',
          height: '500vh',
          cursor: hasCursor ? 'none' : 'auto',
        }}
      >
        {!openOnOutro && <HeroCanvas vp={vp} rail={rail} />}

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
          style={{ zIndex: 12, background: GROUND, opacity: restOpacity }}
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
          style={{ zIndex: 14, opacity: restOpacity }}
        >
          <KeyArt infoLift={infoLift} eager={openOnOutro} />
        </div>

        <LogoMark vp={vp} />
        <HeaderNav vp={vp} hasBottom={hasBottom} ticketsLive={ticketsLive} />
        {/*
          The caption and the rail below are the HERO's copy, and a route with no hero has
          nowhere to put them: both sit over the middle of the artwork the outro screen is
          built around. The header control above is not hero copy — it is the one thing on
          this page that never fades — so it stays on every route.
        */}
        {!openOnOutro && <Caption vp={vp} />}
        {/*
          One rail slot, two occupants, never both: they render in the same place.

          The guestlist route takes the cue, which jumps straight down to its form. `/`
          takes the countdown, because the drop is the thing that page is about and
          `useAutoAdvance` below already carries anyone idle down to the form without
          needing a button to do it. See DropCountdown.

          Neither renders under `openOnOutro`. The second ticket link the countdown used to
          hand its slot over to now lives in the outro block below, which is the only place
          on a heroless page that is not the artwork. See TicketCta.
        */}
        {!openOnOutro &&
          (rail === 'countdown' ? (
            <DropCountdown vp={vp} hasBottom={hasBottom} />
          ) : (
            <ScrollCue vp={vp} />
          ))}
        <EventInfo vp={vp} lift={infoLift} />
        <Footer vp={vp} startVisible={openOnOutro} />

        {/*
          The outro's one interactive block, in the gap between the footer and EventInfo.

          FOUR THINGS HERE ARE LOAD-BEARING, and three of them are the reason the paper
          section below is a SIBLING of the spacer rather than a child of it. This one has to
          be a child — it belongs to the outro, which is the fixed stack — so it pays those
          costs explicitly instead of escaping them.

          1. NO `mixBlendMode`. Every other layer at this z-index blends with `exclusion`
             (see `overlayBase` in Overlay.tsx), and form controls in an exclusion group
             invert into nonsense. This is a plain layer, like the bear badge, which is full
             colour for the same reason.

          2. `userSelect: 'text'` and `cursor: 'auto'`. The spacer sets `none` for both,
             inline, and both inherit — a nested form would be unselectable and cursorless.

             `data-system-cursor` is the other half of that. Bringing the real cursor back
             here means it is drawn over this block while the custom ring is still following
             the pointer around the rest of the screen, so the ring hides itself over
             anything carrying that attribute. It is on the same element as the `cursor`
             declaration that creates the problem, and it has to stay there. See
             CustomCursor.

          3. Inert until it arrives. `opacity`, `visibility` and `pointerEvents` are all
             driven per frame by useScrollEngine off the tail of the outro ramp. Without the
             last two this is an invisible tap target and a run of tab stops sitting over the
             hero for the entire five viewports above it.

             Under `openOnOutro` it arrives immediately, so the three start at the other end
             — see `restOpacity` above. The engine drives them exactly as before; what
             changes is which ramp it reads, not that it reads one.

          4. The insets are the gap, measured. Desktop: the footer's top edge is around 49
             and EventInfo finishes 166px above its `bottom: 80`, so the column runs to 246.
             Mobile: footer top around 39, EventInfo finishes at 180. That is roughly 141px
             of band on a small phone, and what goes in it is sized against that. See the
             height budget note in OutroSignup.
        */}
        {outro && (
          <div
            id="outro-signup"
            data-system-cursor
            style={{
              position: 'fixed',
              zIndex: 20,
              ...(vp.isDesktop
                ? { right: 32, bottom: 64, width: 330 }
                : { left: 16, right: 16, bottom: 46 }),
              opacity: restOpacity,
              visibility: openOnOutro ? 'visible' : 'hidden',
              pointerEvents: openOnOutro ? 'auto' : 'none',
              userSelect: 'text',
              cursor: 'auto',
            }}
          >
            {outro}
          </div>
        )}

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
