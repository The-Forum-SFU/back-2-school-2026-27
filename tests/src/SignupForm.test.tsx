/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SignupForm from '../../src/components/SignupForm'
import { LISTS } from '../../src/config/event'
import type { SignupResponse } from '../../src/lib/signupApi'
import type { Viewport } from '../../src/lib/viewport'
import { ROUTES } from '../../src/routes'

const submitSignup = vi.hoisted(() => vi.fn())
const trackLead = vi.hoisted(() => vi.fn())

vi.mock('../../src/lib/signupApi', () => ({ submitSignup }))
vi.mock('../../src/lib/metaPixel', () => ({ trackLead, initMetaPixel: vi.fn() }))

const CFG = LISTS['presale-guestlist']
const VP: Viewport = {
  width: 1440,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouch: false,
  reducedMotion: false,
}

/** Renders the form inside a router and reports where it navigates to. */
function renderForm(onResult?: (r: SignupResponse) => void) {
  const seen: { path: string; state: unknown } = { path: ROUTES.GUESTLIST, state: null }

  function Probe() {
    const location = useLocation()
    seen.path = location.pathname
    seen.state = location.state
    return <p>confirmation page</p>
  }

  render(
    <MemoryRouter initialEntries={[ROUTES.GUESTLIST]}>
      <Routes>
        <Route path={ROUTES.GUESTLIST} element={<SignupForm cfg={CFG} vp={VP} onResult={onResult} />} />
        <Route path={ROUTES.CONFIRMED} element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
  return seen
}

/** Every field the form will not submit without — the opt-in among them. */
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Jordan')
  await user.type(screen.getByLabelText('Last name'), 'Nguyen')
  await user.type(screen.getByLabelText('Email'), 'jordan@example.com')
  await user.type(screen.getByLabelText('Phone'), '6045550123')
  await user.selectOptions(screen.getByLabelText('Birth month'), '4')
  await user.selectOptions(screen.getByLabelText('Birth day'), '12')
  await user.selectOptions(screen.getByLabelText('Birth year'), '2004')
  await user.click(screen.getByRole('checkbox'))
}

beforeEach(() => {
  submitSignup.mockResolvedValue({ status: 'created', eventId: 'lead_abc' })
})

describe('the form the build plan specifies', () => {
  it('asks for the five fields in order, and nothing else', () => {
    renderForm()
    const labels = screen
      .getAllByRole('textbox')
      .map((el) => el.getAttribute('id'))
    expect(labels).toEqual(['firstName', 'lastName', 'email', 'phone'])
    expect(screen.getByLabelText('Birth month')).toBeInTheDocument()
  })

  it('shows exactly one checkbox, the marketing opt-in, unticked', () => {
    renderForm()
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(1)
    expect(boxes[0]).toHaveAttribute('id', 'consentOptIn')
    expect(boxes[0]).not.toBeChecked()
  })

  it('warns off SFU addresses under the email field, before anything is typed', () => {
    renderForm()
    // Read from config rather than repeated here: this test is about the note being
    // present and wired to the input, not about its exact wording. The wording that IS
    // a spec is checked in event.test.ts.
    const note = screen.getByText(CFG.copy.emailNote)
    expect(note).toBeInTheDocument()
    // Wired to the input, not just floating near it.
    expect(screen.getByLabelText('Email').getAttribute('aria-describedby')).toContain(note.id)
  })

  it('states the privacy notice as text, not as something to tick', () => {
    renderForm()
    expect(screen.getByText(/By signing up you agree to our/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    )
  })

  it('discloses the venue name-sharing under the opt-in', () => {
    renderForm()
    expect(
      screen.getByText(
        /We share your name with our venue partner, Celebrities Nightclub, for guestlist check-in only\./,
      ),
    ).toBeInTheDocument()
  })

  it('shows the terms panel above the submit button', () => {
    renderForm()
    expect(screen.getByText('Before you submit')).toBeInTheDocument()
    expect(screen.getByText(/This is an RSVP, not a ticket/)).toBeInTheDocument()
    expect(screen.getByText(/\$15 after\./)).toBeInTheDocument()
  })

  it('labels the button with the rate it is claiming', () => {
    renderForm()
    expect(screen.getByRole('button', { name: 'Claim my $5 spot' })).toBeInTheDocument()
  })

  it('carries an off-screen honeypot that no real user can reach', () => {
    renderForm()
    const honeypot = document.getElementById('company') as HTMLInputElement
    expect(honeypot).toBeTruthy()
    expect(honeypot.tabIndex).toBe(-1)
    expect(honeypot.closest('[aria-hidden="true"]')).toBeTruthy()
  })

  it('publishes no spot count anywhere on the form', () => {
    const { container } = render(
      <MemoryRouter>
        <SignupForm cfg={CFG} vp={VP} />
      </MemoryRouter>,
    )
    expect(container.textContent).not.toMatch(/(?<!\$)\b\d+\s*spots?\b/i)
    expect(container.textContent).not.toMatch(/\d+ (left|remaining)/i)
  })
})

describe('validation', () => {
  it('refuses an empty submit and marks every missing field', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    expect(submitSignup).not.toHaveBeenCalled()
    expect(screen.getAllByText('Required').length).toBeGreaterThanOrEqual(4)
    // Focus lands on the first thing that needs fixing, not at the top of the page.
    expect(document.activeElement).toBe(screen.getByLabelText('First name'))
  })

  it('will not submit a complete form with the opt-in unticked', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('checkbox')) // back off again

    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    expect(submitSignup).not.toHaveBeenCalled()
    expect(screen.getByText('Tick this box to join the list')).toBeInTheDocument()
    // Nothing else is wrong, so the box is where the user is put.
    expect(document.activeElement).toBe(screen.getByRole('checkbox'))
  })

  it('submits once the opt-in is ticked', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))
    await waitFor(() => expect(submitSignup).toHaveBeenCalled())
  })

  it('will not submit an @sfu.ca address, and keeps the note visible alongside the error', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillValidForm(user)
    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'jordan@sfu.ca')
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    expect(submitSignup).not.toHaveBeenCalled()
    expect(screen.getByText(/miss your confirmation/)).toBeInTheDocument()
    // The advice that would have prevented this does not vanish when it is needed most.
    expect(screen.getByText(CFG.copy.emailNote)).toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByLabelText('Email'))
  })

  it('does not even offer a year that could not be 19 at the door', () => {
    renderForm()
    const years = [...screen.getByLabelText('Birth year').querySelectorAll('option')]
      .map((o) => o.value)
      .filter(Boolean)
      .map(Number)
    // The list starts 17 years back, so the picker is not a scroll through the 2020s.
    expect(Math.max(...years)).toBe(new Date().getFullYear() - 17)
  })

  it('rejects the youngest selectable year, which is still under 19 at the door', async () => {
    const tooYoung = String(new Date().getFullYear() - 17)
    const user = userEvent.setup()
    renderForm()
    await fillValidForm(user)
    await user.selectOptions(screen.getByLabelText('Birth year'), tooYoung)
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    expect(submitSignup).not.toHaveBeenCalled()
    expect(screen.getByText(/19 or older on the night of the event/)).toBeInTheDocument()
  })

  it('clears a field error as soon as the user starts fixing it', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0)

    await user.type(screen.getByLabelText('First name'), 'J')
    expect(screen.getByLabelText('First name')).not.toHaveAttribute('aria-invalid')
  })
})

describe('submission', () => {
  it('sends the opt-in and the exact wording that was ticked', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    await waitFor(() => expect(submitSignup).toHaveBeenCalled())
    const [ticketType, values, dob, extras] = submitSignup.mock.calls[0]
    expect(ticketType).toBe('presale-guestlist')
    expect(values.consentOptIn).toBe(true)
    expect(dob).toBe('2004-04-12')
    expect(extras.consentText).toBe(CFG.copy.consentLabel)
  })

  it('records the venue disclosure alongside the privacy notice, verbatim', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    await waitFor(() => expect(submitSignup).toHaveBeenCalled())
    const extras = submitSignup.mock.calls[0][3]
    expect(extras.privacyText).toContain('By signing up you agree to our Privacy Policy.')
    expect(extras.privacyText).toContain('Celebrities Nightclub')
  })

  it('lands on the confirmation page, carrying the name and email in router state', async () => {
    const user = userEvent.setup()
    const seen = renderForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    await waitFor(() => expect(seen.path).toBe(ROUTES.CONFIRMED))
    expect(seen.state).toEqual({
      firstName: 'Jordan',
      lastName: 'Nguyen',
      email: 'jordan@example.com',
      isNew: true,
    })
  })

  it('keeps the name and email out of the URL', async () => {
    const user = userEvent.setup()
    const seen = renderForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    await waitFor(() => expect(seen.path).toBe(ROUTES.CONFIRMED))
    expect(seen.path).not.toContain('jordan')
    expect(seen.path).not.toContain('@')
  })

  it('sends someone already on the list to the same page, marked as not new', async () => {
    submitSignup.mockResolvedValueOnce({ status: 'already_registered' })
    const user = userEvent.setup()
    const seen = renderForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    await waitFor(() => expect(seen.path).toBe(ROUTES.CONFIRMED))
    expect(seen.state).toMatchObject({ isNew: false })
    // Not a fresh conversion, so no second Lead.
    expect(trackLead).not.toHaveBeenCalled()
  })

  it('fires exactly one Lead, with the id the server echoed back', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    await waitFor(() => expect(trackLead).toHaveBeenCalledWith('lead_abc'))
    expect(trackLead).toHaveBeenCalledOnce()
  })

  it('reuses the same event id across a retry, so a lost response cannot double-count', async () => {
    submitSignup.mockResolvedValueOnce({ status: 'error', message: 'Network' })
    const user = userEvent.setup()
    renderForm()
    await fillValidForm(user)

    const button = screen.getByRole('button', { name: 'Claim my $5 spot' })
    await user.click(button)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    await user.click(button)

    await waitFor(() => expect(submitSignup).toHaveBeenCalledTimes(2))
    const [first, second] = submitSignup.mock.calls
    expect(first[3].eventId).toBe(second[3].eventId)
  })

  it('hands a full or closed list up to the section, which swaps the whole block', async () => {
    for (const status of ['full', 'closed', 'not_open'] as const) {
      submitSignup.mockResolvedValueOnce({ status, opensAt: 'a', closesAt: 'b' })
      const onResult = vi.fn()
      const seen = renderForm(onResult)
      const user = userEvent.setup()
      await fillValidForm(user)
      await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

      await waitFor(() => expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status })))
      // No navigation: these are not confirmations.
      expect(seen.path).toBe(ROUTES.GUESTLIST)
    }
  })
})

describe('error reporting', () => {
  it('shows a banner for a rate-limited attempt', async () => {
    submitSignup.mockResolvedValueOnce({ status: 'rate_limited' })
    const user = userEvent.setup()
    renderForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i)
  })

  it('marks the field the server rejected', async () => {
    submitSignup.mockResolvedValueOnce({
      status: 'invalid',
      fieldErrors: { email: 'Enter a valid email address' },
    })
    const user = userEvent.setup()
    renderForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Email')))
  })

  it('falls back to a banner when the rejection names no field it can mark', async () => {
    // Otherwise the form refuses to submit with nothing highlighted and no explanation.
    submitSignup.mockResolvedValueOnce({ status: 'invalid', fieldErrors: {} })
    const user = userEvent.setup()
    renderForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Claim my $5 spot' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i)
  })

  it('lets the user try again after a failure', async () => {
    submitSignup.mockResolvedValueOnce({ status: 'error', message: 'Could not reach the server.' })
    const user = userEvent.setup()
    renderForm()
    await fillValidForm(user)

    const button = screen.getByRole('button', { name: 'Claim my $5 spot' })
    await user.click(button)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(button).toBeEnabled()
  })
})
