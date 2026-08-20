/**
 * Meta Pixel loader.
 *
 * Injected from JS rather than from index.html, because Vite's `%VITE_META_PIXEL_ID%`
 * HTML interpolation leaves the LITERAL string in the markup when the var is unset.
 * That would initialise a pixel whose id is the string "%VITE_META_PIXEL_ID%".
 *
 * Everything here no-ops when VITE_META_PIXEL_ID is absent, so a deploy preview with
 * no pixel configured behaves like the real site minus the reporting.
 *
 * WHO CALLS THIS. `PageTracking`, mounted once at the router root, and nothing else.
 * It used to be `ListSection`, which meant the pixel only existed on the two routes
 * that render a signup form: `/tickets` — the page every ad points at from the drop
 * onward — `/confirmed` and `/privacy` fired nothing at all. Init belongs to the app,
 * not to one section of one page.
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
  // script loads, which is why trackPageView and trackLead can fire immediately after.
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
    // Meta's own snippet indexes [0] and dereferences it. That is safe in a document
    // that already has a script tag and a crash in one that does not, and the throw
    // lands inside a React effect and takes the whole page down with it. Since this
    // now runs at the router root on EVERY route, appending to <head> is the fallback
    // rather than a nicety.
    const s = b.getElementsByTagName(e)[0]
    if (s?.parentNode) s.parentNode.insertBefore(t, s)
    else b.head.appendChild(t)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  /* eslint-enable */

  window.fbq?.('init', pixelId)
  return true
}

/**
 * Fires PageView.
 *
 * NOT folded into `initMetaPixel` any more, and that separation is the whole point of
 * this pass. This is a single-page app: after the first load, a route change moves the
 * visitor to a new page without a new document, so nothing re-fires the pixel's own
 * automatic PageView. Meta then reports one page view per SESSION rather than per page,
 * and `/tickets` — which visitors reach by a client-side redirect from `/` — records
 * none of its own. PageTracking calls this once per distinct path instead.
 */
export function trackPageView(): void {
  if (!initialized || typeof window === 'undefined') return
  window.fbq?.('track', 'PageView')
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
