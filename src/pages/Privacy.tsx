import type { ReactNode } from 'react'
import { FONT } from '../assets'
import PaperPage from '../components/PaperPage'
import { INK, MUTED, RULE } from '../components/form/Field'
import {
  PRIVACY_CONTACT,
  PRIVACY_SECTIONS,
  type Block,
  type Section,
} from '../config/privacy'
import { useViewport, type Viewport } from '../lib/viewport'

/**
 * `/privacy` — the privacy policy.
 *
 * Public and indexable on purpose, which makes it the only page other than the landing
 * page that is. It is linked from the notice above the signup form's submit button, and
 * that sentence is stored verbatim against every row in `submissions.privacy_text`, so
 * this document has to actually exist and stay readable.
 *
 * Content lives in src/config/privacy.ts, not here, on the same split as EVENT copy:
 * the wording is a legal artefact that gets edited by someone reading law, and it should
 * never require touching a component to change. **Read the header of that file before
 * publishing** — four statements in the policy do not currently match what this site
 * does, and they are marked there.
 *
 * The renderer supports exactly two pieces of inline markup, `**bold**` and
 * `[label](href)`, rather than pulling in a markdown dependency for one page. Same trade
 * the rest of this codebase makes: see the hand-rolled PostgREST client in
 * api/_lib/supabase.ts.
 */
export default function Privacy() {
  const vp = useViewport()

  return (
    <PaperPage>
      <article style={{ maxWidth: 760 }}>
        <h1 style={headingStyle(vp)}>Privacy Policy</h1>
        <p style={{ ...bodyStyle, marginTop: 14, fontSize: 15 }}>
          {PRIVACY_CONTACT.company}
        </p>

        {/* Both dates render only when set. A visible "[PUBLICATION DATE]" is worse
            than no date line, and this is the same rule EVENT.venue.address follows. */}
        {PRIVACY_CONTACT.effectiveDate && (
          <p style={{ ...fineStyle, marginTop: 10 }}>
            Effective date: {formatDate(PRIVACY_CONTACT.effectiveDate)}
          </p>
        )}
        {PRIVACY_CONTACT.lastUpdated && (
          <p style={fineStyle}>
            Last updated: {formatDate(PRIVACY_CONTACT.lastUpdated)}
          </p>
        )}

        <div
          style={{
            marginTop: vp.isDesktop ? 40 : 28,
            paddingTop: vp.isDesktop ? 32 : 24,
            borderTop: `1px solid ${RULE}`,
          }}
        >
          {PRIVACY_SECTIONS.map((section) => (
            <SectionBlock key={section.n} section={section} vp={vp} />
          ))}
        </div>

        <footer
          style={{
            marginTop: vp.isDesktop ? 64 : 48,
            paddingTop: 24,
            borderTop: `1px solid ${RULE}`,
          }}
        >
          <p style={fineStyle}>
            {PRIVACY_CONTACT.company}. Privacy questions and requests go to{' '}
            <Mail address={PRIVACY_CONTACT.email} />.
          </p>
          {PRIVACY_CONTACT.mailingAddress && (
            <p style={{ ...fineStyle, marginTop: 4 }}>
              {PRIVACY_CONTACT.mailingAddress}
            </p>
          )}
        </footer>
      </article>
    </PaperPage>
  )
}

function SectionBlock({ section, vp }: { section: Section; vp: Viewport }) {
  return (
    <section style={{ marginBottom: vp.isDesktop ? 48 : 36 }}>
      <h2 style={sectionTitleStyle(vp)}>
        {section.n}. {section.title}
      </h2>
      {section.blocks.map((block, i) => (
        <BlockView key={i} block={block} vp={vp} />
      ))}
    </section>
  )
}

function BlockView({ block, vp }: { block: Block; vp: Viewport }) {
  switch (block.kind) {
    case 'h3':
      return <h3 style={subTitleStyle}>{block.text}</h3>

    case 'p':
      return <p style={{ ...bodyStyle, marginTop: 12 }}>{inline(block.text)}</p>

    case 'ul':
      return (
        <ul style={listStyle}>
          {block.items.map((item) => (
            <li key={item} style={listItemStyle}>
              {inline(item)}
            </li>
          ))}
        </ul>
      )

    case 'table':
      return (
        /* Its own scroll container so a wide table never makes the PAGE scroll
           sideways, which on a phone breaks every section above it too. */
        <div style={{ marginTop: 16, overflowX: 'auto' }}>
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              minWidth: vp.isMobile ? 520 : undefined,
            }}
          >
            <thead>
              <tr>
                {block.head.map((cell) => (
                  <th key={cell} style={thStyle}>
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join('|')}>
                  {row.map((cell, i) => (
                    <td key={i} style={tdStyle}>
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

function Mail({ address }: { address: string }) {
  return (
    <a href={`mailto:${address}`} style={linkStyle}>
      {address}
    </a>
  )
}

/**
 * Renders `**bold**` and `[label](href)` and leaves everything else alone.
 *
 * One pass, one regex, alternating on capture groups. Deliberately not a markdown
 * parser: the document uses exactly these two constructs, and an unmatched `**` should
 * come out as literal asterisks rather than swallowing the rest of a legal sentence.
 */
const INLINE_RE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  INLINE_RE.lastIndex = 0

  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index))

    const [, bold, label, href] = match
    if (bold !== undefined) {
      out.push(
        <strong key={`${match.index}b`} style={{ fontWeight: 700 }}>
          {bold}
        </strong>,
      )
    } else {
      // External destinations only (mailto: and the two regulators), so both of these
      // are safe to open in a new tab and rel is set for the http ones.
      const external = href.startsWith('http')
      out.push(
        <a
          key={`${match.index}a`}
          href={href}
          style={linkStyle}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {label}
        </a>,
      )
    }
    last = match.index + match[0].length
  }

  if (last < text.length) out.push(text.slice(last))
  return out
}

/** "August 16, 2026" from an ISO date, read as UTC so it cannot shift by a day. */
function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function headingStyle(vp: Viewport) {
  return {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: vp.isDesktop ? 56 : 36,
    lineHeight: '95%',
    letterSpacing: '-0.04em',
    textTransform: 'uppercase' as const,
    color: INK,
  }
}

function sectionTitleStyle(vp: Viewport) {
  return {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: vp.isDesktop ? 24 : 19,
    lineHeight: '115%',
    letterSpacing: '-0.04em',
    textTransform: 'uppercase' as const,
    color: INK,
    marginBottom: 4,
  }
}

const bodyStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 14,
  lineHeight: '165%',
  letterSpacing: '-0.02em',
  color: INK,
}

const fineStyle = { ...bodyStyle, fontSize: 12, color: MUTED }

const subTitleStyle = {
  ...bodyStyle,
  fontSize: 14,
  fontWeight: 700,
  marginTop: 22,
}

const listStyle = {
  margin: '12px 0 0',
  paddingLeft: 20,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 8,
}

const listItemStyle = { ...bodyStyle, lineHeight: '155%' }

const linkStyle = { color: INK, textDecoration: 'underline' }

const thStyle = {
  ...bodyStyle,
  fontSize: 11,
  textTransform: 'uppercase' as const,
  color: MUTED,
  textAlign: 'left' as const,
  verticalAlign: 'top' as const,
  padding: '8px 12px 8px 0',
  borderBottom: `1px solid ${RULE}`,
}

const tdStyle = {
  ...bodyStyle,
  fontSize: 13,
  lineHeight: '150%',
  textAlign: 'left' as const,
  verticalAlign: 'top' as const,
  padding: '10px 12px 10px 0',
  borderBottom: `1px solid ${RULE}`,
}
