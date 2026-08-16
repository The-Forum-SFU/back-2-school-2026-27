import { optionalEnv } from './env'
import type { TicketType } from './types'

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
 * Written out explicitly so the gap is visible in code: .env carries PRESALE, VIP and
 * FRIENDS — three ids from a superseded plan — against four ticket types. Only
 * presale-guestlist is wired for this pass; the rest resolve to undefined and skip
 * the sync with a logged reason rather than guessing at a list.
 */
const LIST_ID_ENV: Record<TicketType, string | undefined> = {
  'presale-guestlist': 'BREVO_LIST_ID_PRESALE',
  'early-access': 'BREVO_LIST_ID_EARLY_ACCESS',
  'general-onsale': 'BREVO_LIST_ID_GENERAL',
  'table-service': 'BREVO_LIST_ID_TABLE',
}

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
