import { optionalEnv } from './env.js'
import type { TicketType } from './types.js'

/**
 * Brevo contact sync.
 *
 * ⚠️ OPT_IN and BIRTH_DATE are CUSTOM attributes, not Brevo defaults. Brevo silently
 * ignores any attribute that hasn't been pre-created in the dashboard — it does not
 * error, it just drops the field. If consent and DOB are arriving blank, that's why:
 * create them under Contacts → Settings → Contact Attributes (OPT_IN as boolean,
 * BIRTH_DATE as date). FIRSTNAME / LASTNAME / SMS are defaults and need no setup.
 *
 * Never throws. A Brevo outage must not cost us a signup that is already committed.
 */

/**
 * Which Brevo list each ticket type feeds.
 *
 * Written out explicitly so the gap is visible in code. Three of the six are wired:
 * presale-guestlist, friends-family and mailing-list. The rest resolve to undefined and
 * skip the sync with a logged reason rather than guessing at a list.
 *
 * The two guestlists point at DIFFERENT ids, which matters as much here as the separate
 * capacity pool does in the database. They are two audiences reached two different ways,
 * and once they are merged into one Brevo list they cannot be told apart again.
 */
const LIST_ID_ENV: Record<TicketType, string | undefined> = {
  'presale-guestlist': 'BREVO_LIST_ID_PRESALE',
  // The name predates this list: BREVO_LIST_ID_FRIENDS was already sitting unused in
  // .env from a superseded three-list plan, and it is what this list is. Holds list 43.
  'friends-family': 'BREVO_LIST_ID_FRIENDS',
  'mailing-list': 'BREVO_LIST_ID_MAILING',
  'early-access': 'BREVO_LIST_ID_EARLY_ACCESS',
  'general-onsale': 'BREVO_LIST_ID_GENERAL',
  'table-service': 'BREVO_LIST_ID_TABLE',
}

/**
 * The post-drop list, behind the two-field form on /tickets.
 *
 * NOT in the map above and not a sixth key on it: that record is keyed by `TicketType`, and
 * this flow has no ticket type. It is a mailing list reached from a page that sells through
 * TicketWeb, so there is no list config, no window and no capacity behind it.
 *
 * Also NOT the same list as BREVO_LIST_ID_MAILING, which is the PRE-drop one. Keeping them
 * apart is what makes this one sendable: the opt-in on the pre-drop form is optional, so
 * that list is not a lawful send list on its own and anything promotional has to go to a
 * segment filtered on OPT_IN (see the note above `attributesFor`). Everyone here submitted
 * under copy that states the agreement in the sentence above the button, so the whole list
 * can be mailed.
 */
const SUBSCRIBE_LIST_ENV = 'BREVO_LIST_ID_JUST_MAILING'

export type BrevoContact = {
  firstName: string
  lastName: string
  email: string
  /** E.164 already, e.g. +16045550123. */
  phone: string
  /** YYYY-MM-DD — Brevo accepts this regardless of the account's date display setting. */
  dob: string
  ticketType: TicketType
  consentOptIn: boolean
}

export type BrevoResult = { synced: boolean; contactId?: string; reason?: string }

/**
 * Brevo's SMS field wants E.164 — a leading `+`, the country code, digits, nothing
 * else. That is exactly what validate.toE164 already produced and what we store, so
 * this only strips separators a non-form caller could have slipped past it.
 *
 * It used to drop the `+` too, borrowed from the Meta hashing rules where digits-only
 * IS the spec (see hashPhone). Brevo's format is the opposite one; don't re-copy that.
 */
function sanitizePhone(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

/**
 * ⚠️ EVERY contact reaches the list, opted in or not.
 *
 * The marketing opt-in is optional on the form, and this function faithfully records
 * whichever answer was given in `OPT_IN`. It does not gate the sync on it: the address is
 * still needed for the transactional mail every list sends, and a contact who is on the
 * list with `OPT_IN = false` is the honest record of what happened.
 *
 * The consequence is that the Brevo list alone is NOT a lawful send list. Anything
 * promotional has to go to a segment filtered on `OPT_IN = true`. Sending to the raw list
 * mails people who explicitly declined, which is the thing CASL is about.
 */
function attributesFor(contact: BrevoContact, withPhone: boolean) {
  return {
    FIRSTNAME: contact.firstName,
    LASTNAME: contact.lastName,
    ...(withPhone ? { SMS: sanitizePhone(contact.phone) } : {}),
    OPT_IN: contact.consentOptIn,
    BIRTH_DATE: contact.dob,
  }
}

/**
 * Brevo's rejection for a number that isn't a real line, e.g. an unassigned area code:
 * 400 {"code":"invalid_parameter","message":"Invalid phone number"}.
 *
 * Our own toE164 only counts digits — it has no numbering-plan table and is not
 * getting one — so a plausible-looking number can pass validation here and still be
 * refused there.
 */
function isInvalidPhone(status: number, body: string): boolean {
  return status === 400 && /invalid phone/i.test(body)
}

export type SubscribeContact = { firstName: string; email: string }

/**
 * The two-field mailing-list subscribe, for POST /api/subscribe.
 *
 * ⚠️ THE ONE STRUCTURAL DIFFERENCE FROM `syncToBrevo` BELOW, AND IT IS THE WHOLE REASON THIS
 * IS A SEPARATE FUNCTION RATHER THAN A FLAG ON THAT ONE.
 *
 * There, Brevo is a side effect: the Supabase row is already committed by the time it runs,
 * so it swallows every failure and reports `synced: false` for a backfill to pick up. Here
 * Brevo IS the write. There is no row, nothing to backfill from, and a swallowed failure
 * would show someone a success message over an address that reached nothing at all. So this
 * returns a plain boolean the handler turns into a real error, and the form keeps what was
 * typed. Do not "harmonise" the two.
 *
 * `OPT_IN: true` is not assumed. The sentence under the submit button states the agreement
 * as a condition of signing up, so pressing it is the consent, and the exact wording lives
 * in OUTRO_SIGNUP_COPY in src/config/event.ts.
 */
export async function subscribeToBrevo(contact: SubscribeContact): Promise<BrevoResult> {
  try {
    const apiKey = optionalEnv('BREVO_API_KEY')
    const listId = optionalEnv(SUBSCRIBE_LIST_ENV)

    if (!apiKey) return { synced: false, reason: 'no_api_key' }
    if (!listId) return { synced: false, reason: `no_list_id (${SUBSCRIBE_LIST_ENV})` }

    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        email: contact.email,
        listIds: [Number(listId)],
        // Upsert, which is what makes a second submission of the same address harmless.
        // It also means a contact already known to Brevo from the pre-drop form is ADDED
        // to this list rather than moved, and has FIRSTNAME and OPT_IN rewritten on the
        // one shared contact record. Flipping OPT_IN to true is correct: they just agreed
        // to wording that says so.
        updateEnabled: true,
        // No LASTNAME, SMS or BIRTH_DATE. This form collects none of them, and Brevo
        // treats an absent attribute as "leave alone" rather than "clear".
        attributes: { FIRSTNAME: contact.firstName, OPT_IN: true },
      }),
      signal: AbortSignal.timeout(2500),
    })

    if (!res.ok) {
      console.error('[brevo] subscribe failed:', res.status, await res.text())
      return { synced: false, reason: `http_${res.status}` }
    }

    // A 204 on update-existing has no body; a 201 on create returns { id }.
    const text = await res.text()
    const contactId = text ? String((JSON.parse(text) as { id?: number }).id ?? '') : undefined
    return { synced: true, contactId: contactId || undefined }
  } catch (err) {
    console.error('[brevo] subscribe threw:', String(err))
    return { synced: false, reason: 'exception' }
  }
}

export async function syncToBrevo(contact: BrevoContact): Promise<BrevoResult> {
  try {
    const apiKey = optionalEnv('BREVO_API_KEY')
    const listEnvName = LIST_ID_ENV[contact.ticketType]
    const listId = listEnvName ? optionalEnv(listEnvName) : undefined

    if (!apiKey) return { synced: false, reason: 'no_api_key' }
    if (!listId) return { synced: false, reason: `no_list_id (${listEnvName ?? 'unmapped'})` }

    // ONE deadline for the sync as a whole, not one per request: the retry below must
    // not be able to spend a second 2.5s on top of the first. api/signup.ts awaits this
    // inside the user's response and budgets 2.5s for it.
    const signal = AbortSignal.timeout(2500)
    const post = (attributes: Record<string, unknown>) =>
      fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({
          email: contact.email,
          listIds: [Number(listId)],
          // Upsert. Makes a retry after a lost response harmless.
          updateEnabled: true,
          attributes,
        }),
        signal,
      })

    let res = await post(attributesFor(contact, true))
    let body = res.ok ? '' : await res.text()

    // Brevo 400s the WHOLE contact over the phone number, so one bad digit would
    // otherwise keep someone off the list entirely. The email address is what the
    // presale actually needs: retry without the number rather than lose the contact.
    // Supabase keeps the real one either way, so nothing is thrown away here.
    const phoneRejected = isInvalidPhone(res.status, body)
    if (phoneRejected) {
      res = await post(attributesFor(contact, false))
      body = res.ok ? '' : await res.text()
    }

    if (!res.ok) {
      console.error('[brevo] sync failed:', res.status, body)
      return { synced: false, reason: `http_${res.status}` }
    }

    // A 204 on update-existing has no body; a 201 on create returns { id }.
    const text = await res.text()
    const contactId = text ? String((JSON.parse(text) as { id?: number }).id ?? '') : undefined
    if (phoneRejected) {
      // No email in the log line — a Brevo contact id is enough to find the person and
      // does not put a signup's address in the platform's log retention.
      console.warn(
        '[brevo] phone number rejected; contact synced without SMS',
        contactId ? `(brevo id ${contactId})` : '',
      )
    }
    return { synced: true, contactId: contactId || undefined }
  } catch (err) {
    console.error('[brevo] sync threw (non-fatal):', String(err))
    return { synced: false, reason: 'exception' }
  }
}
