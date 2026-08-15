import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../src/routes'

/**
 * The guestlist path is not a naming preference, it is the access control on that
 * page: not linked, not indexed, not in the sitemap, so the only way in is being sent
 * the link. These guard the properties that make that hold.
 */

describe('ROUTES', () => {
  it('gives the guestlist an unguessable suffix', () => {
    const suffix = ROUTES.GUESTLIST.replace(/^\/list-/, '')
    expect(ROUTES.GUESTLIST).toMatch(/^\/list-/)
    expect(suffix.length).toBeGreaterThanOrEqual(8)
    expect(suffix).toMatch(/^[a-z0-9]+$/)
    // A word would be guessable no matter how long it is.
    expect(suffix).not.toMatch(/^(guestlist|presale|rewind|early|friends|invite)$/)
  })

  it('carries no "rewind" segment, because the event gets its own subdomain', () => {
    for (const path of Object.values(ROUTES)) {
      expect(path.toLowerCase()).not.toContain('rewind')
    }
  })

  it('says nothing about the offer in the URL', () => {
    // The path travels in screenshots and link previews.
    for (const word of ['5', 'discount', 'free', 'cheap', 'comp']) {
      expect(ROUTES.GUESTLIST.toLowerCase()).not.toContain(word)
    }
  })

  it('keeps a confirmation alias so the remembered spelling still lands', () => {
    expect(ROUTES.CONFIRMED).toBe('/confirmed')
    expect(ROUTES.CONFIRMATION).toBe('/confirmation')
  })

  it('has no duplicate paths', () => {
    const paths = Object.values(ROUTES)
    expect(new Set(paths).size).toBe(paths.length)
  })
})

describe('discoverability', () => {
  const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('never writes the guestlist path anywhere but the route table', () => {
    // A second copy is how one of them goes stale and a link 404s.
    for (const file of [
      'src/main.tsx',
      'src/pages/Confirmed.tsx',
      'src/pages/Guestlist.tsx',
      'src/components/SignupForm.tsx',
    ]) {
      expect(src(file), file).not.toContain(ROUTES.GUESTLIST)
    }
  })

  it('keeps the private paths out of any file a crawler is handed', () => {
    // robots.txt is public and is the first thing fetched from a domain, so a Disallow
    // line for an unguessable URL publishes the exact secret the suffix protects.
    for (const file of ['index.html', 'vercel.json']) {
      const contents = src(file)
      expect(contents, file).not.toContain(ROUTES.GUESTLIST)
      expect(contents, file).not.toContain(ROUTES.CONFIRMED)
    }
  })

  it('marks both private pages noindex at runtime', () => {
    for (const file of ['src/pages/Guestlist.tsx', 'src/pages/Confirmed.tsx']) {
      expect(src(file), file).toContain('useNoIndex()')
    }
  })

  it('does not mark the public landing page noindex', () => {
    expect(src('src/App.tsx')).not.toContain('useNoIndex')
  })
})
