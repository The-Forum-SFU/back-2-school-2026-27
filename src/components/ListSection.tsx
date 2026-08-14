import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { FONT } from '../assets'
import { EVENT, LISTS, resolveListPhase, formatShortDate, type ListPhase, type TicketType } from '../config/event'
import { captureAttribution } from '../lib/attribution'
import { initMetaPixel } from '../lib/metaPixel'
import { fetchListStatus, type SignupResponse } from '../lib/signupApi'
import { riseIn } from '../lib/motion'
import { useViewport } from '../lib/viewport'
import RsvpClosed from './RsvpClosed'
import SignupForm from './SignupForm'
import { INK, MUTED } from './form/Field'

/**
 * The signup block for one list: heading, scarcity, and either the form or the
 * closed panel.
 *
 * Rendered by ListBottom at the end of LandingShell's scroll on any route that owns a
 * list. Deliberately has no page chrome of its own, so the shell around it stays in
 * charge of layout.
 */

/** Re-render on an interval so a page left open across a window boundary flips live. */
function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export default function ListSection({ ticketType }: { ticketType: TicketType }) {
  const cfg = LISTS[ticketType]
  const vp = useViewport()
  const now = useNow(60_000)

  const [remaining, setRemaining] = useState<number | null | undefined>(undefined)
  const [serverPhase, setServerPhase] = useState<ListPhase | null>(null)

  useEffect(() => {
    captureAttribution()
    initMetaPixel()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchListStatus(ticketType).then((status) => {
      if (cancelled || !status) return
      // The server wins: device clocks are wrong often enough to matter, and
      // `remaining` is something only the database can know.
      setServerPhase(status.phase)
      setRemaining(status.remaining)
    })
    return () => {
      cancelled = true
    }
  }, [ticketType])

  // Render the config-derived phase on the first frame so there's no spinner, then
  // let the server's answer replace it when it lands.
  const phase: ListPhase = serverPhase ?? resolveListPhase(cfg, now, remaining)

  /**
   * Someone can have the form open when the last slot goes. Their submit comes back
   * `full`, and this swaps the whole section — which is why `full` is a section-level
   * state and not an inline error under the submit button.
   */
  function onResult(r: SignupResponse) {
    if (r.status === 'full') setServerPhase('full')
    else if (r.status === 'closed') setServerPhase('closed')
    else if (r.status === 'not_open') setServerPhase('before')
  }

  if (phase === 'full' || phase === 'closed') {
    return (
      <motion.div {...riseIn(0)}>
        <RsvpClosed cfg={cfg} phase={phase} vp={vp} />
      </motion.div>
    )
  }

  if (phase === 'before') {
    return (
      <motion.div {...riseIn(0)}>
        <h2 style={headingStyle(vp)}>{cfg.copy.heading}</h2>
        <p style={{ ...subStyle(vp), marginTop: 12 }}>
          Opens {formatShortDate(cfg.opensAt)}.
        </p>
        {/* Countdown slots in here later — the div, not the logic. */}
        <div id="signup-countdown" />
      </motion.div>
    )
  }

  if (cfg.mode !== 'signup') {
    // Only the signup body is built this pass. Typed in the union so adding
    // checkout/inquiry later is filling in a branch, not restructuring the page.
    throw new Error(`ListSection: mode "${cfg.mode}" is not implemented yet`)
  }

  const showScarcity =
    typeof remaining === 'number' && remaining > 0 && remaining <= cfg.showRemainingBelow

  return (
    <motion.div {...riseIn(0)}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={headingStyle(vp)}>{cfg.copy.heading}</h2>
        <p style={{ ...subStyle(vp), marginTop: 10 }}>{cfg.copy.subheading}</p>
        <p style={{ ...mutedStyle, marginTop: 14 }}>{cfg.blurb}</p>
        <p style={{ ...mutedStyle, marginTop: 4 }}>
          {EVENT.venue.name} · {EVENT.venue.ageRestriction} · Doors {EVENT.venue.doorsOpen}
          {/* doorsClose is null until confirmed, and simply isn't rendered. */}
          {EVENT.venue.doorsClose ? `–${EVENT.venue.doorsClose}` : ''}
        </p>
        {showScarcity && (
          <p style={{ ...subStyle(vp), marginTop: 14 }}>Only {remaining} spots left.</p>
        )}
      </div>

      <SignupForm cfg={cfg} vp={vp} onResult={onResult} />
    </motion.div>
  )
}

function headingStyle(vp: ReturnType<typeof useViewport>) {
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

function subStyle(vp: ReturnType<typeof useViewport>) {
  return {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: vp.isDesktop ? 17 : 15,
    lineHeight: '140%',
    letterSpacing: '-0.02em',
    color: INK,
  }
}

const mutedStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 12,
  lineHeight: '150%',
  letterSpacing: '-0.02em',
  color: MUTED,
}
