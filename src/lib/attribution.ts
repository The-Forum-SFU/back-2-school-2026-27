/**
 * Captures ad attribution on first page load and holds it for the session.
 *
 * Why sessionStorage: the click ids arrive in the URL, but the user may scroll,
 * navigate to a list route, or reload before submitting — by which point the query
 * string is long gone. Capturing once on load and reading at submit time is what
 * keeps attribution attached to the conversion.
 */

const KEY = 'rewind.attribution'

export type Attribution = {
  fbclid: string | null
  fbp: string | null
  fbc: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

const EMPTY: Attribution = {
  fbclid: null,
  fbp: null,
  fbc: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
}

export function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Idempotent. Merges into whatever was already captured so that a later visit
 * without UTMs doesn't wipe the values from the ad click that started the session.
 */
export function captureAttribution(): Attribution {
  if (typeof window === 'undefined') return EMPTY

  const params = new URLSearchParams(window.location.search)
  const previous = getAttribution()

  const fbclid = params.get('fbclid') ?? previous.fbclid
  const next: Attribution = {
    fbclid,
    // Set by the Meta pixel itself, so it may only appear after the pixel loads —
    // which is why these are re-read at submit time rather than trusted from here.
    fbp: readCookie('_fbp') ?? previous.fbp,
    // Meta's documented fallback format when the cookie hasn't been written yet.
    fbc: readCookie('_fbc') ?? (fbclid ? `fb.1.${Date.now()}.${fbclid}` : previous.fbc),
    utmSource: params.get('utm_source') ?? previous.utmSource,
    utmMedium: params.get('utm_medium') ?? previous.utmMedium,
    utmCampaign: params.get('utm_campaign') ?? previous.utmCampaign,
  }

  try {
    sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Safari private mode throws on write. Attribution is nice-to-have; a signup is not.
  }
  return next
}

export function getAttribution(): Attribution {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return EMPTY
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Attribution>) }
  } catch {
    return EMPTY
  }
}

/** Re-reads the pixel cookies, which are often written after the initial capture. */
export function getAttributionData(): Attribution {
  const stored = getAttribution()
  return {
    ...stored,
    fbp: readCookie('_fbp') ?? stored.fbp,
    fbc: readCookie('_fbc') ?? stored.fbc,
  }
}
