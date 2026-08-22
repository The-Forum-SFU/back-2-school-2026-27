import type { SubscribeFieldErrors, SubscribeValues } from './validate'

/**
 * Client for /api/subscribe — the two-field mailing-list form at the end of /tickets.
 *
 * Never throws and never rejects. Transport failures, HTML error pages from the platform,
 * and malformed JSON all collapse into a terminal `{ status: 'error' }` so the form only
 * ever handles the discriminated union. Same contract as src/lib/signupApi.ts, and for the
 * same reason: a form that can throw is a form that can lose what someone typed.
 */

/** Mirrors SubscribeResult in api/_lib/types.ts. */
export type SubscribeResponse =
  | { status: 'subscribed' }
  | { status: 'invalid'; fieldErrors: SubscribeFieldErrors }
  | { status: 'error'; message: string }

/**
 * The server can key an error under a field this form does not render — the shape guard on
 * a malformed body answers with one under `email`, which happens to exist here, but that is
 * luck rather than contract. Dropping unknown keys lets the form detect "invalid, with
 * nothing to mark" and say so out loud instead of refusing to submit for no visible reason.
 */
const RENDERED_FIELDS = ['firstName', 'email'] as const

function toClientErrors(raw: Record<string, string | undefined>): SubscribeFieldErrors {
  const mapped: SubscribeFieldErrors = {}
  for (const key of RENDERED_FIELDS) {
    if (raw[key]) mapped[key] = raw[key]
  }
  return mapped
}

export type SubscribeExtras = {
  /** Honeypot value — a real user leaves this empty. */
  company: string
  elapsedMs: number
}

export async function submitSubscribe(
  values: SubscribeValues,
  extras: SubscribeExtras,
): Promise<SubscribeResponse> {
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: values.firstName,
        email: values.email,
        company: extras.company,
        elapsedMs: extras.elapsedMs,
      }),
    })

    // Deliberately not branching on res.ok: a platform-level error returns an HTML body,
    // so res.json() is what actually fails, and the catch below owns it.
    const parsed = (await res.json()) as SubscribeResponse
    if (parsed.status === 'invalid') {
      return {
        status: 'invalid',
        fieldErrors: toClientErrors(
          parsed.fieldErrors as Record<string, string | undefined>,
        ),
      }
    }
    return parsed
  } catch {
    return {
      status: 'error',
      message: 'Could not reach the server. Check your connection and try again.',
    }
  }
}
