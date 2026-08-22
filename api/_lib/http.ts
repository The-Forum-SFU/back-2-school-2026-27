import type { VercelRequest } from '@vercel/node'

/**
 * Transport-level guards shared by every public POST handler.
 *
 * These lived as private functions inside api/signup.ts until /api/subscribe needed the
 * same two. A CSRF guard that exists in two copies is a CSRF guard that gets tightened in
 * one of them, so both handlers import from here rather than keeping a local twin.
 */

/**
 * Same-origin guard.
 *
 * A JSON POST already needs a CORS preflight, which these endpoints don't answer, so a
 * browser on another site can't read the response today. This closes the case where it
 * doesn't have to: a form-encoded or no-preflight variant fired from somewhere else
 * still reaches the handler, and "the attacker can't read the reply" is no comfort
 * when the side effect is the point.
 *
 * A missing Origin is allowed. Non-browser clients omit it entirely, and these endpoints
 * are public by design — the guard is about not being driven BY another origin, not
 * about proving the caller is a browser.
 */
export function originAllowed(req: VercelRequest): boolean {
  const raw = req.headers.origin
  const origin = Array.isArray(raw) ? raw[0] : raw
  if (!origin) return true
  const host = req.headers.host
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    // An unparseable Origin is a malformed or hand-built request, not a browser.
    return false
  }
}

/** Left-most XFF entry is the client; the rest are proxies. */
export function clientIp(req: VercelRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return raw?.split(',')[0]?.trim() || req.socket?.remoteAddress || undefined
}

/**
 * Is this body a plain JSON object?
 *
 * A JSON array, string or null all parse into `req.body` without being objects, and every
 * property read off one would be undefined — which reads as "empty form" rather than
 * "malformed request". Callers reject it as what it is.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
