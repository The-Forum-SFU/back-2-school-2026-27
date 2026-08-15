/**
 * @vitest-environment jsdom
 *
 * submitSignup reads captured attribution, which lives in sessionStorage and the
 * document's URL. That is browser code and it stays browser code; running this file
 * under jsdom is cheaper and more honest than stubbing a document into a node run.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchListStatus, submitSignup } from '../../src/lib/signupApi'
import { EMPTY_VALUES, type SignupValues } from '../../src/lib/validate'

/**
 * The browser's side of the contract.
 *
 * The rule this file exists to protect: neither function may ever throw or reject.
 * A transport failure, an HTML error page from the platform, and malformed JSON all
 * have to collapse into the same discriminated union, because the form's `switch` is
 * the only error handling there is.
 */

const VALUES: SignupValues = {
  ...EMPTY_VALUES,
  firstName: 'Jordan',
  lastName: 'Nguyen',
  email: 'jordan@example.com',
  phone: '604 555 0123',
  dobYear: '2004',
  dobMonth: '4',
  dobDay: '12',
}

const EXTRAS = {
  eventId: 'lead_abc',
  consentText: 'Opt in to email and SMS from The Forum.',
  privacyText: 'By signing up you agree to our Privacy Policy.',
  company: '',
  elapsedMs: 9000,
}

const fetchMock = vi.fn()

function respondWith(body: unknown, ok = true) {
  fetchMock.mockResolvedValueOnce({
    ok,
    json: async () => body,
  } as Response)
}

/** The JSON body of the most recent request. */
function sentBody(): Record<string, unknown> {
  const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit
  return JSON.parse(init.body as string)
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('sessionStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('submitSignup', () => {
  it('posts JSON to the signup endpoint', async () => {
    respondWith({ status: 'created', eventId: 'lead_abc' })
    const result = await submitSignup('presale-guestlist', VALUES, '2004-04-12', EXTRAS)

    expect(fetchMock).toHaveBeenCalledWith('/api/signup', expect.objectContaining({ method: 'POST' }))
    expect(result).toEqual({ status: 'created', eventId: 'lead_abc' })
  })

  it('sends both attestations as true, since neither is a checkbox any more', () => {
    // The birthdate carries the age attestation; the privacy notice above the submit
    // button is passive, and pressing submit is the act of agreement.
    respondWith({ status: 'created', eventId: 'lead_abc' })
    return submitSignup('presale-guestlist', VALUES, '2004-04-12', EXTRAS).then(() => {
      const body = sentBody()
      expect(body.ageConfirmed).toBe(true)
      expect(body.privacyAccepted).toBe(true)
    })
  })

  it('records the consent wording only when the box was ticked', async () => {
    respondWith({ status: 'created', eventId: 'x' })
    await submitSignup('presale-guestlist', { ...VALUES, consentOptIn: false }, '2004-04-12', EXTRAS)
    expect(sentBody().consentText).toBeNull()

    respondWith({ status: 'created', eventId: 'x' })
    await submitSignup('presale-guestlist', { ...VALUES, consentOptIn: true }, '2004-04-12', EXTRAS)
    expect(sentBody().consentText).toBe(EXTRAS.consentText)
  })

  it('always sends the privacy wording, ticked or not', async () => {
    respondWith({ status: 'created', eventId: 'x' })
    await submitSignup('presale-guestlist', { ...VALUES, consentOptIn: false }, '2004-04-12', EXTRAS)
    expect(sentBody().privacyText).toBe(EXTRAS.privacyText)
  })

  it('carries the honeypot and the elapsed time so the server can judge them', async () => {
    respondWith({ status: 'created', eventId: 'x' })
    await submitSignup('presale-guestlist', VALUES, '2004-04-12', { ...EXTRAS, company: 'Acme' })
    const body = sentBody()
    expect(body.company).toBe('Acme')
    expect(body.elapsedMs).toBe(9000)
  })

  it('maps a server "dob" error onto the field the form actually renders', async () => {
    // The form splits the date across three selects and keys its error under dobYear.
    // Without this translation the form refuses to submit with nothing marked.
    respondWith({ status: 'invalid', fieldErrors: { dob: 'Enter a valid date' } })
    const result = await submitSignup('presale-guestlist', VALUES, '2004-04-12', EXTRAS)
    expect(result).toEqual({ status: 'invalid', fieldErrors: { dobYear: 'Enter a valid date' } })
  })

  it('drops server errors for fields that no longer exist on the form', async () => {
    respondWith({
      status: 'invalid',
      fieldErrors: { ageConfirmed: 'Required', privacyAccepted: 'Required', email: 'Bad' },
    })
    const result = await submitSignup('presale-guestlist', VALUES, '2004-04-12', EXTRAS)
    expect(result).toEqual({ status: 'invalid', fieldErrors: { email: 'Bad' } })
  })

  it('returns an empty error map when nothing the form renders was rejected', async () => {
    // The form turns this into a banner rather than silently doing nothing.
    respondWith({ status: 'invalid', fieldErrors: { ageConfirmed: 'Required' } })
    const result = await submitSignup('presale-guestlist', VALUES, '2004-04-12', EXTRAS)
    expect(result).toEqual({ status: 'invalid', fieldErrors: {} })
  })

  it('passes every non-invalid status straight through', async () => {
    for (const status of ['already_registered', 'full', 'rate_limited', 'unknown_list']) {
      respondWith({ status })
      const result = await submitSignup('presale-guestlist', VALUES, '2004-04-12', EXTRAS)
      expect(result.status).toBe(status)
    }
  })

  it('turns a network failure into a terminal error instead of rejecting', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const result = await submitSignup('presale-guestlist', VALUES, '2004-04-12', EXTRAS)
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.message).toMatch(/connection/i)
  })

  it('survives an HTML error page from the platform', async () => {
    // A Vercel platform error returns HTML, so res.json() is what fails — which is
    // exactly why this never branches on res.ok.
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    } as unknown as Response)
    const result = await submitSignup('presale-guestlist', VALUES, '2004-04-12', EXTRAS)
    expect(result.status).toBe('error')
  })

  it('never rejects, whatever fetch does', async () => {
    for (const failure of [new Error('boom'), 'a string', undefined]) {
      fetchMock.mockRejectedValueOnce(failure)
      await expect(
        submitSignup('presale-guestlist', VALUES, '2004-04-12', EXTRAS),
      ).resolves.toMatchObject({ status: 'error' })
    }
  })
})

describe('fetchListStatus', () => {
  it('returns the parsed status', async () => {
    const status = {
      ticketType: 'presale-guestlist',
      phase: 'open',
      opensAt: 'a',
      closesAt: 'b',
    }
    respondWith(status)
    expect(await fetchListStatus('presale-guestlist')).toEqual(status)
  })

  it('encodes the ticket type into the query string', async () => {
    respondWith({})
    await fetchListStatus('presale-guestlist')
    expect(fetchMock).toHaveBeenCalledWith('/api/list-status?ticketType=presale-guestlist')
  })

  it('returns null rather than throwing when the request fails', async () => {
    respondWith({}, false)
    expect(await fetchListStatus('presale-guestlist')).toBeNull()

    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    expect(await fetchListStatus('presale-guestlist')).toBeNull()
  })
})
