import { FONT } from '../assets'
import {
  formatDropDate,
  formatShortDate,
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

      {next && next.enabled && (
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

      {/* The target route doesn't exist yet, so this states the next step in words
          rather than shipping a link to a 404. Flipping nextStep.enabled turns it
          into the button above — one line, no refactor. */}
      {next && !next.enabled && (
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
