import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { HERO_BASE, HERO_REVEAL } from '../assets'
import type { Viewport } from '../lib/viewport'
import RevealLayer from './RevealLayer'
import SplitDivider from './SplitDivider'

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/**
 * Height of the scrim's solid band, measured up from the bottom of the canvas.
 *
 * It has to cover every glyph in EventInfo's non-desktop branch (Overlay.tsx): the
 * `bottom: 48` offset plus the block itself — badge 20 + name 24 + gap 5 + tagline
 * ~31 (two lines at 12px/130%) + marginBottom 12 + date stamp 60 ≈ 200. Rounded up
 * so a three-line tagline wrap still lands inside it.
 *
 * Changing EventInfo's mobile type sizes means re-checking this number.
 */
const INFO_BAND = 210

/** Feather above the band. Pure taste — INFO_BAND is what carries the contrast. */
const FEATHER = 170

/** Where the solid band ends, as a gradient stop. */
const PLATEAU = Math.round((INFO_BAND / (INFO_BAND + FEATHER)) * 100)

type Props = {
  vp: Viewport
}

/**
 * The hero's two image layers, split by a divider the user drags left and right
 * to reveal either side.
 *
 * Drag is bound to the whole container rather than just the handle, so the
 * gesture works wherever the pointer lands on the image. `touch-action: pan-y`
 * is what keeps that from hijacking the page: vertical swipes still scroll,
 * horizontal ones come to us.
 */
export default function HeroCanvas({ vp }: Props) {
  const { isMobile, isDesktop } = vp
  const [loaded, setLoaded] = useState(false)
  const [split, setSplit] = useState(0.5)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  // Fade in only once both images are decoded, so the divider never exposes a
  // half-painted layer.
  useEffect(() => {
    let live = true
    Promise.all(
      [HERO_BASE, HERO_REVEAL].map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image()
            img.onload = () => resolve()
            img.onerror = () => resolve()
            img.src = src
          }),
      ),
    ).then(() => {
      if (live) setLoaded(true)
    })
    return () => {
      live = false
    }
  }, [])

  const splitFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0.5
    return clamp01((clientX - rect.left) / rect.width)
  }, [])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setSplit(splitFromClientX(e.clientX))
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    setSplit(splitFromClientX(e.clientX))
  }

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <div
      id="main-canvas"
      ref={containerRef}
      className="overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        position: 'fixed',
        zIndex: 0,
        left: 0,
        top: isMobile ? 220 : 0,
        width: isMobile ? '100vw' : '100%',
        height: isMobile ? 'calc(100vh - 220px)' : '100%',
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.3s ease',
        touchAction: 'pan-y',
      }}
    >
      <div
        className="absolute inset-0 bg-center bg-cover bg-no-repeat"
        style={{ zIndex: 10, backgroundImage: `url(${HERO_BASE})` }}
      />
      <RevealLayer image={HERO_REVEAL} split={split} />

      {/*
        Legibility scrim for the EventInfo block, which on anything below desktop is
        bottom-centred directly over the bear's jersey.

        Why it exists: the overlay text blends with `mix-blend-mode: exclusion`, which
        renders white type as `1 - backdrop`. Over the jersey's white "THE FORUM" / "69"
        print that flips the glyphs to black mid-word, and the anti-aliased edges of that
        print pass through mid-grey — where `1 - b` equals the backdrop and the letter
        disappears outright. The block isn't low-contrast, it's inconsistent per glyph.
        Flattening the backdrop to near-black is what makes exclusion resolve uniformly.

        Why it lives in here rather than as a root-level layer between the canvas (z 0)
        and the black panel (z 10): #main-canvas is a stacking context, so a root sibling
        would paint over ALL of it — including SplitDivider at z 40, dimming the only
        drag affordance on the page. At z 35 the scrim sits above RevealLayer (z 30) and
        below the divider, so the white rule and its shadow stay crisp. Being a child
        also means it inherits the load fade below and the scroll engine's
        `visibility: hidden` past one viewport for free, so it can never bleed into the
        gallery or outro phases — no scroll logic needed anywhere.

        Why dark and not white: as the black panel sweeps up across this band, a dark
        scrim keeps the type white both above and below the panel's edge. A white scrim
        would flip it black-above / white-below and just relocate the same per-glyph
        inconsistency into the transition.

        Alpha stays >= 0.85 across the whole INFO_BAND on purpose. Glyph lightness works
        out to `1 - backdrop*(1 - alpha)`, so the variance the scrim is there to kill is
        only ever scaled by `1 - alpha` — a softer scrim reproduces the bug at reduced
        amplitude rather than fixing it. The feather above the band is free, and is
        eased across four stops because a plain two-stop ramp bands visibly against the
        flat studio white at the crop edges.

        pointerEvents: 'none' is load-bearing — the drag handler is bound to the whole
        container, and this covers most of the lower half of it.
      */}
      {!isDesktop && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: INFO_BAND + FEATHER,
            zIndex: 35,
            pointerEvents: 'none',
            background:
              'linear-gradient(to top,' +
              ' rgba(0,0,0,0.92) 0%,' +
              ` rgba(0,0,0,0.90) ${PLATEAU}%,` +
              ' rgba(0,0,0,0.55) 72%,' +
              ' rgba(0,0,0,0.18) 89%,' +
              ' rgba(0,0,0,0) 100%)',
          }}
        />
      )}

      <SplitDivider split={split} onSplitChange={(next) => setSplit(clamp01(next))} />
    </div>
  )
}
