/**
 * Entry-animation helpers for the signup surface.
 *
 * Duplicated from the private constants in components/Overlay.tsx rather than
 * exported from it — twelve lines of duplication is cheaper than refactoring a
 * finished, working file, and it keeps the signup UI from depending on the landing
 * page's internals.
 */

export const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1]
export const DURATION = 0.6

export const riseIn = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION, ease: EASE, delay },
})

export const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: DURATION, ease: EASE, delay },
})
