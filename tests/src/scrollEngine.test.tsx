/**
 * @vitest-environment jsdom
 */
import { useRef } from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollEngine } from '../../src/lib/useScrollEngine'

/**
 * The scroll engine, andspecifically the one place where `window.scrollY` lies.
 *
 * Everything else this file drives is a straight read of scroll position, and reads fine.
 * The outro block is different because it contains the only inputs on the fixed stack: on a
 * phone, tapping one opens the on-screen keyboard and the browser scrolls the document by
 * itself to lift the field clear of it. That scroll is the browser's, not the visitor's, and
 * on `/tickets` — where this block is on the screen the page OPENS on — feeding it to the
 * intro ramp faded the form out and stopped it taking taps while somebody was typing in it.
 *
 * So the tests below are about which scrolls count. The ramp itself is asserted first, in
 * one test, so that a change to it fails here rather than quietly moving the thresholds the
 * rest of the file is written against.
 */

/** jsdom's default viewport height, which the ramps are measured in fractions of. */
const VH = 768
/** `INTRO_SPAN` — the outro screen has fully cleared by this much scroll. */
const INTRO_END = VH * 0.5

/**
 * `window.scrollTo` is not ours alone: ScrollTrigger calls it to restore position across a
 * refresh, so a bare "was it called" says nothing. Every assertion below names the y it
 * expects, and the fixtures start the page somewhere other than 0 so that y is distinctive.
 */
const scrollTo = vi.fn()

/** Did the engine hand the page back to `y`, as opposed to gsap tidying up around us. */
function restoredTo(y: number): boolean {
  return scrollTo.mock.calls.some(([, to]) => to === y)
}

/** The block's painted opacity. Float slop off the ramp means this is never `toBe`. */
function opacity(block: HTMLElement): number {
  return Number(block.style.opacity)
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true })
}

function setInnerSize({ width, height }: { width?: number; height?: number }) {
  if (width !== undefined) {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  }
  if (height !== undefined) {
    Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
  }
}

/**
 * The engine renders from a RAF loop rather than from scroll events, so nothing it writes
 * is visible until a frame runs. Every assertion here is preceded by one.
 */
function frame() {
  act(() => {
    vi.advanceTimersToNextFrame()
  })
}

function scrollTop(y: number) {
  setScrollY(y)
  window.dispatchEvent(new Event('scroll'))
  frame()
}

/**
 * The parts of LandingShell the engine reaches for by id, and nothing else. The real shell
 * pulls in gsap-driven artwork, a canvas and an IntersectionObserver, none of which this is
 * about — what matters is that the ids and the nesting match.
 */
function Harness({ openOnOutro = true }: { openOnOutro?: boolean }) {
  const spacerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useScrollEngine({ spacerRef, panelRef, wrapRef, cols: 2, hasBottom: false, openOnOutro })

  return (
    <div id="scroll-spacer" ref={spacerRef}>
      <div ref={panelRef}>
        <div ref={wrapRef} />
      </div>
      <div id="outro-overlay" />
      <div id="outro-info" />
      <div id="outro-footer" />
      <div id="outro-keyart" />
      <div id="outro-signup">
        <form>
          <input id="outro-firstName" />
          <input id="outro-email" />
        </form>
      </div>
    </div>
  )
}

function mount(openOnOutro = true) {
  render(<Harness openOnOutro={openOnOutro} />)
  frame()
  return {
    block: document.getElementById('outro-signup')!,
    spacer: document.getElementById('scroll-spacer')!,
    firstName: document.getElementById('outro-firstName') as HTMLInputElement,
    email: document.getElementById('outro-email') as HTMLInputElement,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('scrollTo', scrollTo)
  setScrollY(0)
  setInnerSize({ width: 390, height: VH })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  scrollTo.mockReset()
})

describe('the ramp the rest of this file is written against', () => {
  it('opens at full and has cleared the block by half a viewport', () => {
    const { block } = mount()

    expect(opacity(block)).toBeCloseTo(1)
    expect(block.style.visibility).toBe('visible')

    scrollTop(INTRO_END)
    expect(opacity(block)).toBe(0)
    expect(block.style.visibility).toBe('hidden')
  })

  it('is tappable on the way out for as long as it is visible', () => {
    const { block } = mount()

    // A third of the way down the ramp: painted at ~42%, and still the only thing on the
    // screen anybody landed on. Gating this on "essentially opaque" — which is the right
    // rule for the block ARRIVING at the end of the page — left it looking present and
    // answering nothing after a nudge of scroll.
    scrollTop(100)
    expect(opacity(block)).toBeGreaterThan(0.3)
    expect(block.style.pointerEvents).toBe('auto')

    // Gone is gone, though.
    scrollTop(INTRO_END)
    expect(block.style.pointerEvents).toBe('none')
  })
})

describe('the scroll the keyboard makes', () => {
  it('does not move the form out from under somebody typing in it', () => {
    const { block, firstName } = mount()

    act(() => firstName.focus())
    // What a phone does on its own when the keyboard opens under a fixed field. Far past
    // the point where the ramp would have hidden this block outright — and `visibility:
    // hidden` on an ancestor of the focused input is what drops the focus and closes the
    // keyboard again, which is how this was reported: a tap that scrolls and never types.
    scrollTop(250)

    expect(opacity(block)).toBeCloseTo(1)
    expect(block.style.visibility).toBe('visible')
    expect(block.style.pointerEvents).toBe('auto')
  })

  it('hands the page back where it was when the field is left', () => {
    const { firstName } = mount()

    // Nudged off the very top before the tap, so the y handed back is unmistakably ours.
    scrollTop(40)
    act(() => firstName.focus())
    scrollTop(290)
    act(() => firstName.blur())

    // Without this the outro fades out the instant somebody finishes typing, which is the
    // same glitch moved onto the line confirming they are on the list.
    expect(restoredTo(40)).toBe(true)
  })

  it('holds across a move from the name field to the email field', () => {
    const { block, firstName, email } = mount()

    scrollTop(40)
    act(() => firstName.focus())
    scrollTop(290)
    act(() => email.focus())
    frame()

    expect(opacity(block)).toBeCloseTo(1)
    // Tabbing across the row is not leaving the form, so the page is not handed back
    // halfway through filling it in.
    expect(restoredTo(40)).toBe(false)
  })

  it('does not re-lay the page out when the keyboard shrinks the viewport', () => {
    const { spacer, firstName } = mount()
    const before = spacer.style.height

    act(() => firstName.focus())
    // The keyboard, on the browsers that shrink the layout viewport for it. Measuring
    // against this halves every ramp on the page while somebody is mid-word.
    setInnerSize({ height: 420 })
    act(() => {
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersToNextFrame()
    })

    expect(spacer.style.height).toBe(before)
  })

  it('still re-measures on a rotation, which the keyboard cannot cause', () => {
    const { spacer, firstName } = mount()
    const before = spacer.style.height

    act(() => firstName.focus())
    setInnerSize({ width: 768, height: 390 })
    act(() => {
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersToNextFrame()
    })

    expect(spacer.style.height).not.toBe(before)
  })
})

describe('the scroll the visitor makes', () => {
  it('takes the hold off and leaves them where they scrolled to', () => {
    const { block, firstName } = mount()

    scrollTop(40)
    act(() => firstName.focus())
    scrollTop(290)

    act(() => window.dispatchEvent(new WheelEvent('wheel')))
    frame()

    // Somebody scrolling with a field focused is leaving. Yanking them back to the form
    // would be the worse of the two bugs.
    expect(opacity(block)).toBe(0)
    expect(restoredTo(40)).toBe(false)
  })

  it('ignores a drag on the form itself, which is a selection and not a scroll', () => {
    const { block, firstName } = mount()

    act(() => firstName.focus())
    scrollTop(250)

    act(() => firstName.dispatchEvent(new Event('touchmove', { bubbles: true })))
    frame()

    expect(opacity(block)).toBeCloseTo(1)
  })
})

describe('routes with no outro block', () => {
  it('wires none of it, and the hold cannot engage', () => {
    render(<Harness openOnOutro={false} />)
    frame()

    const block = document.getElementById('outro-signup')!
    // `openOnOutro` false means no intro ramp at all: this block belongs to the END of the
    // page there, and at the top of it there is nothing to hold.
    expect(opacity(block)).toBe(0)
    expect(block.style.pointerEvents).toBe('none')
  })
})
