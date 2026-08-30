/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import VipConfirmed from '../../src/pages/VipConfirmed'
import { calendarUrl, EVENT, money, VIP_CONFIRMED_COPY } from '../../src/config/event'
import { ROUTES } from '../../src/routes'

/**
 * The VIP confirmation page.
 *
 * Two things make this page different from /confirmed and both are load-bearing. It is
 * FREE ENTRY, so any price on it is describing an offer that does not exist. And it is
 * reached by a redirect from a Brevo-hosted form on a cold page load, so it never has
 * router state — the no-state case is not a fallback here, it is the only case.
 */

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[ROUTES.VIP_CONFIRMED]}>
      <VipConfirmed />
    </MemoryRouter>,
  )
}

describe('arriving from Brevo', () => {
  /*
    The only way anyone reaches this page. Brevo's "after submission → redirect to a URL"
    setting is an ordinary navigation to an absolute URL, so the SPA boots from scratch
    and there is no history entry carrying state. A page that needed state would render
    blank for every single visitor.
  */
  it('renders with no router state at all', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: VIP_CONFIRMED_COPY.title })).toBeTruthy()
  })

  it('tells them their confirmation is coming', () => {
    const { container } = renderPage()
    expect(container.textContent).toContain(VIP_CONFIRMED_COPY.body)
    // The Brevo form's own success panel says to check their email. This page is the
    // second half of that sentence and has to agree with it.
    expect(VIP_CONFIRMED_COPY.body.toLowerCase()).toContain('inbox')
  })

  it('names nobody, because it cannot', () => {
    // An unfilled {name} or a stray "undefined" is what a placeholder written for the
    // other page looks like once it lands here.
    const { container } = renderPage()
    expect(container.textContent).not.toMatch(/\{[a-z]+\}/i)
    expect(container.textContent).not.toContain('undefined')
  })
})

describe('prices', () => {
  /*
    The whole reason this is a separate page. /confirmed leads with a $5-versus-$30
    comparison and a door panel telling people to bring cash; this list costs nothing, so
    every one of those lines is a promise about a transaction that will never happen.
  */
  it('shows no price anywhere on the page', () => {
    const { container } = renderPage()
    expect(container.textContent).not.toMatch(/\$\s?\d/)
  })

  it('shows none of the figures the other confirmation page carries', () => {
    const { container } = renderPage()
    const text = container.textContent ?? ''
    for (const cents of [
      EVENT.pricing.doorEarlyCents,
      EVENT.pricing.doorLateCents,
      EVENT.pricing.earlyBirdCents,
      EVENT.pricing.ticketAllInCents,
    ]) {
      expect(text, money(cents)).not.toContain(money(cents))
    }
  })

  it('does not render the price comparison', () => {
    const { container } = renderPage()
    const text = container.textContent ?? ''
    // Its two labels, and the discount framing it exists to sell.
    expect(text).not.toMatch(/at the door/i)
    expect(text).not.toMatch(/% off/i)
    expect(text).not.toMatch(/\bsave\b/i)
  })

  it('promises no cash and no rate cutoff at the door', () => {
    // GUESTLIST_DOOR_INSTRUCTIONS says "bring $5 cash" and names a cutoff after which
    // the rate changes. Both are price mechanics. Copying that panel across without
    // stripping them is the likeliest way this page goes wrong.
    const { container } = renderPage()
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/cash/i)
    expect(text).not.toMatch(/checked in before/i)
  })
})

describe('the door', () => {
  it('tells them the name has to match their ID', () => {
    // The Brevo form collects the name for exactly this reason, and this is the last
    // place to say so before somebody is standing in front of door staff.
    const { container } = renderPage()
    const text = container.textContent ?? ''
    expect(text).toMatch(/exact name/i)
    expect(text).toMatch(/ID/)
  })

  it('reads its facts from EVENT rather than repeating them', () => {
    const { container } = renderPage()
    const text = container.textContent ?? ''
    expect(text).toContain(EVENT.venue.doorsOpen)
    expect(text).toContain(EVENT.venue.idRequirement)
    expect(text).toContain(EVENT.venue.ageRestriction)
  })

  it('agrees with the event details block below it', () => {
    // Two blocks naming the same door time is fine; two blocks naming DIFFERENT door
    // times is the failure this guards, and it can only happen if one of them hardcodes.
    const { container } = renderPage()
    const occurrences = (container.textContent ?? '').split(EVENT.venue.doorsOpen).length - 1
    expect(occurrences).toBeGreaterThanOrEqual(2)
  })

  it('names the venue', () => {
    const { container } = renderPage()
    expect(container.textContent).toContain(EVENT.venue.name)
  })
})

describe('add to calendar', () => {
  it('links to the shared calendar URL', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /add to calendar/i })
    // Not a hand-built link: calendarUrl() is what /confirmed uses, and a second copy
    // of the date arithmetic is a second chance to be an hour out.
    expect(link.getAttribute('href')).toBe(calendarUrl())
  })

  it('opens in a new tab without handing over the referrer', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /add to calendar/i })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })
})

describe('discoverability', () => {
  it('is noindex while it is mounted', () => {
    const { unmount } = renderPage()
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    )
    unmount()
    // useNoIndex removes it on unmount, so a client-side navigation away does not leave
    // the tag behind on a public route.
    expect(document.querySelector('meta[name="robots"]')).toBeNull()
  })
})
