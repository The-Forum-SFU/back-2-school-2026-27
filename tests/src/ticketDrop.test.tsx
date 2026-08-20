/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LandingBottom from '../../src/components/LandingBottom'
import TicketsSection from '../../src/components/TicketsSection'
import {
  EVENT,
  hasDropped,
  LISTS,
  ticketsAvailable,
  ticketsLive,
} from '../../src/config/event'
import { useTicketsLive } from '../../src/lib/useDropped'
import type { Viewport } from '../../src/lib/viewport'

/**
 * The ticket drop: the one moment this site changes itself while someone is looking at
 * it.
 *
 * Two things here are worth a test and the rest is layout. The SWITCH, in both directions
 * and in the state where it cannot complete, because a date arriving is not the same as a
 * ticket link existing and the failure that matters is a working signup form being
 * replaced by nothing on the afternoon of the drop. And the fact that `/` and `/tickets`
 * redirect at each other, where the failure mode is an infinite loop rather than a wrong
 * pixel.
 */

const DROP_UTC = '2026-08-24T19:00:00Z'
const BEFORE = '2026-08-24T18:59:59Z'

const desktop: Viewport = {
  width: 1440,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouch: false,
  reducedMotion: false,
}

/**
 * Overrides one `EVENT.tickets` field for a single test.
 *
 * `EVENT` is `as const`, so `enabled` is typed `true` and `url` is typed as its own
 * literal string. `mockReturnValue('')` is therefore a type error even though it is
 * exactly what the runtime has to handle: an empty URL is the state this whole fallback
 * exists for. The cast is confined here rather than repeated at every call site, so the
 * `as const` keeps doing its job everywhere the app actually reads these.
 */
function overrideTicket<K extends keyof typeof EVENT.tickets>(
  key: K,
  value: (typeof EVENT.tickets)[K] | '' | false,
) {
  vi.spyOn(EVENT.tickets, key, 'get').mockReturnValue(value as never)
}

function renderAt(iso: string) {
  vi.setSystemTime(new Date(iso))
  return render(
    <MemoryRouter>
      <LandingBottom />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  // /api/list-status decides the form's phase, and ListSection lets the server win. An
  // unanswered fetch leaves the config-derived first frame on screen, which is what these
  // assertions are about.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the moment it switches', () => {
  it('is EVENT.ticketDropAt, to the second', () => {
    expect(hasDropped(new Date(BEFORE))).toBe(false)
    expect(hasDropped(new Date(DROP_UTC))).toBe(true)
    expect(hasDropped(new Date('2026-08-24T19:00:01Z'))).toBe(true)
  })

  it('is the same instant the mailing list stops accepting', () => {
    // Set by construction rather than by a second date. If these two ever disagree, one
    // side of the page is refusing what the other is still offering.
    expect(new Date(LISTS['mailing-list'].closesAt).getTime()).toBe(
      new Date(EVENT.ticketDropAt).getTime(),
    )
  })
})

describe('before the drop', () => {
  it('shows the signup form and no ticket frame', () => {
    renderAt(BEFORE)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notify me' })).toBeInTheDocument()
    expect(screen.queryByTitle('Buy tickets')).toBeNull()
  })

  it('collects the same fields as the guestlist form', () => {
    renderAt(BEFORE)
    for (const label of ['First name', 'Last name', 'Email', 'Phone']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Birth month')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('carries the consent wording verbatim', () => {
    renderAt(BEFORE)
    expect(
      screen.getByText(
        'Opt in to email and SMS from The Forum to get first access to exclusive pre-sales, discounts and giveaways.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/We will contact you via email regarding important event information\./),
    ).toBeInTheDocument()
  })

  it('promises nothing at the door, which is what separates it from the guestlist', () => {
    // The public page cannot hand out discounted door spots. Three properties enforce
    // that, and this is the one a copy edit could quietly undo.
    const cfg = LISTS['mailing-list']
    expect(cfg.capacity).toBeNull()
    expect(cfg.doorInstructions).toBeUndefined()
    expect(cfg.priceCents).toBe(0)
    renderAt(BEFORE)
    expect(screen.queryByText(/at the door/i)).toBeNull()
  })
})

describe('once the drop lands', () => {
  it('sells through the frame, with an escape hatch above it', () => {
    const { container } = render(<TicketsSection vp={desktop} />)
    const frame = screen.getByTitle('Buy tickets')
    expect(frame).toHaveAttribute('src', EVENT.tickets.embedUrl)

    // A framed third-party checkout inside Instagram's in-app browser is the single most
    // likely thing on this page to render blank, and a blank box is a dead end.
    const link = screen.getByRole('link', { name: /Open in external tab/ })
    expect(link).toHaveAttribute('href', EVENT.tickets.url)
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')

    /*
      ABOVE the frame, and this is the half worth asserting. Someone staring at a blank
      white box has no reason to scroll past the thing that failed in order to find the
      fix, so a link underneath it is a link they never see. DOCUMENT_POSITION_FOLLOWING
      means the frame comes after the link in document order.
    */
    const order = link.compareDocumentPosition(frame)
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.textContent).not.toMatch(/Not loading/)
  })

  it('goes live on its own, with nobody reloading anything', () => {
    // Someone who opened the page at 11:59 to wait for noon is exactly who this is for.
    // The timer fires inside `act` so React's state update is flushed before the assert.
    vi.setSystemTime(new Date(BEFORE))
    const { result } = renderHook(() => useTicketsLive())
    expect(result.current).toBe(false)

    act(() => {
      vi.setSystemTime(new Date(DROP_UTC))
      vi.advanceTimersByTime(1_000)
    })

    expect(result.current).toBe(true)
  })
})

describe('the redirect between / and /tickets', () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

  /*
    `/` forwards to `/tickets` while tickets are live and `/tickets` forwards back while
    they are not, so the two conditions have to be exact complements. If they ever drift
    apart the failure is not a wrong pixel, it is both routes wanting to move at once and
    the browser looping between them until it gives up.

    One shared predicate is what makes that impossible rather than merely unlikely, so
    what is guarded here is that both sides still use it and neither has re-derived the
    condition from its parts.
  */
  it('is one predicate, used by both sides', () => {
    for (const file of ['src/App.tsx', 'src/pages/Tickets.tsx']) {
      const code = read(file)
      expect(code, file).toContain('useTicketsLive()')
      // Re-deriving it from the halves is the drift this is here to stop.
      expect(code, file).not.toMatch(/hasDropped\s*\(/)
      expect(code, file).not.toMatch(/ticketsAvailable\s*\(/)
    }
  })

  it('replaces rather than pushes, so back does not bounce', () => {
    for (const file of ['src/App.tsx', 'src/pages/Tickets.tsx']) {
      expect(read(file), file).toMatch(/<Navigate[\s\S]*?\breplace\b/)
    }
  })

  it('sends people in opposite directions', () => {
    expect(read('src/App.tsx')).toMatch(/if \(live\) return <Navigate[\s\S]{0,80}ROUTES\.TICKETS/)
    expect(read('src/pages/Tickets.tsx')).toMatch(
      /if \(!live\) return <Navigate[\s\S]{0,80}ROUTES\.LANDING/,
    )
  })

  /*
    `<Navigate to="/tickets">` drops the query string, and this is the route ads point at.
    After the drop a click on `/?fbclid=…` would be forwarded to a clean URL and the
    attribution lost before captureAttribution, which runs further down the page, ever
    read it.
  */
  it('carries the query string across, so a paid click stays attributable', () => {
    for (const file of ['src/App.tsx', 'src/pages/Tickets.tsx']) {
      const code = read(file)
      expect(code, file).toContain('const { search } = useLocation()')
      expect(code, file).toMatch(/<Navigate to=\{\{ pathname: ROUTES\.\w+, search \}\}/)
    }
  })
})

describe('when there is nothing to sell with', () => {
  /*
    The date arrives whether or not anyone finished wiring TicketWeb up. This is the
    safety net: the page keeps doing what it was doing at 11:59 rather than replacing a
    working form with an empty section.
  */
  it('does not forward anyone off the landing page', () => {
    overrideTicket('url', '')
    overrideTicket('embedUrl', '')
    vi.setSystemTime(new Date(DROP_UTC))

    expect(ticketsAvailable()).toBe(false)
    // Which is what keeps `/` rendering, so the form below is what people still get.
    const { result } = renderHook(() => useTicketsLive())
    expect(result.current).toBe(false)

    renderAt(DROP_UTC)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('is also what the manual switch does', () => {
    overrideTicket('enabled', false)
    expect(ticketsAvailable()).toBe(false)
    expect(ticketsLive(new Date(DROP_UTC))).toBe(false)
  })

  /*
    The URL had to go into config days before the sale opened, so "there is a link" and
    "tickets are on sale" are two different questions. Every ticket link on the site is
    gated on the second one: the header control, the hero pill and the guestlist's closed
    panel all pointed at a live TicketWeb page selling nothing until this existed.
  */
  it('does not call tickets live merely because a URL exists', () => {
    expect(ticketsAvailable()).toBe(true)
    expect(ticketsLive(new Date(BEFORE))).toBe(false)
    expect(ticketsLive(new Date(DROP_UTC))).toBe(true)
  })

  it('falls back to the plain link when only the frame is missing', () => {
    overrideTicket('embedUrl', '')
    render(<TicketsSection vp={desktop} />)

    expect(screen.queryByTitle('Buy tickets')).toBeNull()
    // Promoted to the call to action, because with no frame there is nothing else to be.
    expect(screen.getByRole('link', { name: 'Get tickets' })).toHaveAttribute(
      'href',
      EVENT.tickets.url,
    )
    // And the escape hatch is gone, since there is nothing left to escape.
    expect(screen.queryByRole('link', { name: /Open in external tab/ })).toBeNull()
  })
})
