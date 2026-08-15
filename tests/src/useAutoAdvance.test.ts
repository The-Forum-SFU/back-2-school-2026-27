/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoAdvance } from '../../src/lib/useAutoAdvance'

/**
 * The timer is the easy half. Everything below the first block is about the cancel,
 * because the failure mode that matters is yanking the page away from someone who was
 * in the middle of using it.
 *
 * The scroll itself is mocked out here and tested in scrollToSignup.test.ts — it
 * animates over many frames, so counting its `window.scrollTo` calls would say nothing
 * about how many times the auto-advance fired.
 */

const scrollToSignup = vi.hoisted(() => vi.fn())
vi.mock('../../src/lib/scrollToSignup', () => ({ scrollToSignup }))

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  setScrollY(0)
  sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  sessionStorage.clear()
  scrollToSignup.mockReset()
})

describe('when nobody does anything', () => {
  it('lands on the form after the delay', () => {
    renderHook(() => useAutoAdvance({ enabled: true }))

    vi.advanceTimersByTime(3999)
    expect(scrollToSignup).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(scrollToSignup).toHaveBeenCalledOnce()
  })

  it('fires once and never re-arms within a page load', () => {
    // A timer that re-armed would drag someone downward every time they scrolled back
    // up to look at the hero again.
    renderHook(() => useAutoAdvance({ enabled: true }))
    vi.advanceTimersByTime(60_000)
    expect(scrollToSignup).toHaveBeenCalledOnce()
  })

  it('fires again on the next page load, and is not remembered across loads', () => {
    // Suppressing it for the rest of the session made the behaviour impossible to see
    // twice without clearing storage, and the cases that suppression protected all end
    // with the visitor on the form, which is where they were going anyway.
    const first = renderHook(() => useAutoAdvance({ enabled: true }))
    vi.advanceTimersByTime(5000)
    expect(scrollToSignup).toHaveBeenCalledOnce()
    first.unmount()

    scrollToSignup.mockClear()
    renderHook(() => useAutoAdvance({ enabled: true }))
    vi.advanceTimersByTime(5000)
    expect(scrollToSignup).toHaveBeenCalledOnce()
  })

  it('keeps no state in storage at all', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    renderHook(() => useAutoAdvance({ enabled: true }))
    vi.advanceTimersByTime(5000)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('honours a custom delay', () => {
    renderHook(() => useAutoAdvance({ enabled: true, delayMs: 10_000 }))
    vi.advanceTimersByTime(9_000)
    expect(scrollToSignup).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1_000)
    expect(scrollToSignup).toHaveBeenCalledOnce()
  })
})

describe('the cancel', () => {
  it.each(['scroll', 'wheel', 'pointerdown', 'touchstart', 'keydown'])(
    'is cancelled permanently by %s',
    (eventName) => {
      renderHook(() => useAutoAdvance({ enabled: true }))

      vi.advanceTimersByTime(1000)
      window.dispatchEvent(new Event(eventName))

      // Not just "does not fire at 4s" — it must never fire, however long we wait.
      vi.advanceTimersByTime(120_000)
      expect(scrollToSignup).not.toHaveBeenCalled()
    },
  )

  it('cancels on a pointer drag that never scrolls the page', () => {
    // The case a scroll-only guard would miss: dragging the hero divider on a phone
    // moves the split and never scrolls, so the most engaged visitor is the one who
    // would have been interrupted.
    renderHook(() => useAutoAdvance({ enabled: true }))
    window.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(120_000)
    expect(scrollToSignup).not.toHaveBeenCalled()
  })

  it('detaches every listener once cancelled', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    renderHook(() => useAutoAdvance({ enabled: true }))

    window.dispatchEvent(new Event('scroll'))

    for (const event of ['scroll', 'wheel', 'pointerdown', 'touchstart', 'keydown']) {
      expect(remove).toHaveBeenCalledWith(event, expect.any(Function))
    }
  })

  it('is cancelled by unmounting, so a route change leaves no pending jump', () => {
    const { unmount } = renderHook(() => useAutoAdvance({ enabled: true }))
    unmount()
    vi.advanceTimersByTime(120_000)
    expect(scrollToSignup).not.toHaveBeenCalled()
  })
})

describe('when it must not run at all', () => {
  it('does nothing when disabled', () => {
    // `/` renders no form, so there is nowhere to send anyone.
    renderHook(() => useAutoAdvance({ enabled: false }))
    vi.advanceTimersByTime(120_000)
    expect(scrollToSignup).not.toHaveBeenCalled()
  })

  it('does nothing when the page was restored partway down', () => {
    // A bfcache restore brings the position back without firing a scroll event, so
    // there is nothing for the cancel listeners to catch.
    setScrollY(1200)
    renderHook(() => useAutoAdvance({ enabled: true }))
    vi.advanceTimersByTime(120_000)
    expect(scrollToSignup).not.toHaveBeenCalled()
  })

  it('attaches no listeners when it is not going to run', () => {
    const add = vi.spyOn(window, 'addEventListener')
    renderHook(() => useAutoAdvance({ enabled: false }))
    expect(add).not.toHaveBeenCalled()
  })
})
