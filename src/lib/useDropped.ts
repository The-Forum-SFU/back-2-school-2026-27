import { useEffect, useState } from 'react'
import { EVENT, hasDropped, ticketsAvailable } from '../config/event'

/**
 * Has the ticket drop landed, live.
 *
 * The landing page shows an email form before the drop and the TicketWeb block after it,
 * and the switch has to happen on a page that is already open. Somebody who lands at
 * 11:58 waiting for noon is exactly the person this is for, and asking them to reload is
 * asking them to leave.
 *
 * ONE timer, not a poll. The remaining milliseconds are known exactly, so this schedules a
 * single `setTimeout` for that instant instead of waking up every second to compare two
 * numbers that will not be equal for hours. Nothing here ticks: `DropCountdown` is the
 * component that needs a per-second clock, and it has its own.
 *
 * `Date.now()` rather than a passed-in clock, because this is the hook and not the
 * predicate. The pure half is `hasDropped(now)` in src/config/event.ts, which is what
 * tests drive at the boundary.
 */

const DROP_AT = new Date(EVENT.ticketDropAt).getTime()

/**
 * setTimeout stores its delay in a signed 32-bit int. A delay past this overflows and
 * fires IMMEDIATELY, which would flip the page to tickets the moment it loaded on any
 * date more than ~24 days out. Clamping re-arms instead, which for a drop this close
 * never happens, and stays correct if these dates are ever reused for a further-off event.
 */
const MAX_DELAY = 2_147_483_647

export function useDropped(): boolean {
  const [dropped, setDropped] = useState(() => hasDropped(new Date()))

  useEffect(() => {
    if (dropped) return

    let id: number
    const arm = () => {
      const remaining = DROP_AT - Date.now()
      if (remaining <= 0) {
        setDropped(true)
        return
      }
      id = window.setTimeout(arm, Math.min(remaining, MAX_DELAY))
    }
    arm()

    return () => window.clearTimeout(id)
  }, [dropped])

  return dropped
}

/**
 * Query flag that forces the ticket page on before the drop, for previewing it.
 *
 * `/tickets` redirects to `/` until tickets are live, which is correct and also means the
 * page cannot be looked at before the day it matters. The alternative was editing
 * `EVENT.ticketDropAt` to a past date to see it, which is a load-bearing value in eight
 * places and exactly the kind of edit that gets committed by accident.
 *
 * Deliberately NOT a secret and deliberately not gated on the environment: the point is
 * to be able to open the real page on the real deployment, and there is nothing behind it
 * to protect. The ticket link it reveals is a public TicketWeb URL.
 *
 * It cannot conjure a page out of nothing: `ticketsAvailable()` still has to be true, so
 * with no URL configured this shows the same nothing everyone else would get.
 */
function previewingTickets(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('preview') === 'tickets'
}

/**
 * Are tickets on sale right now, live.
 *
 * `useDropped` is the clock and `ticketsAvailable()` is the config, and this is the pair
 * of them. It exists as ONE function because two routes redirect at each other across it:
 * `/` sends people to `/tickets` when it is true and `/tickets` sends them back when it
 * is false. Two separate expressions that were meant to agree would be one edit away from
 * a redirect loop; one predicate cannot disagree with itself.
 *
 * The `ticketsAvailable()` half is also the safety net. The date arrives whether or not
 * anyone finished wiring TicketWeb up, and without it a missing URL at noon would send
 * every visitor from a working signup form to a page with nothing on it.
 */
export function useTicketsLive(): boolean {
  // The hook runs unconditionally; only its result is overridden. Reading the query
  // string per render is fine because it cannot change without a navigation.
  const dropped = useDropped()
  return (dropped || previewingTickets()) && ticketsAvailable()
}
