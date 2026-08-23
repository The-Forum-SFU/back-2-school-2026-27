import { FONT } from '../assets'
import { EVENT } from '../config/event'
import { useViewport } from '../lib/viewport'

/**
 * GET TICKETS, on the outro screen of `/tickets`, directly above the mailing-list strip.
 *
 * Renders the CONTENTS of a layer, not the layer — the `outro` prop on LandingShell owns
 * the fixed positioning, and the scroll engine drives the opacity, the visibility and the
 * pointer events off the same ramp everything else on that screen reads. Same division as
 * KeyArt and OutroSignup, and the reason this is not a layer of its own.
 *
 * WHY IT IS HERE AND NOT ON THE HERO RAIL, which is where the second ticket link used to
 * live. `/tickets` has no hero any more. The rail sat at `left: 32, top: 300` on desktop and
 * dead centre of the artwork below it, so leaving it in place would have put a pill across
 * the poster on the one screen the whole page now opens and closes on. The right-hand column
 * — date stamp, ticket link, mailing list — is where the type already was.
 *
 * FILLED, and the only filled control on the site. Everything else in this vocabulary is an
 * outlined pill, because the hero overlay blends with `exclusion` and a solid fill inverts
 * as a slab (see `railPillStyle` in Overlay.tsx, and the palette note in src/theme.ts). This
 * layer does no blending at all, which is what makes a fill available here and nowhere else,
 * and it is spent on the one thing the page exists to be pressed. The Join button eight
 * pixels below it stays outlined so the two cannot read as equals.
 *
 * Full width rather than shrink-to-fit for the same reason: it is the widest thing in a
 * 330px column of small type, and on a phone it is the full width of the screen.
 *
 * Renders NOTHING with no URL configured. `useTicketsLive` already gates the whole route on
 * `ticketsAvailable()`, so this is unreachable in practice — but a filled button that goes
 * nowhere is the worst possible failure on this page, and the guard costs one line.
 */
export default function TicketCta() {
  const vp = useViewport()
  const desktop = vp.isDesktop

  if (!EVENT.tickets.url) return null

  return (
    <a
      href={EVENT.tickets.url}
      // New tab, matching every other outbound link on this screen. An in-app navigation
      // would unmount the form below and destroy anything already typed into it.
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        width: '100%',
        // The padding is inside the 330px column, not added to it.
        boxSizing: 'border-box',
        textAlign: 'center',
        fontFamily: FONT,
        fontWeight: 500,
        fontSize: desktop ? 17 : 15,
        // Without this the font's own line box sits the label low in the pill.
        lineHeight: 1,
        letterSpacing: '-0.02em',
        textTransform: 'uppercase',
        color: '#000',
        background: '#fff',
        border: 'none',
        borderRadius: 999,
        padding: desktop ? '17px 24px' : '13px 20px',
        textDecoration: 'none',
        /*
          THE HEIGHT BUDGET BELOW DESKTOP IS REAL, and this block is what spends it.

          51px on desktop and 41 here, plus the margin, is what `eventInfoLift` in Overlay.tsx
          lifts the date stamp by to open room for — and below desktop that lift comes
          straight off the poster, since KeyArt's bottom inset is derived from it. Changing
          the type size or the padding here means re-checking both.
        */
        marginBottom: desktop ? 16 : 14,
      }}
    >
      Get tickets
    </a>
  )
}
