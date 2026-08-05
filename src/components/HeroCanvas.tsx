import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { HERO_BASE, HERO_REVEAL } from '../assets'
import RevealLayer from './RevealLayer'
import SplitDivider from './SplitDivider'

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

type Props = {
  isMobile: boolean
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
export default function HeroCanvas({ isMobile }: Props) {
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
      <SplitDivider split={split} onSplitChange={(next) => setSplit(clamp01(next))} />
    </div>
  )
}
