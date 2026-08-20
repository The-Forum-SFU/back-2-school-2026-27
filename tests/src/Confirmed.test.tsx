/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Confirmed, { type ConfirmedState } from '../../src/pages/Confirmed'
import { EVENT } from '../../src/config/event'
import { ROUTES } from '../../src/routes'

/**
 * The confirmation page carries the door instructions, so most of these are about it
 * saying the right thing to someone standing in a line on the night — and about it
 * still saying it when the router state is gone.
 */

const STATE: ConfirmedState = {
  firstName: 'Jordan',
  lastName: 'Nguyen',
  email: 'jordan@example.com',
  isNew: true,
}

function renderPage(state: unknown = STATE) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: ROUTES.CONFIRMED, state }]}>
      <Confirmed />
    </MemoryRouter>,
  )
}

describe('when the signup was not the guestlist', () => {
  /*
    This page hardcoded the guestlist config while that was the only list with a form.
    It is now also where the public mailing list lands, and everything the guestlist
    panel says is a promise about a door that nobody is holding for these people: a
    discounted rate, a cash amount, a check-in cutoff. Getting this wrong does not look
    like a bug on screen, it looks like an argument at the door.
  */
  const MAILING: ConfirmedState = { ...STATE, ticketType: 'mailing-list' }

  it('promises nothing at the door', () => {
    renderPage(MAILING)
    expect(screen.queryByText(/Give the staff the exact name/)).toBeNull()
    expect(screen.queryByText(/bring \$5 cash/)).toBeNull()
    expect(screen.queryByText(/checked in before/)).toBeNull()
  })

  it('does not show the guestlist price comparison', () => {
    renderPage(MAILING)
    expect(screen.queryByText(/discounted guestlist/i)).toBeNull()
  })

  it('still confirms the signup and still gives the event details', () => {
    renderPage(MAILING)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('You are on the list.')
    expect(screen.getByText(/Check your inbox/)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(EVENT.venue.name))).toBeInTheDocument()
  })

  it('falls back to the guestlist for state written before the field existed', () => {
    // A history entry pushed by the previous build carries no ticketType, and reloading
    // onto it has to keep rendering the page it was written for.
    renderPage(STATE)
    expect(screen.getByText(/Give the staff the exact name/)).toBeInTheDocument()
  })

  it('ignores a ticketType that is not a list', () => {
    renderPage({ ...STATE, ticketType: 'not-a-list' })
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})

describe('with the state the form hands over', () => {
  it('sends them to their inbox rather than restating the rate', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('You are on the list.')
    expect(screen.getByText(/Check your inbox for your confirmation email/)).toBeInTheDocument()
    expect(screen.getByText(/Check spam and promotions too/)).toBeInTheDocument()
  })

  it('prints the exact name to give at the door', () => {
    renderPage()
    expect(screen.getByText(/Give the staff the exact name you entered, Jordan Nguyen,/)).toBeInTheDocument()
  })

  it('gives the rest of the door instructions in one paragraph', () => {
    renderPage()
    expect(screen.getByText('Important note')).toBeInTheDocument()
    // One block now, not four bullets, so every fact is asserted on the same node.
    const note = screen.getByText(/Give the staff the exact name you entered/)
    expect(note).toHaveTextContent('Arrive by 9:30 PM when doors open.')
    expect(note).toHaveTextContent('bring $5 cash and two pieces of government ID')
    expect(note).toHaveTextContent('checked in before 10:30 PM for the $5 rate')
    expect(note).toHaveTextContent('after 10:30 PM, you will be charged a regular discounted rate at $15')
  })

  it('says nothing about an email it cannot know was delivered', () => {
    renderPage()
    // The old page named the address back at them. The subhead points at the inbox
    // without claiming anything about what is in it.
    expect(screen.queryByText(/We just sent your confirmation/)).not.toBeInTheDocument()
  })


  it('keeps the "already" headline for a repeat submission', () => {
    renderPage({ ...STATE, isNew: false })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'You are already on the list.',
    )
    // Headline only. The body is the same either way, because the next thing they need
    // is their inbox whether or not this was the submission that put them on the list.
    expect(screen.getByText(/Check your inbox for your confirmation email/)).toBeInTheDocument()
  })
})

describe('without state, which is every refresh and pasted link', () => {
  it('still renders the page rather than a blank screen', () => {
    renderPage(null)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('You are on the list.')
    expect(screen.getByText('Important note')).toBeInTheDocument()
    // The subhead names nobody, so it is correct here without a separate no-state copy.
    expect(screen.getByText(/Check your inbox for your confirmation email/)).toBeInTheDocument()
  })

  it('describes the name instead of printing an empty one', () => {
    renderPage(null)
    expect(screen.getByText(/the exact name you entered, the name you entered,/)).toBeInTheDocument()
    expect(screen.queryByText(/entered, ,/)).not.toBeInTheDocument()
  })

  it('ignores a state object that is the wrong shape', () => {
    // Router state is not trusted input, but it is arbitrary: anything can push a
    // history entry with a state of its own choosing.
    for (const junk of [{ firstName: 42 }, 'a string', [], { email: null }]) {
      const { unmount } = renderPage(junk)
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(document.body.textContent).not.toContain('undefined')
      unmount()
    }
  })
})

describe('the rest of the page', () => {
  it('carries the logo as the only navigation, pointing at the site root', () => {
    renderPage()
    const links = screen.getAllByRole('link')
    const home = links.find((l) => l.getAttribute('href') === '/')
    expect(home).toBeTruthy()
    expect(home).toHaveAccessibleName(/The Forum University/)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('states the event details', () => {
    renderPage()
    expect(screen.getByText("Rewind: SFU's Biggest Back to School Party")).toBeInTheDocument()
    expect(screen.getByText('Sunday, September 20')).toBeInTheDocument()
    expect(screen.getByText('Doors 9:30 PM')).toBeInTheDocument()
    expect(screen.getByText('19+, two pieces of government ID')).toBeInTheDocument()
  })

  it('omits the venue address line until there is an address', () => {
    renderPage()
    expect(EVENT.venue.address).toBeNull()
    // "Celebrities Nightclub," with a dangling comma is worse than the name alone.
    expect(screen.getByText('Celebrities Nightclub')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('Celebrities Nightclub,')
  })

  it('offers a calendar link that opens rather than downloading', () => {
    renderPage()
    const link = screen.getByRole('link', { name: 'Add to calendar' })
    expect(link).toHaveAttribute('href', expect.stringContaining('calendar.google.com'))
    expect(link).not.toHaveAttribute('download')
  })

  it('shows the rates without publishing any inventory', () => {
    const { container } = renderPage()
    expect(container.textContent).toContain('$5')
    expect(container.textContent).toContain('$15')
    expect(container.textContent).not.toMatch(/(?<!\$)\b\d+\s*spots?\b/i)
    expect(container.textContent).not.toMatch(/\b(you are|spot) #?\d+\b/i)
    expect(container.textContent).not.toMatch(/\d+ (left|remaining|of 75)/i)
  })
})
