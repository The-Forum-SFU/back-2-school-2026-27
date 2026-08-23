import { useEffect, useRef } from 'react'
import { CURSOR_BADGE } from '../assets'

/**
 * Desktop-only pointer replacement: the TF monogram inside a ring.
 *
 * Positioned by writing to `style` directly on every mousemove — going through
 * React state here would queue a render per frame for an element that only ever
 * changes two numbers.
 *
 * The badge ships black on transparent, but a black mark under
 * `mix-blend-mode: exclusion` is a no-op — it would render invisible. Inverting
 * it to white lets exclusion do the work instead: it resolves to black over the
 * light hero (what we want there) and flips to white over the black gallery
 * panel, so the cursor never disappears.
 *
 * It does step aside for the real one. Blocks marked `data-system-cursor` bring
 * the system cursor back because they hold a form, and the ring fades out over
 * them so the screen never shows two pointers. See `onMove`.
 */
export default function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onMove = (e: MouseEvent) => {
      el.style.left = `${e.clientX}px`
      el.style.top = `${e.clientY}px`

      /*
        A region that draws the REAL cursor hides this one rather than doubling it.

        Anything carrying a form has to set `cursor: auto` on itself — the scroll spacer
        sets `none` and it inherits — so over that block the system cursor is being drawn
        while the ring is still following the pointer around. `[data-system-cursor]` marks
        those regions; the outro block on /tickets is the only one today.

        WHY THE POINTER AND NOT THE SCROLL POSITION. useScrollEngine used to do this from
        the outro ramp, hiding the ring the moment the outro block went live. That block is
        one 330px column and `visibility` is the whole viewport, and /tickets opens with the
        outro at full — so the screen that route lands on had no cursor on it anywhere
        outside that column. A region is a place, so it takes a place to test it.

        `opacity` and NOT `visibility`, which the engine still writes to this element every
        frame for the bottom-section handoff. Two owners, two properties, neither clobbers
        the other, and hidden by either one is hidden.

        `closest` matches only while the region is actually hit-testable, which is exactly
        the condition wanted: the outro block is `pointerEvents: none` until it is opaque, so
        until then the ring correctly stays on over it. A pointer that never moves while the
        block comes live under it keeps the ring for a moment — closing that would cost a hit
        test every frame, and one pixel of movement fixes it.
      */
      const overSystemCursor =
        e.target instanceof Element && e.target.closest('[data-system-cursor]') !== null
      el.style.opacity = overSystemCursor ? '0' : '1'
    }

    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div
      ref={ref}
      id="custom-cursor"
      className="fixed pointer-events-none"
      style={{
        left: -100,
        top: -100,
        zIndex: 50,
        // Driven by `onMove` above, and deliberately not the property the scroll engine
        // drives. See the note there.
        opacity: 1,
        transform: 'translate(-50%, -50%)',
        mixBlendMode: 'exclusion',
        width: 48,
        height: 48,
      }}
    >
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="22.75" stroke="#fff" strokeWidth="2.5" />
      </svg>
      <img
        src={CURSOR_BADGE}
        alt=""
        aria-hidden="true"
        className="cursor-badge"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 24,
          filter: 'invert(1)',
        }}
      />
    </div>
  )
}
