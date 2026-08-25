/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ListSection from '../../src/components/ListSection'
import { LISTS } from '../../src/config/event'

/**
 * The friends & family guestlist as a browser actually renders it.
 *
 * The config guards in event.test.ts assert the STRINGS. These assert that they reach
 * the page, which is a different failure: `eyebrow` is optional on SignupCopy, so a
 * kicker that never renders is a passing config test and a page missing its title.
 *
 * Rendered through ListSection rather than through the route component, because that is
 * the only part of the page that differs. Everything above it is LandingShell, which is
 * byte-identical on both routes and has its own scroll machinery to stand up.
 */

// No server in jsdom. fetchListStatus swallows the failure and returns null, so the
// section falls back to the config phase, which is the pristine first frame anyway.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
})

const renderList = (ticketType: 'friends-family' | 'presale-guestlist') =>
  render(
    <MemoryRouter>
      <ListSection ticketType={ticketType} />
    </MemoryRouter>,
  )

describe('the friends & family list section', () => {
  it('titles the page with the kicker over the name', async () => {
    renderList('friends-family')
    // Two elements, read as one title: "FRIENDS & FAM" above "DISCOUNTED GUESTLIST".
    // The caps are `textTransform`, so the DOM carries the source casing.
    expect(await screen.findByText('Friends & fam')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /discounted guestlist/i }),
    ).toBeInTheDocument()
    // And NOT the promoter list's kicker, which is the line this replaced.
    expect(screen.queryByText('Early access')).toBeNull()
  })

  it('offers the same form and the same door rate as the promoter list', async () => {
    renderList('friends-family')
    expect(await screen.findByText('Get on the list')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /claim my \$5 spot/i })).toBeInTheDocument()
    // The disclaimer that makes this an RSVP and not a ticket has to be on the page,
    // not merely in the config: it is what someone is shown before they press submit.
    expect(screen.getByText(/This is not a ticket/)).toBeInTheDocument()
    expect(screen.getByText(/Enter the name you will give at the door/)).toBeInTheDocument()
  })

  it('leaves the promoter list exactly as it was', async () => {
    renderList('presale-guestlist')
    expect(await screen.findByText('Early access')).toBeInTheDocument()
    expect(screen.queryByText('Friends & fam')).toBeNull()
  })

  it('asks the server about its own list, which is where the pool is counted', async () => {
    renderList('friends-family')
    // A page polling the promoter list's status would show this one as full the moment
    // the OTHER list filled, and keep accepting after its own cap was reached.
    expect(fetch).toHaveBeenCalledWith('/api/list-status?ticketType=friends-family')
  })

  it('renders no inventory, on either list', async () => {
    /*
      Phrases, NOT a search for the capacity digits.

      A bare `not.toContain('75')` over the section fails on the date-of-birth year
      select, which lists 1975 like every other year back to 1930. The number being
      present in a dropdown of birth years is not the page publishing its cap, and a
      guard that cannot tell those apart is one somebody deletes the next time it cries
      wolf. The digits rule is enforced where it can be enforced precisely: over the
      config strings, in event.test.ts.

      What this checks instead is that nothing on the page COUNTS out loud. The server
      is what makes that true — /api/list-status returns a phase and no numbers — and
      this is the client half of the same rule.
    */
    for (const type of ['friends-family', 'presale-guestlist'] as const) {
      const { container, unmount } = renderList(type)
      await screen.findByRole('button', { name: /claim my \$5 spot/i })
      const text = container.textContent ?? ''
      expect(text, type).not.toMatch(/spots? (left|remaining|available)/i)
      expect(text, type).not.toMatch(/(?<!\$)\b\d+\s*(spots?|places?|seats?)\b/i)
      // new RegExp, not a literal: `${...}` inside /…/ is four literal characters, so a
      // regex literal here would assert against a string that can never appear.
      expect(text, type).not.toMatch(new RegExp(`\\bof ${LISTS[type].capacity}\\b`))
      unmount()
    }
  })
})
