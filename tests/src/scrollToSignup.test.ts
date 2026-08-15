/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollToSignup } from '../../src/lib/scrollToSignup'

/**
 * The shared "get me to the form" action, used by the hero CTA, by [ TICKETS ] while no
 * ticket URL is wired, and by the auto-advance.
 *
 * It is hand-rolled rather than `behavior: 'smooth'` because the target is ~4.6
 * viewports away and the scroll engine recomputes every card scale and the outro fade
 * per frame. Native smooth scroll measured a single 1487px frame across that distance,
 * which flickers whole gallery cards in and out between two paints. The per-frame
 * travel test below is the one that protects that.
 */

const SIGNUP_TOP = 4200
const scrollTo = vi.fn()

/** The y value of each frame this animation painted. */
function paintedPositions(): number[] {
  return scrollTo.mock.calls.map(([, y]) => y as number)
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('scrollTo', scrollTo)
  setScrollY(0)

  const section = document.createElement('section')
  section.id = 'signup'
  // jsdom reports 0 for every layout property, so offsetTop is defined explicitly.
  Object.defineProperty(section, 'offsetTop', { value: SIGNUP_TOP, configurable: true })
  document.body.appendChild(section)
})

afterEach(() => {
  // Let any in-flight animation finish before the next test, or its frames leak in.
  vi.advanceTimersByTime(5000)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  scrollTo.mockReset()
})

describe('the motion', () => {
  it('animates rather than teleporting, and arrives', () => {
    scrollToSignup()

    vi.advanceTimersToNextFrame()
    expect(paintedPositions()[0]).toBeLessThan(SIGNUP_TOP / 2)

    vi.advanceTimersByTime(3000)
    expect(Math.round(paintedPositions().at(-1)!)).toBe(SIGNUP_TOP)
    expect(paintedPositions().length).toBeGreaterThan(10)
  })

  it('never moves more than a fraction of a viewport in one frame', () => {
    scrollToSignup()
    vi.advanceTimersByTime(3000)

    const ys = paintedPositions()
    let biggest = 0
    for (let i = 1; i < ys.length; i++) biggest = Math.max(biggest, ys[i] - ys[i - 1])
    expect(biggest).toBeLessThan(SIGNUP_TOP / 8)
  })

  it('moves in one direction only, never overshooting and easing back', () => {
    scrollToSignup()
    vi.advanceTimersByTime(3000)

    const ys = paintedPositions()
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1])
    expect(Math.max(...ys)).toBeLessThanOrEqual(SIGNUP_TOP)
  })

  it('starts and finishes slowly, which is what keeps the gallery legible', () => {
    scrollToSignup()
    vi.advanceTimersByTime(3000)

    const ys = paintedPositions()
    const stepAt = (i: number) => ys[i] - ys[i - 1]
    const middle = Math.floor(ys.length / 2)
    expect(stepAt(1)).toBeLessThan(stepAt(middle))
    expect(stepAt(ys.length - 1)).toBeLessThan(stepAt(middle))
  })
})

describe('yielding to the user', () => {
  it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])(
    'hands control back on %s mid-flight',
    (eventName) => {
      scrollToSignup()
      vi.advanceTimersToNextFrame()
      vi.advanceTimersToNextFrame()

      window.dispatchEvent(new Event(eventName))
      const painted = scrollTo.mock.calls.length

      vi.advanceTimersByTime(3000)
      expect(scrollTo.mock.calls.length).toBe(painted)
    },
  )

  it('does not cancel itself on the scroll events it causes', () => {
    // `scroll` is deliberately absent from the abort list: this function generates
    // scroll events, so listening for them would abort on the first frame.
    scrollToSignup()
    vi.advanceTimersToNextFrame()
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(3000)
    expect(Math.round(paintedPositions().at(-1)!)).toBe(SIGNUP_TOP)
  })

  it('replaces an in-flight animation rather than running two at once', () => {
    scrollToSignup()
    vi.advanceTimersToNextFrame()
    scrollToSignup()
    vi.advanceTimersByTime(3000)

    // Two overlapping rAF loops would fight, producing a non-monotonic trace.
    const ys = paintedPositions()
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1])
  })
})

describe('the guards', () => {
  it('jumps plainly under reduced motion', () => {
    // Chrome and Safari do not downgrade smooth scrolling for this preference on their
    // own, so animating would push five viewports past someone who opted out.
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) => ({ matches: query.includes('reduce'), media: query }) as MediaQueryList,
    )
    scrollToSignup()
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: SIGNUP_TOP })
  })

  it('does nothing when already at the section', () => {
    setScrollY(SIGNUP_TOP)
    scrollToSignup()
    vi.advanceTimersByTime(3000)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('does nothing, and does not throw, when there is no signup section', () => {
    document.body.innerHTML = ''
    expect(() => scrollToSignup()).not.toThrow()
    vi.advanceTimersByTime(3000)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('follows the section if it moves mid-flight', () => {
    // The scroll engine re-measures on `load`, which changes the spacer height and
    // moves this section while the animation is running.
    const section = document.getElementById('signup')!
    scrollToSignup()
    vi.advanceTimersToNextFrame()

    Object.defineProperty(section, 'offsetTop', { value: 5000, configurable: true })
    vi.advanceTimersByTime(3000)
    expect(Math.round(paintedPositions().at(-1)!)).toBe(5000)
  })
})
