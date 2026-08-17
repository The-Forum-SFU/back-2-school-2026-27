/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DropCountdown from '../../src/components/DropCountdown'
import { EVENT, LISTS } from '../../src/config/event'
import type { Viewport } from '../../src/lib/viewport'

/**
 * The hero countdown.
 *
 * Two things here are worth a test and the rest is layout. First, that it counts to
 * the SAME instant the rest of the site names as the drop — a hero clock that
 * disagrees with the date on the closed panel is the bug this component is most
 * likely to grow. Second, that it recomputes from the clock instead of decrementing,
 * because the failure that produces is a countdown that is quietly minutes wrong on
 * any tab that was ever backgrounded, and that never shows up in a short test unless
 * it is asked for directly.
 */

/** Drop instant as UTC, so the fixtures below read without offset arithmetic. */
const DROP_UTC = '2026-08-24T07:00:00Z'

const desktop: Viewport = {
  width: 1440,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouch: false,
  reducedMotion: false,
}

/** Renders at `iso` on the clock. Returns the timer element's text. */
function renderAt(iso: string, vp: Viewport = desktop): string {
  vi.setSystemTime(new Date(iso))
  render(<DropCountdown vp={vp} />)
  return screen.getByRole('timer').textContent ?? ''
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the instant it counts to', () => {
  it('is EVENT.ticketDropAt', () => {
    // Eight days out to the second.
    expect(renderAt('2026-08-16T07:00:00Z')).toBe('8d00h00m00s')
  })

  it('is the same instant general on-sale opens', () => {
    expect(new Date(LISTS['general-onsale'].opensAt).getTime()).toBe(
      new Date(EVENT.ticketDropAt).getTime(),
    )
  })

  it('is the same day the presale panel prints as the drop date', () => {
    expect(LISTS['presale-guestlist'].ticketDrop?.date).toBe(EVENT.ticketDropAt.slice(0, 10))
  })

  it('reads the offset in EVENT.ticketDropAt rather than the local one', () => {
    expect(new Date(EVENT.ticketDropAt).getTime()).toBe(new Date(DROP_UTC).getTime())
  })
})

describe('ticking', () => {
  it('counts down a second at a time', () => {
    renderAt('2026-08-16T06:59:55Z')
    expect(screen.getByRole('timer')).toHaveTextContent('8d00h00m05s')

    act(() => void vi.advanceTimersByTime(1_000))
    expect(screen.getByRole('timer')).toHaveTextContent('8d00h00m04s')
  })

  it('rolls every field over together', () => {
    renderAt('2026-08-16T06:59:59Z')
    expect(screen.getByRole('timer')).toHaveTextContent('8d00h00m01s')

    act(() => void vi.advanceTimersByTime(2_000))
    expect(screen.getByRole('timer')).toHaveTextContent('7d23h59m59s')
  })

  /**
   * The whole reason `remainingFrom` takes an absolute `now`. A background tab is
   * throttled to roughly one timer a minute, so a countdown that subtracted a second
   * per tick would be an hour slow after an hour of that. Skipping the ticks and
   * moving the clock is what a throttled tab looks like from in here.
   */
  it('is right after ticks are dropped, not just after ticks that fire', () => {
    renderAt('2026-08-16T07:00:00Z')

    // Two hours pass with the timer firing twice, not 7200 times.
    vi.setSystemTime(new Date('2026-08-16T09:00:00Z'))
    act(() => void vi.advanceTimersByTime(1_000))

    expect(screen.getByRole('timer')).toHaveTextContent('7d21h59m59s')
  })
})

describe('the final day', () => {
  it('drops the days field rather than showing a dead zero', () => {
    expect(renderAt('2026-08-24T06:00:00Z')).toBe('01h00m00s')
  })

  it('keeps counting through the last minute', () => {
    expect(renderAt('2026-08-24T06:59:58Z')).toBe('00h00m02s')
  })
})

describe('once the drop lands', () => {
  /*
    Empty, not a frozen row of zeroes. There is no ticket URL in config yet, so a
    "tickets are live" line would be a promise the page cannot keep.
  */
  it('renders nothing while there is no ticket link', () => {
    vi.setSystemTime(new Date(DROP_UTC))
    const { container } = render(<DropCountdown vp={desktop} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing a second later either', () => {
    vi.setSystemTime(new Date('2026-08-24T07:00:01Z'))
    const { container } = render(<DropCountdown vp={desktop} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stops ticking', () => {
    vi.setSystemTime(new Date('2026-08-24T06:59:59Z'))
    render(<DropCountdown vp={desktop} />)
    expect(screen.getByRole('timer')).toHaveTextContent('00h00m01s')

    act(() => void vi.advanceTimersByTime(1_000))
    expect(screen.queryByRole('timer')).toBeNull()
    // The interval is cleared by the effect, so nothing is left running behind the
    // terminal state.
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('under reduced motion', () => {
  const reduced: Viewport = { ...desktop, reducedMotion: true }

  it('drops the seconds field', () => {
    expect(renderAt('2026-08-16T07:00:00Z', reduced)).toBe('8d00h00m')
  })

  it('leaves the digits alone for a whole second', () => {
    renderAt('2026-08-16T07:00:00Z', reduced)
    act(() => void vi.advanceTimersByTime(1_000))
    expect(screen.getByRole('timer')).toHaveTextContent('8d00h00m')
  })

  it('still moves once there is something to show', () => {
    renderAt('2026-08-16T07:00:00Z', reduced)
    act(() => void vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('timer')).toHaveTextContent('7d23h59m')
  })
})

describe('what a screen reader gets', () => {
  /*
    `role="timer"` implies `aria-live="off"`. Without that this would announce itself
    once a second for as long as the page is open.
  */
  it('does not announce on a live region', () => {
    renderAt('2026-08-16T07:00:00Z')
    expect(screen.getByRole('timer')).not.toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('timer')).not.toHaveAttribute('aria-live', 'assertive')
  })

  it('says it in words instead of digits', () => {
    renderAt('2026-08-16T09:30:00Z')
    expect(screen.getByRole('timer')).toHaveAccessibleName(
      'Tickets drop in 7 days, 21 hours, 30 minutes',
    )
  })

  it('leaves the days out of the label on the final day too', () => {
    renderAt('2026-08-24T05:45:00Z')
    expect(screen.getByRole('timer')).toHaveAccessibleName(
      'Tickets drop in 1 hours, 15 minutes',
    )
  })
})
