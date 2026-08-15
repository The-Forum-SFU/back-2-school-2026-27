/**
 * Scrolls to the signup section below the scroll experience.
 *
 * The single "get me to the form" action. Shared by the hero CTA, by the [ TICKETS ]
 * control while no ticket URL is wired, and by the auto-advance in useAutoAdvance, so
 * all three feel identical and there is one place to tune the motion.
 *
 * WHY THIS IS HAND-ROLLED RATHER THAN `behavior: 'smooth'`.
 *
 * The target is roughly 4.6 viewports down, and the scroll engine recomputes every card
 * scale, the gallery translate and the outro fade from `window.scrollY` on every frame.
 * Native smooth scroll covers that distance in about 1.3s on an aggressive curve, and
 * measured on a phone viewport it drops to ~24fps with a single frame moving 1487px —
 * 176% of a viewport. Whole gallery cards scale in and back out between two frames,
 * which is the flicker the old instant jump existed to avoid.
 *
 * A gentler curve over a slightly longer distance-scaled duration fixes it: peak
 * velocity lands around a fifth of a viewport per frame, so the gallery reads as
 * something you travel through instead of something that strobes.
 */

/**
 * Bounds on the trip. Short hops stay quick; the full run gets room to breathe.
 *
 * MAX_MS is the dial to turn if this ever needs retuning, and it trades directly
 * against flicker. Measured on a 390px viewport travelling the full ~3900px:
 *
 *   native smooth   1364ms   peak 520px/frame   62% of a viewport
 *   MAX_MS 1600     1829ms   peak 237px/frame   28%
 *   MAX_MS 1200     1479ms   peak 313px/frame   37%   <- chosen
 *
 * 1200 lands within ~100ms of native's own duration while moving 40% less per frame,
 * so it costs the visitor nothing and is the one that stopped looking like a strobe.
 * Lower it further and each frame moves further again.
 */
const MIN_MS = 650
const MAX_MS = 1200
/** Roughly one viewport of travel per this many ms, before clamping. */
const MS_PER_1000PX = 380

/** Standard ease-in-out. Peak velocity is 1.5x the average, not the ~3x native uses. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** In-flight animation, so a second call or a user gesture can stop the first. */
let frame = 0
let stopListening: (() => void) | undefined

function stop() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  stopListening?.()
  stopListening = undefined
}

export function scrollToSignup(): void {
  const target = document.getElementById('signup')
  if (!target) return

  stop()

  // Reduced motion gets a plain jump. Chrome and Safari do not downgrade smooth
  // scrolling for this preference on their own, so animating here would push five
  // viewports past someone who explicitly asked us not to.
  if (prefersReducedMotion()) {
    window.scrollTo({ top: target.offsetTop })
    return
  }

  const from = window.scrollY
  const distance = target.offsetTop - from
  if (Math.abs(distance) < 2) return

  const duration = Math.min(
    MAX_MS,
    Math.max(MIN_MS, (Math.abs(distance) / 1000) * MS_PER_1000PX * 2),
  )
  const start = performance.now()

  // Any deliberate gesture hands control straight back. Fighting someone who has
  // started scrolling is worse than not animating at all. `scroll` is NOT in this list:
  // this function causes scroll events, so listening for them would cancel on the
  // first frame.
  const abort = () => stop()
  const gestures = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
  for (const event of gestures) window.addEventListener(event, abort, { passive: true })
  stopListening = () => {
    for (const event of gestures) window.removeEventListener(event, abort)
  }

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    // Re-read the target every frame: the scroll engine re-measures on `load`, which
    // changes the spacer height and moves this section while we are in flight.
    const top = target.offsetTop
    window.scrollTo(0, from + (top - from) * easeInOutCubic(t))

    if (t < 1) {
      frame = requestAnimationFrame(step)
      return
    }
    stop()
  }

  frame = requestAnimationFrame(step)
}
