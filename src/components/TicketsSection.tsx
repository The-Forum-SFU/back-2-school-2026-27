import { FONT } from '../assets'
import { EVENT, formatDoorDate } from '../config/event'
import { REWIND } from '../theme'
import type { Viewport } from '../lib/viewport'
import { INK, MUTED, RULE } from './form/Field'

/**
 * What the landing page shows once tickets are on sale, in place of the email form.
 *
 * Everything it renders comes from `EVENT.tickets`, in three tiers, so the page degrades
 * rather than breaks whatever state that config is in:
 *
 *   embedUrl  the checkout, framed, with the escape hatch above it
 *   url only  the link on its own, as a full-width button
 *   neither   nothing. LandingBottom keeps the email form up instead.
 *
 * That last tier is the point of `ticketsAvailable()`, which LandingBottom checks before
 * it swaps the form out. The switch to this section is driven by a DATE, and a date
 * arrives whether or not anyone has pasted a URL in. Without the check, a missing link on
 * the afternoon of the drop would replace a working signup form with an empty box. With
 * it, the page keeps doing what it was doing at 11:59.
 */

export default function TicketsSection({ vp }: { vp: Viewport }) {
  const { url, embedUrl } = EVENT.tickets

  return (
    <div>
      <header style={{ maxWidth: 640, marginBottom: vp.isDesktop ? 32 : 24 }}>
        <p style={eyebrowStyle}>On sale now</p>
        <h2 style={headingStyle(vp)}>Tickets</h2>
        <p style={{ ...subStyle(vp), marginTop: 14 }}>
          {EVENT.pitch}. {formatDoorDate()} at {EVENT.venue.name}.
        </p>
        <p style={{ ...mutedStyle, marginTop: 12 }}>
          Doors {EVENT.venue.doorsOpen}. {EVENT.venue.ageRestriction},{' '}
          {EVENT.venue.idRequirement}.
        </p>
      </header>

      {embedUrl && url && (
        /*
          The escape hatch, ABOVE the frame and against its right edge.

          It was a button underneath, which is the wrong place for it: the person who
          needs it is looking at a blank white box and has no reason to scroll PAST the
          thing that failed to find the fix. Above it, in the corner, it is in view at the
          same moment the frame is.

          Quiet on purpose. It is not the call to action, the frame is, and a second
          button competing with the checkout would split the decision. Link blue and small
          reads as the utility control it is. The blue is the poster's own, which is also
          what rules the sheet it sits on.
        */
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: FONT,
              fontWeight: 500,
              fontSize: vp.isDesktop ? 13 : 12,
              letterSpacing: '-0.02em',
              color: REWIND.blue,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Open in external tab ↗
          </a>
        </div>
      )}

      {embedUrl && (
        /*
          A fixed tall box rather than an aspect ratio.

          TicketWeb's page reflows to its own content and cannot tell us how tall it got:
          it is cross-origin, so no resize message reaches us and nothing here can measure
          it. A ratio would therefore be a guess that is wrong at one breakpoint or the
          other, and the failure is a checkout with its Buy button cut off. A tall box with
          the frame scrolling inside it is always right, just occasionally roomy.
        */
        <div
          style={{
            position: 'relative',
            height: vp.isDesktop ? 780 : 640,
            marginBottom: 0,
            borderRadius: 6,
            overflow: 'hidden',
            border: `1px solid ${RULE}`,
            // The frame paints white before it loads, and white on the paper sheet reads
            // as a hole. Navy is the poster's ground and reads as a screen.
            background: REWIND.navy,
          }}
        >
          <iframe
            src={embedUrl}
            title="Buy tickets"
            loading="lazy"
            /*
              No `sandbox`. A payment flow needs scripts, same-origin storage, forms,
              popups and top-level navigation for its 3-D Secure step, which is every
              token the attribute has; spelling all of them out is strictly weaker than
              not setting it, because it also opts the frame into the sandbox's other
              restrictions and would break the checkout for no gain.

              `referrerPolicy` is set instead, and does real work: it stops the full
              landing URL, including any campaign query string, from riding along to a
              third party on every load.
            */
            referrerPolicy="strict-origin-when-cross-origin"
            allow="payment"
            style={{ display: 'block', width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      )}

      {/*
        No frame to escape from, so the link IS the call to action and is drawn as one.
        Filled rather than outlined: nothing else on the page competes with it here.
      */}
      {!embedUrl && url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: vp.isMobile ? 15 : 17,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            borderRadius: 999,
            padding: vp.isMobile ? '16px 28px' : '18px 36px',
            width: vp.isMobile ? '100%' : undefined,
            boxSizing: 'border-box',
            textAlign: 'center',
            textDecoration: 'none',
            color: REWIND.navy,
            background: REWIND.aqua,
            border: 'none',
          }}
        >
          Get tickets
        </a>
      )}
    </div>
  )
}

function headingStyle(vp: Viewport) {
  return {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: vp.isDesktop ? 48 : 32,
    lineHeight: '100%',
    letterSpacing: '-0.04em',
    textTransform: 'uppercase' as const,
    color: INK,
  }
}

function subStyle(vp: Viewport) {
  return {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: vp.isDesktop ? 17 : 15,
    lineHeight: '140%',
    letterSpacing: '-0.02em',
    color: INK,
  }
}

const eyebrowStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: '0.02em',
  textTransform: 'uppercase' as const,
  color: MUTED,
  marginBottom: 10,
}

const mutedStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 12,
  lineHeight: '150%',
  letterSpacing: '-0.02em',
  color: MUTED,
}
