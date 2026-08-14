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
 * Brevo's SMS field wants digits with a country code — no dashes, spaces or
 * parentheses. It also accepts a leading `+`, which is what we already store.
 */
function sanitizePhone(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  return digits.length === 10 ? `1${digits}` : digits
}

export async function syncToBrevo(contact: BrevoContact): Promise<BrevoResult> {
  try {
    const apiKey = optionalEnv('BREVO_API_KEY')
    const listEnvName = LIST_ID_ENV[contact.ticketType]
    const listId = listEnvName ? optionalEnv(listEnvName) : undefined

    if (!apiKey) return { synced: false, reason: 'no_api_key' }
    if (!listId) return { synced: false, reason: `no_list_id (${listEnvName ?? 'unmapped'})` }

    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        email: contact.email,
        listIds: [Number(listId)],
        // Upsert. Makes a retry after a lost response harmless.
        updateEnabled: true,
        attributes: {
          FIRSTNAME: contact.firstName,
          LASTNAME: contact.lastName,
          SMS: sanitizePhone(contact.phone),
          OPT_IN: contact.consentOptIn,
          BIRTH_DATE: contact.dob,
        },
      }),
      signal: AbortSignal.timeout(2500),
    })

    if (!res.ok) {
      console.error('[brevo] sync failed:', res.status, await res.text())
      return { synced: false, reason: `http_${res.status}` }
    }

    // A 204 on update-existing has no body; a 201 on create returns { id }.
    const text = await res.text()
    const contactId = text ? String((JSON.parse(text) as { id?: number }).id ?? '') : undefined
    return { synced: true, contactId: contactId || undefined }
  } catch (err) {
    console.error('[brevo] sync threw (non-fatal):', String(err))
    return { synced: false, reason: 'exception' }
  }
}
