import { useEffect } from 'react'

/**
 * Keeps `<meta name="robots" content="noindex, nofollow">` in the head for as long as
 * the calling route is mounted.
 *
 * Deliberately NOT robots.txt. That file is public and is the first thing anyone
 * fetches from a domain, so a `Disallow: /list-<random>` line publishes the exact
 * secret the random suffix exists to protect. A meta tag is only ever seen by
 * something that already has the URL.
 *
 * Deliberately not in index.html either: this is a single-page app, so a tag in the
 * document head would apply to the public landing page too and quietly deindex it.
 *
 * This is the belt to the braces of an unguessable URL — the URL is what actually
 * keeps the page private. Nothing here is a substitute for not sharing the link.
 */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}
