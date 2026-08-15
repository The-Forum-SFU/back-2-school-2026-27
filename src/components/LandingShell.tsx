import { useRef, type ReactNode } from 'react'
import BlackPanel from './BlackPanel'
import CustomCursor from './CustomCursor'
import HeroCanvas from './HeroCanvas'
import { Caption, EventInfo, Footer, HeaderNav, LogoMark, ScrollCue } from './Overlay'
import { columnsFor, useViewport } from '../lib/viewport'
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
 * The scroll experience itself is identical on every route. Only `bottom` changes.
 */
export default function LandingShell({ bottom }: { bottom?: ReactNode }) {
  const vp = useViewport()
  const cols = columnsFor(vp)

  const spacerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const hasCursor = vp.isDesktop && !vp.isTouch
  const hasBottom = Boolean(bottom)

  useScrollEngine({ spacerRef, panelRef, wrapRef, cols, hasBottom })

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
        <HeroCanvas isMobile={vp.isMobile} />

        <BlackPanel panelRef={panelRef} wrapRef={wrapRef} cols={cols} />

        <div
          id="outro-overlay"
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 12, background: '#fff', opacity: 0 }}
        />

        <LogoMark vp={vp} />
        <HeaderNav vp={vp} hasBottom={hasBottom} />
        <Caption vp={vp} />
        {/* Nothing to jump to on a route with no bottom section. */}
        {hasBottom && <ScrollCue vp={vp} />}
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
            // This section slides up over a white outro and the paper is very nearly
            // white, so without an edge the two just merge and the whole move reads as
            // the page going blank. The rule states where the sheet starts; the shadow
            // above it falls on the outro underneath and is what actually sells one
            // surface passing over another.
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
