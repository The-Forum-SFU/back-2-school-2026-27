/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LandingBottom from '../../src/components/LandingBottom'
import Tickets from '../../src/pages/Tickets'
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

/**
 * The whole `/tickets` route, shell and all.
 *
 * Rendered as a page rather than as its parts, because the thing worth guarding is a
 * COMPOSITION: what the header does is decided by whether this route handed LandingShell a
 * `bottom` section, and what the first screen IS is decided by `openOnOutro`. Neither is
 * anything a control is passed directly. A test that rendered the controls in isolation
 * would keep passing through exactly the change it exists to catch.
 */
function renderTicketsAt(iso: string) {
  vi.setSystemTime(new Date(iso))
  return render(
    <MemoryRouter initialEntries={['/tickets']}>
      <Tickets />
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
  /*
    The page LINKS OUT. It used to embed TicketWeb's checkout in an iframe on a sheet of
    paper at the end of the scroll, with a plain link above the frame as the escape hatch
    for when it came up blank — which, inside Instagram's in-app browser, it did often
    enough that the hatch was carrying the page. Both are gone.
  */
  it('frames nothing and sells nothing on its own page', () => {
    renderTicketsAt(DROP_UTC)
    expect(screen.queryByTitle('Buy tickets')).toBeNull()
    expect(document.querySelector('iframe')).toBeNull()
  })

  /*
    THE HALF THAT IS EASY TO BREAK. Every ticket control reads `hasBottom`, which
    LandingShell derives from whether the route passed a `bottom` section. Putting one back
    turns all of these into scroll buttons pointed at a page that no longer has a checkout
    on it, and nothing in Tickets.tsx would have to change for that to happen.

    TWO of them, counted exactly: the header control and the filled link above the mailing
    list. The count is the assertion. There were two before the hero came off this route as
    well — the header and a pill on the hero rail — and the rail is gone, so a change that
    quietly dropped the second way to buy would otherwise pass everything here.
  */
  it('makes every ticket control a link out rather than a scroll', () => {
    renderTicketsAt(DROP_UTC)

    const links = screen.getAllByRole('link', { name: /TICKETS/i })
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveAttribute('href', EVENT.tickets.url)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }

    // The arrow is what promises a move down the page. Nothing on this route may wear one.
    expect(screen.queryByRole('button', { name: /TICKETS.*\u2193/ })).toBeNull()
    // And there is no paper sheet left for anything to travel to.
    expect(document.getElementById('signup')).toBeNull()
  })

  /* What replaces it: two fields on the outro screen itself. */
  it('carries the mailing-list strip on the outro instead', () => {
    renderTicketsAt(DROP_UTC)
    expect(screen.getByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByText('Join').tagName).toBe('BUTTON')
  })

  /*
    AND IT IS LIVE ON THE FIRST FRAME, which is the half that is easy to lose.

    This route has no hero. `openOnOutro` makes the outro screen the one somebody LANDS on,
    so the strip is not four viewports below where the visitor is standing any more — it is
    under their thumb. The layer's `opacity`, `visibility` and `pointerEvents` are still
    driven per frame by useScrollEngine, and it still goes inert through the gallery; what
    the three start at is what this pins down, because a stale `hidden` here is a form that
    is on screen, looks pressable, and is out of the accessibility tree.

    Reaching the button by ROLE is the real assertion. That query is accessibility-aware and
    was deliberately impossible to satisfy while this layer was hidden.
  */
  it('has that strip live on the screen people land on', () => {
    renderTicketsAt(DROP_UTC)

    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument()

    const layer = document.getElementById('outro-signup')
    expect(layer).not.toBeNull()
    expect(layer).toHaveStyle({ visibility: 'visible', pointerEvents: 'auto', opacity: '1' })
  })

  /*
    AND THERE IS A POINTER ON IT.

    The custom ring replaces the system cursor — `#scroll-spacer` carries `cursor: none` on
    desktop — so anything that hides the ring across the viewport leaves this screen with no
    pointer at all. useScrollEngine used to hide it whenever the outro block was live, which
    on every other route means the very bottom of the scroll and here means THE FIRST FRAME:
    `openOnOutro` starts the outro at full, so the page every ad points at opened with an
    invisible cursor everywhere outside one 330px column.

    Two assertions because the fix has two halves. The ring must survive the landing frame,
    and the block that brings the real cursor back must still say so, since that attribute is
    now the only thing stopping the two from being drawn at once.
  */
  it('keeps a cursor on the screen people land on', () => {
    renderTicketsAt(DROP_UTC)

    // The rule under test is written from inside useScrollEngine's RAF loop, so a render
    // alone proves nothing — without a frame this asserts the markup's initial style and
    // passes straight through the bug. Fake timers stand in for the frame.
    act(() => {
      vi.advanceTimersByTime(64)
    })

    const ring = document.getElementById('custom-cursor')
    expect(ring).not.toBeNull()
    // Not `toBeVisible`: `mix-blend-mode` and the spacer's own state are not what this is
    // about, and either property being 'hidden'/'0' is the bug.
    expect(ring?.style.visibility).not.toBe('hidden')
    expect(ring?.style.opacity).not.toBe('0')

    expect(document.getElementById('outro-signup')).toHaveAttribute('data-system-cursor')
  })

  /*
    THE HERO IS GONE, and these are the pieces of it.

    Asserted by absence because that is the only way it can be. Every one of these renders
    unconditionally on `/`, and each would come back on its own the moment `openOnOutro`
    stopped being passed — a bear standing in front of the offer on the page every ad points
    at, with nothing failing to say so.
  */
  it('opens on the artwork rather than on the hero', () => {
    renderTicketsAt(DROP_UTC)

    // The split-slider and its two image layers.
    expect(document.getElementById('main-canvas')).toBeNull()
    // The hero's own copy: the tagline on the left rail, and the slot under it.
    expect(document.getElementById('hero-caption')).toBeNull()
    expect(document.getElementById('hero-rail')).toBeNull()

    /*
      And the outro screen is painted rather than waiting to be scrolled to. These are the
      values of the frame BEFORE useScrollEngine's first tick, which on this route is a
      frame somebody is looking at — see `restOpacity` in LandingShell.
    */
    expect(document.getElementById('outro-keyart')).toHaveStyle({ opacity: '1' })
    expect(document.getElementById('outro-overlay')).toHaveStyle({ opacity: '1' })
    expect(document.getElementById('outro-footer')).toHaveStyle({ opacity: '1' })
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

  /*
    `embedUrl` is no longer rendered by anything, but it is still half of what
    `ticketsAvailable()` reads, and that predicate is what both routes redirect on. So it
    stays load-bearing in exactly one way: emptying it must not take the page down.
  */
  it('still sells with the frame URL emptied, since nothing frames it any more', () => {
    overrideTicket('embedUrl', '')
    expect(ticketsAvailable()).toBe(true)

    renderTicketsAt(DROP_UTC)
    expect(screen.getAllByRole('link', { name: /TICKETS/i })[0]).toHaveAttribute(
      'href',
      EVENT.tickets.url,
    )
  })
})
