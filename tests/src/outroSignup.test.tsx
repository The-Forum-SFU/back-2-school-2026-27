/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OutroSignup from '../../src/components/OutroSignup'
import { OUTRO_SIGNUP_COPY } from '../../src/config/event'
import { SFU_EMAIL_ERROR } from '../../src/lib/validate'
import { ROUTES } from '../../src/routes'

/**
 * The two-field mailing-list strip at the end of /tickets.
 *
 * What is worth guarding here is not the layout. It is the consent sentence, which is a
 * promise about what someone agreed to and the only reason the list behind this form can be
 * mailed at all, and the failure path — because there is no database row behind this write,
 * so losing what was typed loses the signup outright.
 */

const submitSubscribe = vi.hoisted(() => vi.fn())
vi.mock('../../src/lib/subscribeApi', () => ({ submitSubscribe }))

/** The mount-time bot trap rejects anything under 2s, so the clock has to move. */
async function fillAndSubmit(first = 'Jordan', email = 'jordan@example.com') {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.clear(screen.getByLabelText('First name'))
  await user.type(screen.getByLabelText('First name'), first)
  await user.clear(screen.getByLabelText('Email'))
  await user.type(screen.getByLabelText('Email'), email)
  await user.click(screen.getByText(OUTRO_SIGNUP_COPY.submitLabel))
  return user
}

beforeEach(() => {
  submitSubscribe.mockReset()
  submitSubscribe.mockResolvedValue({ status: 'subscribed' })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('what it asks for', () => {
  it('collects a first name and an email, and nothing else', () => {
    render(<OutroSignup />)

    expect(screen.getByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()

    // Every other field the signup form asks for. None of them belongs here: this is a
    // mailing list, so there is no door to be old enough for and no number to text.
    for (const label of ['Last name', 'Phone', 'Birth month']) {
      expect(screen.queryByLabelText(label)).toBeNull()
    }
    // And no checkbox at all. The sentence under the button IS the consent.
    expect(screen.queryByRole('checkbox', { hidden: true })).toBeNull()
  })

  it('keeps both inputs at 16px, which is what stops iOS zooming on focus', () => {
    render(<OutroSignup />)
    for (const label of ['First name', 'Email']) {
      expect(screen.getByLabelText(label)).toHaveStyle({ fontSize: '16px' })
    }
  })
})

describe('the consent sentence', () => {
  /*
    Recorded verbatim because it is the agreement itself. Everyone on this list is there
    under this wording, and it is what makes the list sendable without a segment filter on
    OPT_IN — see the note on SUBSCRIBE_LIST_ENV in api/_lib/brevo.ts. A copy edit here is a
    change to what people agreed to, so it should have to come past this test.
  */
  it('reads exactly as written, in one sentence', () => {
    const { container } = render(<OutroSignup />)
    expect(container.textContent).toContain(
      'By signing up, you are agreeing to our Privacy Policy, and agree to receiving ' +
        'promotional emails from The Forum. You can unsubscribe anytime.',
    )
  })

  it('says nothing about SMS, which this form cannot collect', () => {
    const { container } = render(<OutroSignup />)
    expect(container.textContent).not.toMatch(/SMS/i)
  })

  it('links the privacy policy out of the sentence, in a new tab', () => {
    render(<OutroSignup />)
    const link = screen.getByText('Privacy Policy')
    expect(link).toHaveAttribute('href', ROUTES.PRIVACY)
    // An in-app navigation would unmount this form and destroy what was typed.
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

describe('validation', () => {
  it('refuses to submit an empty form, and marks the first field', async () => {
    const user = userEvent.setup()
    render(<OutroSignup />)

    await user.click(screen.getByText(OUTRO_SIGNUP_COPY.submitLabel))

    expect(submitSubscribe).not.toHaveBeenCalled()
    expect(screen.getByLabelText('First name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('First name')).toHaveFocus()
  })

  it('refuses a malformed address', async () => {
    const user = userEvent.setup()
    render(<OutroSignup />)

    await user.type(screen.getByLabelText('First name'), 'Jordan')
    await user.type(screen.getByLabelText('Email'), 'jordan@')
    await user.click(screen.getByText(OUTRO_SIGNUP_COPY.submitLabel))

    expect(submitSubscribe).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  /*
    The same refusal as every other form on the site, and for the same reason: SFU's filters
    quarantine bulk mail, so an address collected here is one that never receives anything.
  */
  it('refuses an @sfu.ca address with the shared wording', async () => {
    const user = userEvent.setup()
    render(<OutroSignup />)

    await user.type(screen.getByLabelText('First name'), 'Jordan')
    await user.type(screen.getByLabelText('Email'), 'jordan@sfu.ca')
    await user.click(screen.getByText(OUTRO_SIGNUP_COPY.submitLabel))

    expect(screen.getByRole('alert')).toHaveTextContent(SFU_EMAIL_ERROR)
    expect(submitSubscribe).not.toHaveBeenCalled()
  })

  /*
    The error takes the fine print's PLACE rather than stacking under it. This block sits in
    roughly 141px of band between the footer and the SEPT 20 stamp on a small phone; a line
    that appends would push it into the stamp.
  */
  it('swaps the fine print for the error rather than adding a line', async () => {
    const user = userEvent.setup()
    const { container } = render(<OutroSignup />)

    await user.click(screen.getByText(OUTRO_SIGNUP_COPY.submitLabel))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(container.textContent).not.toContain('You can unsubscribe anytime.')
  })
})

describe('submitting', () => {
  it('sends the two fields with the honeypot empty and a real elapsed time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<OutroSignup />)
    vi.advanceTimersByTime(5_000)

    await fillAndSubmit()

    await waitFor(() => expect(submitSubscribe).toHaveBeenCalledTimes(1))
    const [values, extras] = submitSubscribe.mock.calls[0]
    expect(values).toEqual({ firstName: 'Jordan', email: 'jordan@example.com' })
    expect(extras.company).toBe('')
    expect(extras.elapsedMs).toBeGreaterThanOrEqual(5_000)
  })

  it('replaces the row with a confirmation once it lands', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<OutroSignup />)
    vi.advanceTimersByTime(5_000)

    await fillAndSubmit()

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(OUTRO_SIGNUP_COPY.successBody),
    )
    expect(screen.queryByLabelText('Email')).toBeNull()
  })

  /*
    NOTHING ABOUT AN INBOX. api/subscribe.ts writes to Brevo and sends no mail, and the list
    it writes to is a new one with no automation behind it, so "check your inbox" would be
    telling people to wait for something that is never coming.
  */
  it('promises no email it cannot send', () => {
    expect(OUTRO_SIGNUP_COPY.successBody).not.toMatch(/inbox|spam|confirmation email/i)
  })

  /*
    THE FAILURE PATH, AND WHY IT MATTERS MORE HERE THAN ON THE SIGNUP FORM. There, a failed
    Brevo sync sits behind a committed database row and a backfill can pick it up. Here Brevo
    is the only write: if this form clears itself on an error, the address is gone and there
    is no record anywhere that it was ever typed. So a retry has to be one click.
  */
  it('keeps what was typed when the request fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    submitSubscribe.mockResolvedValue({ status: 'error', message: 'Could not reach the server.' })

    render(<OutroSignup />)
    vi.advanceTimersByTime(5_000)
    await fillAndSubmit()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Could not reach/))
    expect(screen.getByLabelText('First name')).toHaveValue('Jordan')
    expect(screen.getByLabelText('Email')).toHaveValue('jordan@example.com')
  })

  it('marks the field the server rejected', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    submitSubscribe.mockResolvedValue({
      status: 'invalid',
      fieldErrors: { email: 'Enter a valid email address' },
    })

    render(<OutroSignup />)
    vi.advanceTimersByTime(5_000)
    await fillAndSubmit()

    await waitFor(() =>
      expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true'),
    )
  })

  /*
    An `invalid` with nothing this form can render is what the server answers when a bot trap
    trips or a body is malformed. Saying something generic beats a form that silently refuses
    to submit with no visible reason.
  */
  it('says something out loud when there is nothing to mark', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    submitSubscribe.mockResolvedValue({ status: 'invalid', fieldErrors: {} })

    render(<OutroSignup />)
    vi.advanceTimersByTime(5_000)
    await fillAndSubmit()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/went wrong/i))
  })
})
