import { useEffect, useState } from 'react'
import { HERO_BASE, HERO_REVEAL } from '../assets'
import RevealLayer from './RevealLayer'

/** How hard the smoothed position chases the raw pointer, per frame. */
const EASE = 0.1

/** Far enough off-screen that no part of the spotlight is visible. */
const OFFSCREEN = { x: -999, y: -999 }

type Props = {
  /** Desktop, non-touch, motion allowed — otherwise the base image stands alone. */
  spotlight: boolean
  isMobile: boolean
}

/**
 * Owns the hero's two image layers and the pointer smoothing that drives the
 * spotlight. Kept separate from the overlay UI so that the per-frame cursor
 * state only re-renders these two divs.
 */
export default function HeroCanvas({ spotlight, isMobile }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [cursorPos, setCursorPos] = useState(OFFSCREEN)

  // Fade in only once both images are decoded, so the spotlight never reveals
  // a half-painted layer.
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

  useEffect(() => {
    if (!spotlight) {
      setCursorPos(OFFSCREEN)
      return
    }

    const mouse = { ...OFFSCREEN }
    const smooth = { ...OFFSCREEN }
    let raf = 0

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      // First move: jump rather than sweep in from off-screen.
      if (smooth.x === OFFSCREEN.x && smooth.y === OFFSCREEN.y) {
        smooth.x = mouse.x
        smooth.y = mouse.y
      }
    }

    const tick = () => {
      smooth.x += (mouse.x - smooth.x) * EASE
      smooth.y += (mouse.y - smooth.y) * EASE
      setCursorPos((prev) =>
        Math.abs(prev.x - smooth.x) < 0.01 && Math.abs(prev.y - smooth.y) < 0.01
          ? prev
          : { x: smooth.x, y: smooth.y },
      )
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove)
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [spotlight])

  return (
    <div
      id="main-canvas"
      className="fixed pointer-events-none overflow-hidden"
      style={{
        zIndex: 0,
        left: 0,
        top: isMobile ? 220 : 0,
        width: isMobile ? '100vw' : '100%',
        height: isMobile ? 'calc(100vh - 220px)' : '100%',
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        className="absolute inset-0 bg-center bg-cover bg-no-repeat"
        style={{ zIndex: 10, backgroundImage: `url(${HERO_BASE})` }}
      />
      {spotlight && (
        <RevealLayer image={HERO_REVEAL} cursorX={cursorPos.x} cursorY={cursorPos.y} />
      )}
    </div>
  )
}
