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

/**
 * Drop instant as UTC, so the fixtures below read without offset arithmetic.
 *
 * Noon Pacific is 19:00Z. Every timestamp in this file is written relative to it, so
 * moving the drop again means moving all of them by the same amount, not just this one.
 */
const DROP_UTC = '2026-08-24T19:00:00Z'

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
  // The preview test below drives the rail through the query string, and jsdom keeps the
  // URL between tests in a file.
  window.history.replaceState({}, '', '/')
})

describe('the instant it counts to', () => {
  it('is EVENT.ticketDropAt', () => {
    // Eight days out to the second.
    expect(renderAt('2026-08-16T19:00:00Z')).toBe('8d00h00m00s')
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
    renderAt('2026-08-16T18:59:55Z')
    expect(screen.getByRole('timer')).toHaveTextContent('8d00h00m05s')

    act(() => void vi.advanceTimersByTime(1_000))
    expect(screen.getByRole('timer')).toHaveTextContent('8d00h00m04s')
  })

  it('rolls every field over together', () => {
    renderAt('2026-08-16T18:59:59Z')
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
    renderAt('2026-08-16T19:00:00Z')

    // Two hours pass with the timer firing twice, not 7200 times.
    vi.setSystemTime(new Date('2026-08-16T21:00:00Z'))
    act(() => void vi.advanceTimersByTime(1_000))

    expect(screen.getByRole('timer')).toHaveTextContent('7d21h59m59s')
  })
})

describe('the final day', () => {
  it('drops the days field rather than showing a dead zero', () => {
    expect(renderAt('2026-08-24T18:00:00Z')).toBe('01h00m00s')
  })

  it('keeps counting through the last minute', () => {
    expect(renderAt('2026-08-24T18:59:58Z')).toBe('00h00m02s')
  })
})

describe('once the drop lands', () => {
  /*
    Never a frozen row of zeroes. The countdown hands the rail over to the ticket link,
    and if there is no link to hand it to, it renders nothing at all: a "tickets are
    live" line with no way to buy any is a promise the page cannot keep.
  */
  it('hands the rail over to the ticket link', () => {
    vi.setSystemTime(new Date(DROP_UTC))
    render(<DropCountdown vp={desktop} />)

    const link = screen.getByRole('link', { name: 'GET TICKETS' })
    expect(link).toHaveAttribute('href', EVENT.tickets.url)
    // New tab, and without handing the opener a reference to this window.
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('timer')).toBeNull()
  })

  /*
    `/tickets?preview=tickets` is a page that is SELLING while the drop is still days
    away, which is the one case where "is the countdown finished" and "are tickets on
    sale" disagree. The rail follows the second one, or a preview shows a countdown and
    an RSVP that the real page will never display.
  */
  it('shows the ticket link on a page that is already selling, drop or no drop', () => {
    window.history.replaceState({}, '', '/tickets?preview=tickets')
    vi.setSystemTime(new Date('2026-08-16T19:00:00Z'))
    render(<DropCountdown vp={desktop} />)

    expect(screen.getByRole('link', { name: 'GET TICKETS' })).toBeInTheDocument()
    expect(screen.queryByRole('timer')).toBeNull()
  })

  /*
    On the route that HAS the checkout on it, the rail scrolls rather than linking out.
    Sending someone to TicketWeb from the hero of the page that already contains the
    checkout is a worse answer than the one two screens down, and the arrow is what
    promises a move down the page rather than off it.
  */
  it('scrolls instead of linking out when the section is on the page', () => {
    vi.setSystemTime(new Date(DROP_UTC))
    render(<DropCountdown vp={desktop} hasBottom />)

    expect(screen.getByRole('button', { name: 'GET TICKETS ↓' })).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('still shows the link a second later', () => {
    vi.setSystemTime(new Date('2026-08-24T19:00:01Z'))
    render(<DropCountdown vp={desktop} />)
    expect(screen.getByRole('link', { name: 'GET TICKETS' })).toBeInTheDocument()
  })

  /*
    The fallback that used to be the only behaviour here, kept because it is what
    protects the hero on the day: `tickets.enabled` is the manual switch for pulling
    every ticket link at once, and a rail that answered it with a dead button would be
    worse than the empty rail this route had before tickets existed.
  */
  it('renders nothing at all when the links are pulled', () => {
    // Cast because EVENT is `as const`, so `enabled` is typed `true`. Turning it off is
    // exactly what this test is for. See the same note in LandingBottom.test.tsx.
    vi.spyOn(EVENT.tickets, 'enabled', 'get').mockReturnValue(false as never)
    vi.setSystemTime(new Date(DROP_UTC))
    const { container } = render(<DropCountdown vp={desktop} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stops ticking', () => {
    vi.setSystemTime(new Date('2026-08-24T18:59:59Z'))
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
    expect(renderAt('2026-08-16T19:00:00Z', reduced)).toBe('8d00h00m')
  })

  it('leaves the digits alone for a whole second', () => {
    renderAt('2026-08-16T19:00:00Z', reduced)
    act(() => void vi.advanceTimersByTime(1_000))
    expect(screen.getByRole('timer')).toHaveTextContent('8d00h00m')
  })

  it('still moves once there is something to show', () => {
    renderAt('2026-08-16T19:00:00Z', reduced)
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
    renderAt('2026-08-16T19:00:00Z')
    expect(screen.getByRole('timer')).not.toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('timer')).not.toHaveAttribute('aria-live', 'assertive')
  })

  it('says it in words instead of digits', () => {
    renderAt('2026-08-16T21:30:00Z')
    expect(screen.getByRole('timer')).toHaveAccessibleName(
      'Tickets drop in 7 days, 21 hours, 30 minutes',
    )
  })

  it('leaves the days out of the label on the final day too', () => {
    renderAt('2026-08-24T17:45:00Z')
    expect(screen.getByRole('timer')).toHaveAccessibleName(
      'Tickets drop in 1 hours, 15 minutes',
    )
  })
})
