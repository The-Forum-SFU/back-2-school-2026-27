import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../src/routes'

/**
 * A guestlist path is not a naming preference, it is the access control on that page:
 * not linked, not indexed, not in the sitemap, so the only way in is being sent the
 * link. These guard the properties that make that hold.
 *
 * There are TWO of them now, the promoter list and the friends & family one, and every
 * property below has to hold for both. They are asserted over this array rather than
 * over GUESTLIST alone, so a third list added later inherits the guards by being added
 * here instead of by someone remembering to copy four tests.
 */
const LIST_ROUTES: readonly [name: string, path: string][] = [
  ['GUESTLIST', ROUTES.GUESTLIST],
  ['FRIENDS_GUESTLIST', ROUTES.FRIENDS_GUESTLIST],
]

describe('ROUTES', () => {
  it.each(LIST_ROUTES)('gives %s an unguessable suffix', (_name, path) => {
    const suffix = path.replace(/^\/list-/, '')
    expect(path).toMatch(/^\/list-/)
    expect(suffix.length).toBeGreaterThanOrEqual(8)
    expect(suffix).toMatch(/^[a-z0-9]+$/)
    // A word would be guessable no matter how long it is.
    expect(suffix).not.toMatch(/^(guestlist|presale|rewind|early|friends|invite)$/)
  })

  it('gives the two lists different paths, which is the whole point of two lists', () => {
    // One path serving both would mean one pool, and the first link out would take it.
    expect(ROUTES.GUESTLIST).not.toBe(ROUTES.FRIENDS_GUESTLIST)
  })

  it('carries no "rewind" segment, because the event gets its own subdomain', () => {
    for (const path of Object.values(ROUTES)) {
      expect(path.toLowerCase()).not.toContain('rewind')
    }
  })

  it.each(LIST_ROUTES)('says nothing about the offer in the %s URL', (_name, path) => {
    // The path travels in screenshots and link previews.
    for (const word of ['5', 'discount', 'free', 'cheap', 'comp']) {
      expect(path.toLowerCase()).not.toContain(word)
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

  it('never writes a guestlist path anywhere but the route table', () => {
    // A second copy is how one of them goes stale and a link 404s. src/config/event.ts
    // is on the list because `formHref` puts a route on a list config: it has to read
    // from ROUTES, never repeat the literal.
    for (const file of [
      'src/main.tsx',
      'src/config/event.ts',
      'src/pages/Confirmed.tsx',
      'src/pages/Guestlist.tsx',
      'src/pages/FriendsGuestlist.tsx',
      'src/components/SignupForm.tsx',
    ]) {
      for (const [name, path] of LIST_ROUTES) {
        expect(src(file), `${file} / ${name}`).not.toContain(path)
      }
    }
  })

  /**
   * robots.txt is public and is the first thing fetched from a domain, so a Disallow
   * line for an unguessable URL publishes the exact secret the suffix protects. The
   * sitemap is the same trap with a friendlier name.
   */
  const CRAWLER_FILES = ['index.html', 'vercel.json', 'public/robots.txt', 'public/sitemap.xml']

  it('keeps every guestlist path out of any file a crawler is handed', () => {
    for (const file of CRAWLER_FILES) {
      const contents = src(file)
      for (const [name, path] of LIST_ROUTES) {
        expect(contents, `${file} / ${name}`).not.toContain(path)
      }
    }
  })

  it('does not advertise /confirmed to a crawler', () => {
    // NOT checked across CRAWLER_FILES: sitemap.xml names the path in a COMMENT saying
    // why it is absent, which is documentation and not a URL a crawler can follow. The
    // path is guessable anyway, so what protects that page is noindex plus having
    // nothing on it without router state. The unguessable list paths above are the ones
    // where an accidental mention is an actual leak, and those are checked everywhere.
    for (const file of ['index.html', 'vercel.json']) {
      expect(src(file), file).not.toContain(ROUTES.CONFIRMED)
    }
  })

  it('marks every private page noindex at runtime', () => {
    for (const file of [
      'src/pages/Guestlist.tsx',
      'src/pages/FriendsGuestlist.tsx',
      'src/pages/Confirmed.tsx',
      // Reached by a redirect out of Brevo rather than from inside the app, which is
      // exactly why it needs the tag: nothing links to it, so search is the only way it
      // could ever be found.
      'src/pages/VipConfirmed.tsx',
    ]) {
      expect(src(file), file).toContain('useNoIndex()')
    }
  })

  it('does not mark the public landing page noindex', () => {
    expect(src('src/App.tsx')).not.toContain('useNoIndex')
  })
})
