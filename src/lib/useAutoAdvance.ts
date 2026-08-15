import { useEffect } from 'react'
import { scrollToSignup } from './scrollToSignup'

/**
 * Moves a visitor who has done nothing at all down to the form.
 *
 * The hero is something to play with, not a gate — vertical swipes have always
 * scrolled straight past it (see `touchAction: 'pan-y'` in HeroCanvas). This exists for
 * the other case: someone lands, looks at the bear, and never realises there is
 * anything below it. After `delayMs` of genuine inactivity they get taken to the form.
 *
 * THE CANCEL IS THE IMPORTANT HALF. An unrequested jump is itself friction, and yanking
 * the page out from under someone mid-drag would break the one interaction the hero
 * exists for. So the first sign of any intent at all — a scroll, a wheel, a tap, a key
 * — cancels this permanently, and it never fires again for that page load.
 *
 * Fires at most once per page load, and is not remembered across loads.
 *
 * It was briefly suppressed for the rest of the session after firing, to stop a reload
 * re-triggering it. That was wrong twice over. It made the behaviour impossible to see
 * twice without clearing storage, which is how it gets reported as broken and how a
 * demo falls flat. And the cases it was protecting were not actually problems: every
 * one of them — reloading while filling the form, pressing back from the confirmation
 * page to correct a name — ends with the visitor being taken to the form, which is
 * where they were going anyway.
 *
 * The interaction cancel below is the real protection. Anyone doing anything at all
 * never sees this fire, however many times they load the page.
 */

type Options = {
  /**
   * False on any route with no form to jump to. LandingShell passes its `hasBottom`,
   * so `/` never auto-advances and every list route gets this with no extra wiring.
   * Also the place to pass a reduced-motion check.
   */
  enabled: boolean
  delayMs?: number
}

/** Long enough to take in the hero and read the CTA, short enough to still catch someone drifting. */
const DEFAULT_DELAY_MS = 4000

/**
 * Every event that counts as "this person is doing something".
 *
 * `scroll` alone is not enough: on a touch device a drag on the bear moves the divider
 * and never scrolls the page, so a scroll-only guard would interrupt precisely the
 * person who is most engaged.
 */
const INTENT_EVENTS = ['scroll', 'wheel', 'pointerdown', 'touchstart', 'keydown'] as const

export function useAutoAdvance({ enabled, delayMs = DEFAULT_DELAY_MS }: Options): void {
  useEffect(() => {
    if (!enabled) return

    // Somewhere other than the top already, so this visitor is not sitting on the hero
    // wondering whether there is anything below it.
    //
    // A reload of THIS page always lands at 0 regardless — the scroll height is set by
    // JS after mount, so on reload the document is still one viewport tall and the
    // browser has nothing to restore against. What this does catch is a bfcache
    // restore, where the position comes back intact and no scroll event fires for
    // `cancel` to see.
    if (window.scrollY > 0) return

    let timer: number | undefined

    const cancel = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer)
        timer = undefined
      }
      for (const event of INTENT_EVENTS) window.removeEventListener(event, cancel)
    }

    timer = window.setTimeout(() => {
      timer = undefined
      cancel()
      scrollToSignup()
    }, delayMs)

    // `passive` so none of these can delay a scroll or a tap just by being observed.
    // Not `once`: the listeners are removed together by `cancel`, and a `once` listener
    // that fires still leaves the other four attached.
    for (const event of INTENT_EVENTS) {
      window.addEventListener(event, cancel, { passive: true })
    }

    // Covers unmount as well as a cancel that already ran — clearing an undefined timer
    // and removing absent listeners are both no-ops, so this is safe to run twice.
    return cancel
  }, [enabled, delayMs])
}
