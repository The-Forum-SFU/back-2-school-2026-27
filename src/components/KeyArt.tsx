import { useEffect, useRef, useState } from 'react'
import { POSTER, TEASER_POSTER, TEASER_VIDEO } from '../assets'
import { EVENT, formatDoorDate } from '../config/event'
import { REWIND } from '../theme'
import { useViewport, type Viewport } from '../lib/viewport'

/**
 * The campaign artwork on the outro screen: the poster, with the teaser resting over its
 * corner.
 *
 * Renders the CONTENTS of a layer, not the layer. LandingShell owns the fixed positioning
 * and the opacity, because the opacity is driven per frame by the scroll engine off the
 * same ramp that fades the outro ground in. See the note on `keyArt` there.
 *
 * WHY IT IS LAID OUT AROUND A HOLE. The outro is not an empty screen. The wordmark sits
 * top left, the header control top right, `EventInfo` on the right at desktop and along
 * the bottom below it, and the footer across the bottom. Everything in that group is
 * white type blending with `exclusion`, and a full-colour poster underneath any of it
 * would invert it into nonsense. So this claims the gap those layers leave and nothing
 * more, which is why the insets below are asymmetric rather than a tidy centred box.
 *
 * The overlap is the composition. Poster and clip side by side needed roughly 660px of
 * width at a readable height, and the desktop gap is about 570px; resting the clip on the
 * poster's corner spends one footprint instead of two and reads better than two rectangles
 * in a row. It is also the shape the artwork already suggests, since the poster is a photo
 * of a device on denim.
 */

/**
 * Where the two images sit, per breakpoint, measured against the outro's other layers.
 *
 * `height` is a `min()` over viewport units rather than a percentage, and that is not
 * fussiness. The obvious spelling — `height: 100%` with `aspect-ratio` and `max-width` —
 * is broken: a definite height makes width the derived axis, `max-width` then clamps the
 * width, and the height does NOT come back down with it, so the box stops being 4:5 and
 * `object-fit: cover` quietly crops the poster's left and right edges off. It did exactly
 * that on mobile, taking the wordmark with it.
 *
 * Deriving the height from the three things that actually bound it leaves one definite
 * axis and no constraint to fight:
 *
 *   a ceiling             so it does not outgrow the gap on a tall screen
 *   the container height   inset from the top and bottom, below
 *   the container width    over the poster's 0.8 ratio, scaled by the 0.86 the side
 *                          padding leaves, which is where the 1.07 comes from
 */
function frame(vp: Viewport) {
  if (vp.isDesktop) {
    // EventInfo is 330 wide against the right edge with a 32px gutter, so 380 clears it,
    // and 412 is that plus the 32 on the left. 600 centres the poster between the wordmark
    // at the top and the footer at the bottom without touching either.
    return {
      inset: '0 380px 0 32px',
      height: 'min(600px, 100vh, calc((100vw - 412px) * 1.07))',
    }
  }
  // Below desktop EventInfo moves to the bottom centre and the footer sits under it, so
  // the free space is the top of the screen rather than the left of it. 436 is the 92 and
  // 344 those two insets reserve; 40 is the 20 either side.
  return {
    inset: '92px 20px 344px 20px',
    height: 'min(460px, calc(100vh - 436px), calc((100vw - 40px) * 1.07))',
  }
}

export default function KeyArt() {
  const vp = useViewport()
  const { inset, height } = frame(vp)

  return (
    <div
      aria-label={`${EVENT.name} key art`}
      style={{
        position: 'absolute',
        inset,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Asymmetric, because the clip only ever overhangs the right. An even 10% either
        // side spent a chunk of a 390px screen on empty space the composition never uses.
        padding: '0 12% 0 2%',
      }}
    >
      <div
        style={{
          position: 'relative',
          // One definite axis and nothing to clamp it. See the note on `frame`.
          height,
          aspectRatio: '4 / 5',
        }}
      >
        <img
          src={POSTER}
          alt={`${EVENT.name}, ${formatDoorDate()} at ${EVENT.venue.name}`}
          loading="lazy"
          decoding="async"
          width={1080}
          height={1350}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 4,
            // Lifts it off a ground that is nearly the same value as its own dark edges.
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          }}
        />

        <Teaser vp={vp} />
      </div>
    </div>
  )
}

/**
 * The 14s teaser, resting on the poster's bottom right corner.
 *
 * It does not download until the outro is nearly on screen. At 3.5 MB it is by far the
 * heaviest file on the site, and it now lives in a FIXED layer that is technically in the
 * viewport from the first frame — so an IntersectionObserver, which is what held it back
 * while this was a scrolling band, would fire immediately on load and fetch the whole
 * thing for someone who never scrolls. `useOutroNear` watches the scroll position instead.
 *
 * Under reduced motion nothing is mounted and the poster frame stands in. A silent loop
 * restarting forever is exactly the unrequested perpetual movement that preference is
 * asking us to stop, and the still carries the same artwork.
 */
function Teaser({ vp }: { vp: Viewport }) {
  const near = useOutroNear()

  const still = (
    <img
      src={TEASER_POSTER}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )

  return (
    <div
      style={{
        position: 'absolute',
        /*
          Placed against the poster's clear middle band, not its corner.

          The poster is a finished piece of design and two thirds of it is load-bearing:
          the wordmark and the throwback sticker run across the top, and the bottom
          quarter is "SUNDAY, SEPT 20 / CELEBRITIES NIGHTCLUB" over the sponsor row.
          Resting the clip on the bottom right corner covered the venue name, which is
          the single fact on the poster somebody most needs. From 24% to 72% it sits over
          the denim and the treble clef, which are the only decorative parts of the frame.

          The overhang stays small for a duller reason: it is a percentage of the POSTER
          and the padding holding it in is a percentage of the CONTAINER, and at 8% it
          clears the viewport at every breakpoint without having to reason about which of
          the two is binding.
        */
        right: '-8%',
        top: '24%',
        height: '48%',
        aspectRatio: '9 / 16',
        borderRadius: 6,
        overflow: 'hidden',
        background: REWIND.navy,
        // A rim, because the clip's own dark frames and the poster's dark denim meet at
        // this edge and without one the two just merge.
        border: `${vp.isDesktop ? 3 : 2}px solid ${REWIND.navy}`,
        boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
      }}
    >
      {vp.reducedMotion || !near ? (
        still
      ) : (
        <video
          // Every one of these is load-bearing for autoplay. Muted is what browsers
          // require to allow it at all, and `playsInline` is what stops iOS taking the
          // clip fullscreen the instant it starts.
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster={TEASER_POSTER}
          aria-hidden="true"
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        >
          <source src={TEASER_VIDEO} type="video/mp4" />
        </video>
      )}
    </div>
  )
}

/**
 * True once the outro is within half a viewport of arriving.
 *
 * Derived from the spacer rather than hard-coded: `useScrollEngine` sets its height to
 * `vh + maxScroll + 2vh` and starts the outro ramp at `vh + maxScroll`, so the outro
 * begins exactly two viewports from the bottom of it. Reading the height back is what
 * keeps this correct when the gallery reflows at a different column count.
 *
 * One passive listener that removes itself the moment it fires, so this costs nothing for
 * the rest of the page's life and nothing at all to someone who never scrolls that far.
 */
function useOutroNear(): boolean {
  const [near, setNear] = useState(false)
  const seen = useRef(false)

  useEffect(() => {
    if (seen.current) return

    const check = () => {
      const spacer = document.getElementById('scroll-spacer')
      // No spacer means no scroll experience to wait for, so there is nothing to defer.
      if (!spacer) return true
      return window.scrollY >= spacer.offsetHeight - 2.5 * window.innerHeight
    }

    const onScroll = () => {
      if (!check()) return
      seen.current = true
      setNear(true)
      window.removeEventListener('scroll', onScroll)
    }

    // A reload lands mid-page often enough to be worth the one synchronous check.
    onScroll()
    if (seen.current) return

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return near
}
