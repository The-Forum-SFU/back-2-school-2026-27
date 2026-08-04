import { useEffect, useState } from 'react'

export const MOBILE_MAX = 640
export const TABLET_MAX = 1024

export type Viewport = {
  width: number
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  /** Coarse pointer / no hover — no cursor to track, so no spotlight. */
  isTouch: boolean
  reducedMotion: boolean
}

function read(): Viewport {
  const width = window.innerWidth
  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches
  return {
    width,
    isMobile: width < MOBILE_MAX,
    isTablet: width >= MOBILE_MAX && width < TABLET_MAX,
    isDesktop: width >= TABLET_MAX,
    isTouch,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(read)

  useEffect(() => {
    const sync = () => {
      setVp((prev) => {
        const next = read()
        // Only re-render when something we branch on actually flipped.
        return prev.isMobile === next.isMobile &&
          prev.isTablet === next.isTablet &&
          prev.isDesktop === next.isDesktop &&
          prev.isTouch === next.isTouch &&
          prev.reducedMotion === next.reducedMotion
          ? prev
          : next
      })
    }
    sync()
    window.addEventListener('resize', sync)
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    motionQuery.addEventListener('change', sync)
    return () => {
      window.removeEventListener('resize', sync)
      motionQuery.removeEventListener('change', sync)
    }
  }, [])

  return vp
}

/** Columns in the gallery grid for the current breakpoint. */
export function columnsFor(vp: Viewport): number {
  if (vp.isDesktop) return 4
  if (vp.isTablet) return 3
  return 2
}
