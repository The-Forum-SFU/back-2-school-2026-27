import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { FONT } from '../assets'
import { EVENT, HERO_COPY } from '../config/event'
import { riseIn } from '../lib/motion'
import type { Viewport } from '../lib/viewport'
import { heroRailSlot } from './Overlay'

/**
 * Live countdown to the ticket drop, on the hero's left rail.
 *
 * Occupies the SAME slot as ScrollCue and is the alternative to it: a route with a
 * form below has somewhere to send people and shows the button, a route without has
 * only a date to give them and shows this. See heroRailSlot in Overlay.tsx — the two
 * share their position so neither can drift, and the mobile artwork crop is sized
 * against whichever one is there.
 *
 * Everything it renders comes from EVENT.ticketDropAt and HERO_COPY, so moving the
 * drop is a one-line edit in config and nothing here changes.
 */

const DROP_AT = new Date(EVENT.ticketDropAt).getTime()

type Remaining = { days: number; hours: number; minutes: number; seconds: number }

/**
 * Time left, or null once the drop has landed.
 *
 * Recomputed from an absolute `now` on every tick rather than decremented, so a
 * throttled background tab, a sleeping laptop or a slow frame cannot accumulate drift
 * into a clock people are watching count down.
 */
function remainingFrom(now: number): Remaining | null {
  const ms = DROP_AT - now
  if (ms <= 0) return null
  const total = Math.floor(ms / 1000)
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor(total / 3_600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function DropCountdown({ vp }: { vp: Viewport }) {
  const [left, setLeft] = useState(() => remainingFrom(Date.now()))
  const done = left === null

  /**
   * Under reduced motion the seconds place is dropped and the tick slows to the
   * minute. A digit repainting once a second is exactly the kind of unrequested
   * perpetual movement the preference is asking us to stop, and the information the
   * countdown actually carries at eight days out survives losing its last field.
   */
  const live = !vp.reducedMotion

  useEffect(() => {
    // Clears itself on the render after the drop lands, so nothing keeps ticking
    // behind the terminal state below.
    if (done) return
    const id = window.setInterval(() => setLeft(remainingFrom(Date.now())), live ? 1_000 : 30_000)
    return () => window.clearInterval(id)
  }, [done, live])

  const desktop = vp.isDesktop

  /*
    Past the drop this either hands over to the real ticket link or renders nothing.

    Nothing is the honest option while EVENT.tickets.url is still empty: a countdown
    frozen at zero, or a "tickets are live" line with no way to buy any, is worse than
    the empty rail that is on this route today. Filling in the URL and flipping
    `tickets.enabled` turns it into the button with no change here.
  */
  if (!left) {
    if (!EVENT.tickets.enabled || !EVENT.tickets.url) return null
    return (
      <motion.div {...riseIn(0.45)} style={heroRailSlot(vp)}>
        <a
          href={EVENT.tickets.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: desktop ? 19 : 16,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: '#fff',
            background: 'none',
            border: `${desktop ? 2 : 1.5}px solid #fff`,
            borderRadius: 999,
            padding: desktop ? '16px 32px' : '13px 24px',
            textDecoration: 'none',
            pointerEvents: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          GET TICKETS
        </a>
      </motion.div>
    )
  }

  /*
    Units laid out on ONE line, each number followed by its own letter, rather than as
    a stacked grid with labels underneath.

    Two constraints force it and it happens to look better anyway. Vertically, this
    sits in a white band that HeroCanvas crops at 244px on mobile, and the slot starts
    at 174 — a second row of unit labels would put the block through the crop.
    Horizontally, the whole overlay blends with `exclusion` and the hero artwork starts
    around 450px in, so anything wide enough to reach it inverts against the bear
    mid-line. One row lands near 240px on desktop. See the same note on Caption.

    The days block disappears on the final day rather than showing "0d", which is the
    one layout shift here and the right one: on drop day "23h 04m 11s" is the reading
    that matters and a dead zero in front of it only dilutes.
  */
  const units: Array<[string, string]> = [
    ...(left.days > 0 ? ([[String(left.days), 'd']] as Array<[string, string]>) : []),
    [pad(left.hours), 'h'],
    [pad(left.minutes), 'm'],
    ...(live ? ([[pad(left.seconds), 's']] as Array<[string, string]>) : []),
  ]

  const spoken = [
    left.days > 0 ? `${left.days} days` : null,
    `${left.hours} hours`,
    `${left.minutes} minutes`,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <motion.div {...riseIn(0.45)} style={heroRailSlot(vp)}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: vp.isMobile ? 'center' : 'flex-start',
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: desktop ? 13 : 11,
            lineHeight: '120%',
            // Positive tracking, like the uppercase kicker in EventInfo: all-caps has
            // no ascenders or descenders to carry word shape at this size, so it leans
            // entirely on letter separation.
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#fff',
          }}
        >
          {HERO_COPY.countdownLabel}
        </div>

        {/*
          `role="timer"` carries an implicit `aria-live="off"`, which is the point: a
          per-second live region would interrupt a screen reader every second for the
          entire time the page is open. The label states it in words instead, read on
          demand, and the digits below are hidden from the tree so they are not
          announced twice in a form nobody wants to hear spelled out.
        */}
        <div
          role="timer"
          aria-label={`${HERO_COPY.countdownLabel} ${spoken}`}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: desktop ? 12 : 8,
            marginTop: desktop ? 10 : 6,
          }}
        >
          {units.map(([value, unit]) => (
            <div
              key={unit}
              aria-hidden="true"
              style={{
                fontFamily: FONT,
                fontWeight: 500,
                fontSize: desktop ? 44 : 30,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                color: '#fff',
                // Without this the digits are proportional and the whole row twitches
                // sideways on every tick as 1s and 7s swap in and out.
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {value}
              <span
                style={{
                  fontSize: desktop ? 17 : 13,
                  letterSpacing: '-0.02em',
                  marginLeft: 1,
                }}
              >
                {unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
