import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeToBrevo, syncToBrevo, type BrevoContact } from '../../api/_lib/brevo'

/**
 * The Brevo contact sync.
 *
 * Everything here is about a failure mode that is invisible from the outside: the row
 * is already committed when this runs, the handler cannot fail the response over it,
 * and Brevo answers 400 in a body nobody reads. The tests are the only place the
 * request shape is pinned down.
 */

const CONTACT: BrevoContact = {
  firstName: 'Jordan',
  lastName: 'Nguyen',
  email: 'jordan@example.com',
  phone: '+16045550123',
  dob: '2004-04-12',
  ticketType: 'presale-guestlist',
  consentOptIn: true,
}

/** The parsed JSON body of the nth fetch call. */
function sentBody(nth = 0): {
  email: string
  listIds: number[]
  updateEnabled: boolean
  attributes: Record<string, unknown>
} {
  const call = vi.mocked(fetch).mock.calls[nth]
  return JSON.parse((call?.[1] as RequestInit).body as string)
}

/** `null` rather than '': a 204 is a null-body status and Response rejects a body. */
function respond(status: number, body: string | null = null) {
  return new Response(body, { status })
}

beforeEach(() => {
  process.env.BREVO_API_KEY = 'test-key'
  process.env.BREVO_LIST_ID_PRESALE = '7'
  // Two different mailing lists on the same account. Both are set here precisely so the
  // tests below can catch a subscribe that posts to the wrong one.
  process.env.BREVO_LIST_ID_MAILING = '11'
  process.env.BREVO_LIST_ID_JUST_MAILING = '12'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(201, '{"id":42}')))
  // The 400 paths log on purpose; keep the run readable.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.BREVO_API_KEY
  delete process.env.BREVO_LIST_ID_PRESALE
  delete process.env.BREVO_LIST_ID_MAILING
  delete process.env.BREVO_LIST_ID_JUST_MAILING
})

describe('the request', () => {
  it('sends the phone in E.164, with the +, which is the format Brevo documents', async () => {
    // The regression this file was written for: SMS went out as bare digits, copied
    // from the Meta hashing rules where digits-only is correct.
    await syncToBrevo(CONTACT)
    expect(sentBody().attributes.SMS).toBe('+16045550123')
  })

  it('reduces a number that still has separators rather than passing it through', async () => {
    await syncToBrevo({ ...CONTACT, phone: '+1 (604) 555-0123' })
    expect(sentBody().attributes.SMS).toBe('+16045550123')
  })

  it('upserts onto the list for the ticket type, with the attributes the dashboard expects', async () => {
    await syncToBrevo(CONTACT)
    const body = sentBody()
    expect(body.email).toBe('jordan@example.com')
    expect(body.listIds).toEqual([7])
    expect(body.updateEnabled).toBe(true)
    expect(body.attributes).toMatchObject({
      FIRSTNAME: 'Jordan',
      LASTNAME: 'Nguyen',
      OPT_IN: true,
      BIRTH_DATE: '2004-04-12',
    })
  })

  it('returns the new contact id, and copes with the empty body of an update', async () => {
    expect(await syncToBrevo(CONTACT)).toEqual({ synced: true, contactId: '42' })

    vi.mocked(fetch).mockResolvedValue(respond(204))
    expect(await syncToBrevo(CONTACT)).toEqual({ synced: true, contactId: undefined })
  })
})

describe('a phone number Brevo will not accept', () => {
  const INVALID_PHONE = '{"code":"invalid_parameter","message":"Invalid phone number"}'

  beforeEach(() => {
    // Our toE164 only counts digits, so an unassigned area code like 233 passes
    // validation here and is refused there.
    vi.mocked(fetch)
      .mockResolvedValueOnce(respond(400, INVALID_PHONE))
      .mockResolvedValueOnce(respond(201, '{"id":42}'))
  })

  it('retries without the number rather than losing the contact', async () => {
    const result = await syncToBrevo({ ...CONTACT, phone: '+12332332333' })

    expect(result).toEqual({ synced: true, contactId: '42' })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(sentBody(0).attributes.SMS).toBe('+12332332333')
    expect(sentBody(1).attributes).not.toHaveProperty('SMS')
    // Everything else still has to land — a dropped phone is not a dropped signup.
    expect(sentBody(1).attributes).toMatchObject({ FIRSTNAME: 'Jordan', OPT_IN: true })
  })

  it('says so in the log, without putting the address in it', async () => {
    const warn = vi.spyOn(console, 'warn')
    await syncToBrevo({ ...CONTACT, phone: '+12332332333' })

    const logged = warn.mock.calls.flat().join(' ')
    expect(logged).toMatch(/phone/i)
    expect(logged).not.toContain('jordan@example.com')
  })

  it('gives up if the retry fails too, and reports the second status', async () => {
    vi.mocked(fetch)
      .mockReset()
      .mockResolvedValueOnce(respond(400, INVALID_PHONE))
      .mockResolvedValueOnce(respond(500, 'upstream is down'))

    expect(await syncToBrevo(CONTACT)).toEqual({ synced: false, reason: 'http_500' })
  })

  it('does not retry a 400 that is about something else', async () => {
    vi.mocked(fetch)
      .mockReset()
      .mockResolvedValue(respond(400, '{"code":"invalid_parameter","message":"Invalid email"}'))

    expect(await syncToBrevo(CONTACT)).toEqual({ synced: false, reason: 'http_400' })
    expect(fetch).toHaveBeenCalledOnce()
  })
})

describe('never taking a committed signup down with it', () => {
  it('skips quietly when the API key is missing', async () => {
    delete process.env.BREVO_API_KEY
    expect(await syncToBrevo(CONTACT)).toEqual({ synced: false, reason: 'no_api_key' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('skips, and names the variable, for a ticket type with no list id', async () => {
    const result = await syncToBrevo({ ...CONTACT, ticketType: 'table-service' })
    expect(result.synced).toBe(false)
    expect(result.reason).toContain('BREVO_LIST_ID_TABLE')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('swallows a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNRESET'))
    expect(await syncToBrevo(CONTACT)).toEqual({ synced: false, reason: 'exception' })
  })

  it('swallows a 2xx whose body is not the JSON it claims to be', async () => {
    vi.mocked(fetch).mockResolvedValue(respond(201, '<!doctype html>'))
    expect(await syncToBrevo(CONTACT)).toEqual({ synced: false, reason: 'exception' })
  })
})

/**
 * The two-field subscribe, behind the form at the end of /tickets.
 *
 * A separate function from `syncToBrevo` above rather than a flag on it, and these tests
 * pin the two differences that make it one: which list it writes to, and the fact that it
 * reports failure instead of absorbing it.
 */
describe('subscribeToBrevo', () => {
  const PERSON = { firstName: 'Jordan', email: 'jordan@example.com' }

  /*
    THE ONE MOST LIKELY TO BE GOT WRONG LATER, because both names are plausible and nothing
    at runtime complains. BREVO_LIST_ID_MAILING is the PRE-drop list, whose opt-in is
    optional, so it is not a lawful send list on its own. Posting this form's contacts there
    would quietly mix express consent in with people who declined it.
  */
  it('posts to the post-drop list and not the pre-drop one', async () => {
    await subscribeToBrevo(PERSON)
    expect(sentBody().listIds).toEqual([12])
    expect(sentBody().listIds).not.toContain(11)
  })

  it('sends only what the form collects', async () => {
    await subscribeToBrevo(PERSON)
    const body = sentBody()
    expect(body.email).toBe('jordan@example.com')
    expect(body.updateEnabled).toBe(true)
    // Exactly these two. LASTNAME, SMS and BIRTH_DATE are not collected, and sending them
    // empty would blank whatever a pre-drop signup already had on the shared contact.
    expect(body.attributes).toEqual({ FIRSTNAME: 'Jordan', OPT_IN: true })
  })

  /*
    Not assumed. The sentence under the submit button states the agreement as a condition of
    signing up, so pressing it IS the consent — which is the whole reason this list can be
    mailed without a segment filter. If the copy ever loses that sentence, this has to go
    with it.
  */
  it('records the opt-in as given', async () => {
    await subscribeToBrevo(PERSON)
    expect(sentBody().attributes.OPT_IN).toBe(true)
  })

  it('reports a failure rather than absorbing it, unlike the signup sync', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respond(400, '{"code":"invalid_parameter"}'))
    expect(await subscribeToBrevo(PERSON)).toEqual({ synced: false, reason: 'http_400' })
  })

  it('does not post at all with no list configured', async () => {
    delete process.env.BREVO_LIST_ID_JUST_MAILING
    const result = await subscribeToBrevo(PERSON)
    expect(result.synced).toBe(false)
    expect(result.reason).toContain('BREVO_LIST_ID_JUST_MAILING')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('never throws, whatever the network does', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('socket hang up'))
    expect(await subscribeToBrevo(PERSON)).toEqual({ synced: false, reason: 'exception' })
  })
})
