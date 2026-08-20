/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PageTracking from '../../src/components/PageTracking'
import { ROUTES } from '../../src/routes'

/**
 * The pixel used to live inside the signup form's section, which meant it existed on
 * exactly the two routes that render a form. `/tickets` — where every ad points from the
 * drop onward — and `/confirmed` fired nothing at all, and no route change after the
 * first load fired anything either, because a client-side navigation is invisible to a
 * pixel that only runs its snippet once.
 *
 * So these test the two halves of the fix: that every landing reports ONE page view, and
 * that the paths nobody stays on report NONE. The second half is not tidiness. Both of
 * this app's redirects are on the paid path — `/` forwards to `/tickets` after the drop —
 * so counting the doorway would inflate exactly the traffic being paid for.
 */

const trackPageView = vi.fn()
const initMetaPixel = vi.fn()
const captureAttribution = vi.fn()

vi.mock('../../src/lib/metaPixel', () => ({
  initMetaPixel: () => initMetaPixel(),
  trackPageView: () => trackPageView(),
  trackLead: vi.fn(),
}))
vi.mock('../../src/lib/attribution', () => ({
  captureAttribution: () => captureAttribution(),
  getAttribution: vi.fn(),
  getAttributionData: vi.fn(),
}))

const DROP_UTC = '2026-08-24T19:00:00Z'
const BEFORE_DROP = '2026-08-24T18:59:59Z'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(BEFORE_DROP))
  trackPageView.mockClear()
  initMetaPixel.mockClear()
  captureAttribution.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

/** A button that navigates, so a test can drive a real client-side route change. */
function Go({ to }: { to: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(to)}>
      go {to}
    </button>
  )
}

function landOn(path: string, targets: readonly string[] = []) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PageTracking />
      {targets.map((to) => (
        <Go key={to} to={to} />
      ))}
    </MemoryRouter>,
  )
}

async function go(to: string) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.click(screen.getByRole('button', { name: `go ${to}` }))
}

describe('setup', () => {
  it('initialises the pixel and captures attribution once, on any route', () => {
    landOn(ROUTES.PRIVACY)
    expect(initMetaPixel).toHaveBeenCalledTimes(1)
    expect(captureAttribution).toHaveBeenCalledTimes(1)
  })

  /**
   * The reason this component exists rather than a call inside ListSection: neither of
   * these routes renders a form, and one of them is the ad destination.
   */
  it.each([ROUTES.PRIVACY, ROUTES.CONFIRMED, ROUTES.GUESTLIST])(
    'reports a page view for %s, which has no signup form on it',
    (path) => {
      landOn(path)
      expect(trackPageView).toHaveBeenCalledTimes(1)
    },
  )
})

describe('one page view per page', () => {
  it('reports the landing page before the drop', () => {
    landOn(ROUTES.LANDING)
    expect(trackPageView).toHaveBeenCalledTimes(1)
  })

  it('reports a client-side route change, which the pixel cannot see on its own', async () => {
    landOn(ROUTES.LANDING, [ROUTES.CONFIRMED])
    expect(trackPageView).toHaveBeenCalledTimes(1)
    await go(ROUTES.CONFIRMED)
    expect(trackPageView).toHaveBeenCalledTimes(2)
  })

  it('does not re-report a path already reported', async () => {
    landOn(ROUTES.LANDING, [ROUTES.LANDING])
    expect(trackPageView).toHaveBeenCalledTimes(1)
    await go(ROUTES.LANDING)
    expect(trackPageView).toHaveBeenCalledTimes(1)
  })
})

describe('paths nobody stays on', () => {
  /**
   * The paid path. After the drop `/` renders for one commit and forwards to `/tickets`;
   * counting it would report two page views for one ad click.
   */
  it('does not count `/` once it has become a doorway to /tickets', () => {
    vi.setSystemTime(new Date(DROP_UTC))
    landOn(ROUTES.LANDING)
    expect(trackPageView).not.toHaveBeenCalled()
  })

  it('counts /tickets once it is the destination', () => {
    vi.setSystemTime(new Date(DROP_UTC))
    landOn(ROUTES.TICKETS)
    expect(trackPageView).toHaveBeenCalledTimes(1)
  })

  it('does not count /tickets while it still forwards back to `/`', () => {
    landOn(ROUTES.TICKETS)
    expect(trackPageView).not.toHaveBeenCalled()
  })

  it('counts the redirect hop from `/` to /tickets exactly once', async () => {
    vi.setSystemTime(new Date(DROP_UTC))
    landOn(ROUTES.LANDING, [ROUTES.TICKETS])
    // The route this component sees first is the one being left. It reports nothing...
    expect(trackPageView).not.toHaveBeenCalled()
    await go(ROUTES.TICKETS)
    // ...and the destination reports the visit, once.
    expect(trackPageView).toHaveBeenCalledTimes(1)
  })

  it('does not count /confirmation, which is an alias and never a destination', () => {
    landOn(ROUTES.CONFIRMATION)
    expect(trackPageView).not.toHaveBeenCalled()
  })

  /** A mistyped guestlist link is the common case, and it is not a visit to that page. */
  it('does not count an unknown path, which the catch-all sends to `/`', () => {
    landOn('/list-typo')
    expect(trackPageView).not.toHaveBeenCalled()
  })
})

describe('the live clock', () => {
  /**
   * The drop lands on an open tab. `/` stops being a page and becomes a doorway at that
   * instant, and the tracker has to agree with the redirect rather than report a view of
   * a page that is forwarding away.
   */
  it('stops counting `/` at the moment the drop lands', () => {
    landOn(ROUTES.LANDING, [ROUTES.CONFIRMED])
    expect(trackPageView).toHaveBeenCalledTimes(1)

    act(() => {
      vi.setSystemTime(new Date(DROP_UTC))
      vi.advanceTimersByTime(2000)
    })

    // Still one. The drop does not manufacture a second view of a page already counted.
    expect(trackPageView).toHaveBeenCalledTimes(1)
  })
})
