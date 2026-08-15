import type { ReactNode } from 'react'
import { LOGO_BEAR, LOGO_WORDMARK } from '../assets'
import { useViewport } from '../lib/viewport'

/**
 * A standalone page on the ruled sheet, with the logo top left.
 *
 * The build plan's first rule for every page: "Forum logo, top left, on every page.
 * Clicking it goes to the site root. That is the only navigation on these pages. No
 * nav bar, no menu, no footer links." This is that rule, as a component, so the pages
 * that aren't the landing scroll can't drift from it.
 *
 * Shares `.paper-surface` with the signup section rather than redefining the sheet, so
 * arriving here from the form feels like the same piece of paper.
 */
export default function PaperPage({ children }: { children: ReactNode }) {
  const vp = useViewport()

  return (
    <main
      className="paper-surface"
      style={{
        minHeight: '100vh',
        // Matches LandingShell's signup section: clears the red margin rule that
        // `.paper-surface` draws at --margin-x.
        padding: vp.isMobile ? '28px 28px 96px' : '40px 64px 140px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Logo />
        {children}
      </div>
    </main>
  )
}

/**
 * Bear badge + wordmark, linking to the site root.
 *
 * The wordmark file is white on transparent and relies on `mix-blend-mode: exclusion`
 * to resolve — over this light sheet exclusion inverts it to near-black. The bear is
 * full colour and must stay OUT of any exclusion group or it inverts into garbage,
 * which is why they are two elements and not one image.
 */
function Logo() {
  const vp = useViewport()
  const width = vp.isMobile ? 150 : 240
  const bearWidth = Math.round(width * 0.18)
  const gap = Math.round(width * 0.05)

  return (
    <a
      href="/"
      aria-label="The Forum University, back to the home page"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        marginBottom: vp.isMobile ? 48 : 72,
        textDecoration: 'none',
      }}
    >
      <img
        src={LOGO_BEAR}
        alt="The Forum University"
        style={{ width: bearWidth, height: 'auto', display: 'block' }}
      />
      <img
        src={LOGO_WORDMARK}
        alt=""
        aria-hidden="true"
        style={{
          width: width - bearWidth - gap,
          height: 'auto',
          display: 'block',
          mixBlendMode: 'exclusion',
        }}
      />
    </a>
  )
}
