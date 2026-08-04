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
 */
export default function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onMove = (e: MouseEvent) => {
      el.style.left = `${e.clientX}px`
      el.style.top = `${e.clientY}px`
    }

    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div
      ref={ref}
      className="fixed pointer-events-none"
      style={{
        left: -100,
        top: -100,
        zIndex: 50,
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
