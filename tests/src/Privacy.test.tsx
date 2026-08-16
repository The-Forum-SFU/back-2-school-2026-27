/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Privacy from '../../src/pages/Privacy'
import { PRIVACY_CONTACT, PRIVACY_SECTIONS } from '../../src/config/privacy'
import { LISTS } from '../../src/config/event'
import { ROUTES } from '../../src/routes'

/**
 * The privacy policy is a legal artefact, so these guard the things that make it one:
 * that the link every signup is told it agreed to actually resolves, that the whole
 * document is on the page, and that no editing scaffolding leaks to a reader.
 */

describe('the link from the form', () => {
  /**
   * The bug this page was built to fix. `privacyHref` used to point at a path with no
   * route behind it, so the catch-all sent it to the landing page: the form said "By
   * signing up you agree to our Privacy Policy", stored that sentence verbatim in
   * submissions.privacy_text, and linked to the hero.
   */
  it('is the route the form actually links to', () => {
    for (const [type, cfg] of Object.entries(LISTS)) {
      expect(cfg.copy.privacyHref, type).toBe(ROUTES.PRIVACY)
    }
  })

  it('is public, not noindex like the other non-landing pages', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/pages/Privacy.tsx', 'utf8'),
    )
    expect(src).not.toContain('useNoIndex')
  })
})

describe('rendering', () => {
  it('puts every numbered section on the page', () => {
    render(<Privacy />)
    expect(PRIVACY_SECTIONS).toHaveLength(16)
    for (const section of PRIVACY_SECTIONS) {
      expect(
        screen.getByRole('heading', { name: `${section.n}. ${section.title}` }),
        `section ${section.n}`,
      ).toBeInTheDocument()
    }
  })

  it('renders the tables as real tables, not as pipe characters', () => {
    render(<Privacy />)
    // Sections 3, 8 and 10 each carry one.
    expect(screen.getAllByRole('table')).toHaveLength(3)
    expect(document.body.textContent).not.toContain('|---')
  })

  it('resolves inline markup instead of printing it', () => {
    render(<Privacy />)
    const text = document.body.textContent ?? ''
    // A failed bold or link parse leaves its own syntax behind, which is exactly the
    // kind of thing that ships unnoticed in a wall of legal copy.
    expect(text).not.toContain('**')
    expect(text).not.toMatch(/\]\(/)
    expect(screen.getAllByRole('link', { name: PRIVACY_CONTACT.email }).length,
    ).toBeGreaterThan(0)
  })

  it('shows no unfilled placeholder to a reader', () => {
    render(<Privacy />)
    const text = document.body.textContent ?? ''
    // The source document carried [PUBLICATION DATE] and [MAILING ADDRESS]. Until they
    // are filled in, the lines are omitted rather than printed with the brackets.
    expect(text).not.toMatch(/\[[A-Z][A-Z ]+\]/)
    expect(text).not.toContain('TODO')
  })

  it('omits the date lines while the dates are unset, and shows them once set', () => {
    const { unmount } = render(<Privacy />)
    if (PRIVACY_CONTACT.effectiveDate === null) {
      expect(document.body.textContent).not.toContain('Effective date')
    } else {
      expect(document.body.textContent).toContain('Effective date')
    }
    unmount()
  })
})
