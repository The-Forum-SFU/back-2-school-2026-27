import { FONT } from '../assets'
import { LISTS, type TicketType } from '../config/event'
import { useViewport } from '../lib/viewport'
import ListSection from './ListSection'
import { INK, RULE } from './form/Field'

/**
 * What a signup route puts at the end of the landing scroll: the form for its list,
 * then the four paths side by side.
 *
 * No page chrome of its own — no logo, no min-height, no outer padding. LandingShell
 * owns all of that, so this stays a section that drops into the bottom of the scroll
 * without fighting the shell around it.
 */
export default function ListBottom({ ticketType }: { ticketType: TicketType }) {
  const vp = useViewport()

  return (
    <>
      <ListSection ticketType={ticketType} />
      <ComparisonTable vp={vp} highlight={ticketType} />
    </>
  )
}

/**
 * The four paths side by side. Driven off LISTS so it can never drift from what the
 * signup actually enforces — there is no second copy of these numbers.
 */
function ComparisonTable({
  vp,
  highlight,
}: {
  vp: ReturnType<typeof useViewport>
  highlight: TicketType
}) {
  const rows = Object.values(LISTS)

  return (
    <section style={{ maxWidth: 1100, marginTop: vp.isDesktop ? 96 : 64 }}>
      <h3
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: vp.isDesktop ? 22 : 18,
          letterSpacing: '-0.04em',
          textTransform: 'uppercase',
          color: INK,
          marginBottom: 20,
        }}
      >
        Ways in
      </h3>

      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: vp.isMobile ? '1fr' : 'repeat(4, minmax(180px, 1fr))',
            gap: 16,
            minWidth: vp.isMobile ? undefined : 760,
          }}
        >
          {rows.map((row) => (
            <div
              key={row.ticketType}
              style={{
                border: `1px solid ${RULE}`,
                borderRadius: 4,
                padding: 16,
                // Translucent rather than transparent: the paper still reads through, but the
                // card's own text gets a consistent ground instead of landing on a crease.
                background: row.ticketType === highlight ? INK : 'rgba(255,255,255,0.6)',
                color: row.ticketType === highlight ? '#fff' : INK,
              }}
            >
              <p style={{ ...cellHeading, color: 'inherit' }}>{row.label}</p>
              <p style={{ ...cellBody, color: 'inherit', marginTop: 8 }}>{row.blurb}</p>
              <p style={{ ...cellMeta, color: 'inherit', marginTop: 12 }}>
                {row.priceCents > 0 ? `$${(row.priceCents / 100).toFixed(0)} at the door` : 'No discount'}
              </p>
              <p style={{ ...cellMeta, color: 'inherit' }}>
                {row.capacity ? `${row.capacity} spots` : 'No cap'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const cellHeading = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 14,
  letterSpacing: '-0.02em',
  textTransform: 'uppercase' as const,
}

const cellBody = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 12,
  lineHeight: '150%',
  letterSpacing: '-0.02em',
}

const cellMeta = {
  ...cellBody,
  opacity: 0.7,
}
