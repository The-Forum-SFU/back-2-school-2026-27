import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { FONT } from '../assets'
import { EVENT, HERO_COPY } from '../config/event'
import { riseIn } from '../lib/motion'
import { scrollToSignup } from '../lib/scrollToSignup'
import { useTicketsLive } from '../lib/useDropped'
import type { Viewport } from '../lib/viewport'
import { HeroRail, railPillStyle } from './Overlay'

/**
 * Live countdown to the ticket drop, on the hero's left rail, with an RSVP under it.
 *
 * Occupies the SAME slot as ScrollCue and is the alternative to it: LandingShell picks
 * between them with its `rail` prop. See heroRailSlot in Overlay.tsx — the two share
 * their position so neither can drift, and the mobile artwork crop is sized against
 * whichever one is there.
 *
 * The RSVP is not decoration. The countdown answers "when", and on its own it left the
 * hero with nothing to press: `/` is five viewports deep and someone who never scrolls
 * never learns there is a form at all. It is the compact pill variant because this slot
 * now holds three stacked things and still has to clear the mobile crop.
 *
 * WHICH OF THE TWO STATES IT IS IN is decided by `useTicketsLive`, the same predicate the
 * routes redirect on, and NOT by whether this component's own clock has run out. Those
 * come apart in exactly one place and it matters: `/tickets?preview=tickets` is a page
 * that is selling tickets while the drop is still days away, and reading the clock here
 * put a countdown and an RSVP on the hero of it. A preview that shows something the real
 * page will never show is not a preview.
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

export default function DropCountdown({
  vp,
  hasBottom = false,
}: {
  vp: Viewport
  /**
   * Whether this route has a section below to send people to.
   *
   * Decides what the selling state's pill DOES, not what it says. With a section below it
   * scrolls, because `/tickets` has the checkout on the page and sending someone off to
   * TicketWeb from the hero of the page that already contains it is a worse answer than
   * the one two screens down. Without one there is nowhere to scroll, so it links out.
   *
   * Defaults to false, which is the safe direction: a forgotten prop gives a link that
   * works rather than a button that silently does nothing.
   */
  hasBottom?: boolean
}) {
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
  const selling = useTicketsLive()

  /*
    Selling: the rail hands over to the ticket link.

    Not "past the drop", which is the subtly different thing this used to test. A route
    can be selling before the drop, under preview, and the drop can pass with nothing to
    sell if the TicketWeb link was pulled or never landed. The predicate covers both, and
    is the one the routes redirect on, so the hero cannot contradict the page it sits on.
  */
  if (selling && hasBottom) {
    return (
      <HeroRail vp={vp}>
        <motion.div {...riseIn(0.45)}>
          {/* The arrow is the difference between this and the link below, and it is the
              same arrow ScrollCue and the RSVP use. It promises a move down the page
              rather than a move off it. */}
          <button type="button" onClick={scrollToSignup} style={railPillStyle(vp)}>
            GET TICKETS ↓
          </button>
        </motion.div>
      </HeroRail>
    )
  }

  if (selling && EVENT.tickets.url) {
    return (
      <HeroRail vp={vp}>
        <motion.div {...riseIn(0.45)}>
          <a
            href={EVENT.tickets.url}
            target="_blank"
            rel="noopener noreferrer"
            style={railPillStyle(vp)}
          >
            GET TICKETS
          </a>
        </motion.div>
      </HeroRail>
    )
  }

  /*
    The drop has passed and there is nothing to sell, so the rail is empty.

    Nothing is the honest option here: a countdown frozen at zero, or a "tickets are live"
    line with no way to buy any, is worse than the bare rail this route had before tickets
    existed. Filling in the URL turns it into the button above with no change here.
  */
  if (!left) return null

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
    <HeroRail vp={vp}>
      <motion.div
        {...riseIn(0.45)}
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

        {/*
          The one thing on this hero we want pressed.

          Scrolls rather than links, and says RSVP rather than TICKETS, because until the
          drop lands there is no ticket to sell: what is below is a form that puts you on
          the list. Same wording as the header control on this route, so the two read as
          one offer rather than two.
        */}
        <button
          type="button"
          onClick={scrollToSignup}
          style={{ ...railPillStyle(vp, true), marginTop: desktop ? 18 : 14 }}
        >
          RSVP ↓
        </button>
      </motion.div>
    </HeroRail>
  )
}
