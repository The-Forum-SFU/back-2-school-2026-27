import { FONT } from '../assets'
import {
  formatDropDate,
  formatShortDate,
  ticketsLive,
  type ListConfig,
  type ListPhase,
} from '../config/event'
import type { Viewport } from '../lib/viewport'
import { INK, MUTED } from './form/Field'

/**
 * Terminal panel for a list that can no longer be joined.
 *
 * Serves BOTH `full` and `closed` because the user-facing situation is identical:
 * this list is done, here is what happens next. Everything comes from ListConfig, so
 * it works for any list without modification.
 */

type Props = {
  cfg: ListConfig
  phase: Extract<ListPhase, 'full' | 'closed'>
  vp: Viewport
}

export default function RsvpClosed({ cfg, phase, vp }: Props) {
  const drop = cfg.ticketDrop
  const next = cfg.nextStep

  // `time: null` omits the time entirely rather than printing a placeholder — the
  // same discipline as never rendering a literal "xxPM" to a user.
  const dropLine = drop
    ? `Tickets drop ${formatDropDate(drop.date)}${drop.time ? ` at ${drop.time}` : ''}`
    : null

  const nextOpensLater =
    next?.availableFrom && new Date(next.availableFrom).getTime() > Date.now()

  /**
   * The button, only once tickets are actually being sold.
   *
   * `next.enabled` answers "is there a URL", which has been true since the TicketWeb link
   * went into config days before the sale opened. On its own it put a Get Tickets button
   * on this panel pointing at a page selling nothing, which reads as working and is a
   * worse dead end than the sentence below it. This is a terminal panel and reads the
   * clock once at render, which is enough: nobody sits on it waiting for noon, and the
   * landing page is what switches live.
   */
  const showNextButton = Boolean(next?.enabled) && ticketsLive(new Date())

  return (
    <div role="status" style={{ maxWidth: 560 }}>
      <h2
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: vp.isDesktop ? 64 : 40,
          lineHeight: '95%',
          letterSpacing: '-0.04em',
          textTransform: 'uppercase',
          color: INK,
          marginBottom: 16,
        }}
      >
        {cfg.copy.closedTitle}
      </h2>

      <p
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: vp.isDesktop ? 17 : 15,
          lineHeight: '145%',
          letterSpacing: '-0.02em',
          color: INK,
          marginBottom: dropLine ? 28 : 0,
        }}
      >
        {phase === 'full' ? cfg.copy.closedBody : `${cfg.label} is closed.`}
      </p>

      {dropLine && (
        <p
          style={{
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: vp.isDesktop ? 26 : 20,
            lineHeight: '115%',
            letterSpacing: '-0.04em',
            textTransform: 'uppercase',
            color: INK,
            marginBottom: 28,
          }}
        >
          {dropLine}
        </p>
      )}

      {next && showNextButton && (
        <a
          href={next.href}
          style={{
            display: 'inline-block',
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: vp.isMobile ? 15 : 17,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: '#fff',
            background: INK,
            borderRadius: 999,
            padding: vp.isMobile ? '16px 28px' : '18px 36px',
            textDecoration: 'none',
          }}
        >
          {next.label}
        </a>
      )}

      {/* Until then, the next step in words. `availableFrom` is the drop instant, so
          this reads "Get tickets opens August 24" rather than shipping a button to a
          page that is not selling. */}
      {next && !showNextButton && (
        <p style={{ ...mutedStyle, marginTop: 4 }}>
          {/* Two sentences rather than a dash: the build plan's no-em-dash rule covers
              every user-facing string, not just the ones in src/config/event.ts. */}
          {nextOpensLater && next.availableFrom
            ? `${next.label} opens ${formatShortDate(next.availableFrom)}.`
            : `${next.label}. Details coming soon.`}
        </p>
      )}
    </div>
  )
}

const mutedStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 13,
  lineHeight: '150%',
  letterSpacing: '-0.02em',
  color: MUTED,
}
