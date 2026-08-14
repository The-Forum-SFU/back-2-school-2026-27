/**
 * Meta Pixel loader.
 *
 * Injected from the component that renders the form rather than from index.html.
 * Two reasons: the pixel then loads wherever the form is (landing page AND
 * /presale) without either mount point knowing about it, and — more importantly —
 * Vite's `%VITE_META_PIXEL_ID%` HTML interpolation leaves the LITERAL string in the
 * markup when the var is unset, which is today's state. That would initialise a
 * pixel whose id is the string "%VITE_META_PIXEL_ID%".
 *
 * Everything here no-ops when VITE_META_PIXEL_ID is absent.
 */

// Module scope, so StrictMode's double-invoked effects can't double-init.
let initialized = false

/** Returns false when no pixel id is configured. */
export function initMetaPixel(): boolean {
  if (typeof window === 'undefined') return false
  const pixelId = import.meta.env.VITE_META_PIXEL_ID
  if (!pixelId) return false
  if (initialized) return true
  initialized = true

  /* eslint-disable */
  // Meta's standard snippet, transcribed. The stub queues calls made before the
  // script loads, which is why trackLead can fire immediately after init.
  ;(function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
    })
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    const t = b.createElement(e) as HTMLScriptElement
    t.async = true
    t.src = v
    const s = b.getElementsByTagName(e)[0]
    s.parentNode?.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  /* eslint-enable */

  window.fbq?.('init', pixelId)
  window.fbq?.('track', 'PageView')
  return true
}

/**
 * Fires the browser-side Lead.
 *
 * `eventId` MUST be the same id the server sends to CAPI for this conversion, or
 * Meta counts the signup twice. Both sides fire only on a `created` result — see
 * api/signup.ts.
 */
export function trackLead(eventId: string): void {
  if (!initialized || typeof window === 'undefined') return
  window.fbq?.('track', 'Lead', {}, { eventID: eventId })
}
