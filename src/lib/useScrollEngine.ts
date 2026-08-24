import { useEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Glyphs for the badge, each standing in for something the night is about —
 * glitter, the crush, the smiley, the music, the Y2K flower, chrome sparkle,
 * the hash, the "2" of Back 2 School, the `^^` emoticon, and a little
 * chatroom punctuation.
 *
 * `︎` is the text-presentation selector: without it, the heart and smiley
 * flip to colour emoji on some platforms and break the monochrome overlay.
 */
const SYMBOLS = ['★', '♥︎', '☺︎', '♪', '✿', '✦', '#', '2', '^^', '&', '/', '$']

/** Scrolling flickers the badge; at rest it still ticks over on its own. */
const SYMBOL_THROTTLE_MS = 80
const SYMBOL_CYCLE_MS = 450

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/**
 * How much of the first viewport the opening screen takes to clear, on a route that opens
 * on the outro.
 *
 * Half, and not the whole viewport the panel takes to arrive. The gallery cards start
 * scaling up from roughly 0.4vh — see the card loop below — so a ramp that ran the full
 * viewport would have the artwork still at a third of its opacity while photos were already
 * coming up through it. Finishing early costs a short stretch of flat ground, which is what
 * the panel is anyway.
 */
const INTRO_SPAN = 0.5

type Options = {
  spacerRef: RefObject<HTMLDivElement | null>
  panelRef: RefObject<HTMLDivElement | null>
  wrapRef: RefObject<HTMLDivElement | null>
  /** Re-measure when the grid relayouts. */
  cols: number
  /**
   * Whether this route renders a section after the scroll experience. Controls the
   * handoff: without one there is nothing to cover, so the fixed stack and the custom
   * cursor stay put all the way to the bottom.
   */
  hasBottom: boolean
  /**
   * Whether this route OPENS on the outro screen rather than on the hero.
   *
   * `/tickets` does: it has no hero canvas at all, so the artwork, the ground, the footer
   * and the outro block are what somebody lands on, the gallery is what they scroll INTO,
   * and the same screen closes the page. See `intro` in the tick below — the whole of the
   * difference is one extra ramp.
   */
  openOnOutro: boolean
}

type Card = { el: HTMLElement; top: number; height: number }

/**
 * Drives everything downstream of scroll position.
 *
 * GSAP owns exactly one thing — sliding the black panel up over the first
 * viewport of scroll. Everything else (card scales, the phase-2 wrapper
 * translate, the outro) is read from `window.scrollY` inside a single RAF loop
 * rather than from scroll events, so the page never renders a frame with stale
 * positions.
 *
 * Card geometry is measured once into `offsetTop`/`offsetHeight` and offset
 * arithmetically per frame. Reading `getBoundingClientRect()` instead would
 * force a layout flush per card per frame, and would also inherit GSAP's scrub
 * smoothing mid-transition.
 */
export function useScrollEngine({
  spacerRef,
  panelRef,
  wrapRef,
  cols,
  hasBottom,
  openOnOutro,
}: Options) {
  useEffect(() => {
    const spacer = spacerRef.current
    const panel = panelRef.current
    const wrap = wrapRef.current
    if (!spacer || !panel || !wrap) return

    const canvas = document.getElementById('main-canvas')
    const overlay = document.getElementById('outro-overlay')
    const info = document.getElementById('outro-info')
    const footer = document.getElementById('outro-footer')
    const cursor = document.getElementById('custom-cursor')
    const symbol = document.getElementById('circle-symbol')
    // The outro's three-way crossfade: the artwork arrives as the hero's own copy leaves.
    const keyart = document.getElementById('outro-keyart')
    const caption = document.getElementById('hero-caption')
    const rail = document.getElementById('hero-rail')
    // Present only on a route that passes LandingShell an `outro` block. See below.
    const outroSignup = document.getElementById('outro-signup')

    let vh = window.innerHeight
    let maxScroll = 0
    let outroOffset = 166
    let cards: Card[] = []

    /*
      IS SOMEBODY TYPING IN THE OUTRO BLOCK RIGHT NOW.

      Everything else in this file treats `window.scrollY` as a statement of intent. This is
      the one case where it is not, and it is the one that broke the form.

      Tapping a field in a `position: fixed` block pinned to the bottom of a phone screen
      opens the on-screen keyboard, and every mobile browser answers that by scrolling the
      document — it is trying to lift the focused input clear of the keyboard. Nobody asked
      for that scroll, and on `/tickets` it lands on the steepest ground on the page. The
      intro ramp below is half a viewport end to end, so on a 667px screen roughly 15px of
      it takes `formIn` under 0.9 and the block STOPS TAKING TAPS, and roughly 150px takes
      it under 0.02 and the block IS GONE — with the ground, the artwork and the footer
      fading out behind it on the way down. That is the reported bug: the form glitches out
      from under the person filling it in, at the top of the page, mid-word.

      So while focus is inside that block, `art` is held at 1 and the outro screen simply
      stays the screen. Holding that one value is enough to freeze the whole composition:
      the ground is opaque at 1, so the gallery panel and the cards still moving behind it
      are not visible either, and every other layer on this screen is fixed.
    */
    let typing = false
    /** Where the page was when they tapped the field, and where it goes back to on blur. */
    let pinnedY = 0

    const measure = () => {
      vh = window.innerHeight
      // offsetParent for the cards is the fixed panel, so offsetTop is already
      // the card's y relative to the panel's own top edge.
      cards = Array.from(panel.querySelectorAll<HTMLElement>('.bp-card')).map((el) => ({
        el,
        top: el.offsetTop,
        height: el.offsetHeight,
      }))
      maxScroll = Math.max(0, wrap.scrollHeight - vh)
      outroOffset = Number(info?.dataset.outroOffset ?? 166)
      spacer.style.height = `${vh + maxScroll + 2 * vh}px`
      ScrollTrigger.refresh()
    }

    const pin = () => {
      if (typing) return
      typing = true
      pinnedY = window.scrollY
    }

    /*
      `restore` is the whole difference between the two ways the hold ends.

      BLUR RESTORES. The keyboard's scroll was never asked for, so putting the page back
      where the visitor left it is what makes releasing the hold invisible. Without it the
      outro fades out the instant somebody finishes typing — the same glitch, moved later,
      and landing on the confirmation line they are meant to read.

      A DELIBERATE GESTURE DOES NOT. Somebody wheeling or dragging while a field is focused
      is leaving, and yanking them back to the form would be the worse of the two bugs; they
      resume from wherever they have got to. A `touchmove` that starts INSIDE the block is
      excluded from that, because on a two-field strip it is a text selection or a fumble
      rather than an attempt to scroll away — and treating it as one would drop the hold
      while the keyboard is still up, which is exactly the state it exists to survive.
    */
    const release = (restore: boolean) => {
      if (!typing) return
      typing = false
      if (restore && window.scrollY !== pinnedY) window.scrollTo(0, pinnedY)
    }

    const onFocusIn = () => pin()
    /** `focusin`/`focusout` bubble where `focus`/`blur` do not, so these sit on the block. */
    const onFocusOut = (e: FocusEvent) => {
      // Tabbing from the name field to the email field is not leaving the form.
      const next = e.relatedTarget
      if (next instanceof Node && outroSignup?.contains(next)) return
      release(true)
    }
    const onGesture = (e: Event) => {
      if (e.type === 'touchmove' && e.target instanceof Node && outroSignup?.contains(e.target)) {
        return
      }
      release(false)
    }

    // Phase 1: the panel slides up across the first viewport of scroll.
    const slide = gsap.fromTo(
      panel,
      { y: () => window.innerHeight },
      {
        y: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: spacer,
          start: 'top top',
          end: () => `+=${window.innerHeight}`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      },
    )

    let raf = 0
    const tick = () => {
      const y = window.scrollY

      // Phase 1 pushes the whole panel down; phase 2 pulls the inner wrapper up.
      // Only one is ever non-zero.
      const panelShift = Math.max(0, vh - y)
      const wrapShift = Math.max(0, y - vh)

      wrap.style.transform = `translate3d(0, ${-wrapShift}px, 0)`

      for (const card of cards) {
        const top = panelShift + card.top - wrapShift
        const bottom = top + card.height

        let scale = 0
        if (bottom > 0 && top < vh) {
          const enter = Math.min(1, (vh - top) / (vh * 0.6))
          const exit = Math.min(1, bottom / (vh * 0.4))
          scale = clamp01(Math.min(enter, exit))
        }
        card.el.style.transform = `scale(${scale})`
      }

      // The hero is fully covered past one viewport — stop compositing it.
      if (canvas) canvas.style.visibility = y > vh ? 'hidden' : 'visible'

      const outro = clamp01((y - vh - maxScroll) / Math.max(1, vh - 100))

      /*
        THE OUTRO SCREEN'S VISIBILITY, WHICH IS NOT THE SAME THING AS THE OUTRO RAMP.

        On a route with a hero the two are identical and `intro` is a constant zero, so
        everything below reads exactly as it did. On a route that opens on the outro there
        is no hero to cover, and this screen is the FIRST thing as well as the last: it
        starts at full, clears over the opening half-viewport as the gallery panel arrives,
        and comes back on the same ramp at the end.

        One value rather than a flag on each layer. The ground, the artwork, the footer, the
        date stamp's lift and the outro block all read it, and they have to move together —
        a layer left on the raw `outro` would be missing from the landing screen while
        everything around it was there.

        `max` and not a sum: the two ramps never overlap (the intro is finished half a
        viewport in, the outro cannot start before `vh + maxScroll`), so this is the union
        of them and never runs past 1.
      */
      const intro = openOnOutro ? clamp01(1 - y / Math.max(1, vh * INTRO_SPAN)) : 0
      // Held at full while a field in the outro block has focus — the keyboard moved the
      // page, not the visitor. See `typing` above, which is where the reasoning lives.
      const art = typing ? 1 : Math.max(intro, outro)

      if (overlay) overlay.style.opacity = `${art}`
      if (info) info.style.transform = `translate3d(0, ${-outroOffset * art}px, 0)`
      if (footer) footer.style.opacity = `${art}`

      /*
        The key art fades UP with the ground it sits on, and the hero's own copy fades
        DOWN out of its way on the same ramp.

        The caption and the rail belong to a viewport four screens back, and leaving them
        pinned through the outro put a tagline and a running clock across the artwork with
        no room left for it. Crossfading on one value is what keeps the swap from reading
        as two separate things happening.

        Every route renders the key art today, so the gate below always passes. It is
        kept because the two halves have to move together: if a route ever opts out of the
        artwork, clearing the hero copy would be removing an affordance to make room for
        nothing. On the routes that hold the cue rather than the countdown, the [ RSVP ]
        control in the header does not fade, so the jump to the form survives this.

        These are plain wrappers, never the elements Motion animates on entry — see the
        note on Caption and HeroRail in Overlay.tsx for why that distinction matters.
      */
      if (keyart) {
        keyart.style.opacity = `${art}`
        const heroCopy = `${1 - art}`
        if (caption) caption.style.opacity = heroCopy
        if (rail) rail.style.opacity = heroCopy
      }

      /*
        The outro's interactive block, on the TAIL of the same ramp rather than on all of it.

        The late slice is not a flourish. EventInfo is visible from page load — it fades in
        through Motion on mount, not off this ramp — and only its TRANSLATE is driven here,
        so for the first half of the outro it is still on its way up out of the band this
        block sits in. Fading the block in on the raw `outro` value put a form under a date
        stamp that had not finished moving.

        The two thresholds do different jobs and neither is the opacity. `visibility` takes
        it out of the tab order and the accessibility tree, so keyboard focus cannot wander
        into a form four viewports before it exists. `pointerEvents` waits until it is
        essentially opaque, because a control that is on screen at 30% and already clickable
        is a control someone taps by accident on the way past.

        WHICH IS A RULE ABOUT ARRIVING, AND THE INTRO RAMP IS NOT AN ARRIVAL.

        The accidental tap it guards against is a control coming up the page towards someone
        who is travelling past it, which is the outro. On `/tickets` this block is also on
        the screen the visitor LANDS on, and there it is leaving rather than arriving: they
        are already on it, they are looking at it, and it is the only thing on that screen to
        fill in. Applying the arrival rule to that end of the ramp made the form dead to the
        touch after ~15px of scroll while still painted at 91% — a form that looks entirely
        present and answers nothing, which is indistinguishable from the page being broken.

        So the guard is applied where the reason for it is. On the way in, tappable while it
        is essentially opaque; on the way out, tappable for as long as it is visible.
      */
      const formIn = clamp01((art - 0.55) / 0.45)
      if (outroSignup) {
        const visible = formIn > 0.02
        outroSignup.style.opacity = `${formIn}`
        outroSignup.style.visibility = visible ? 'visible' : 'hidden'
        outroSignup.style.pointerEvents = (intro > 0 ? visible : formIn > 0.9) ? 'auto' : 'none'
      }

      // The bottom section (when a route has one) begins entering here and has fully
      // covered the viewport one viewport later. It sits above every fixed layer, so
      // it rides up over the pinned outro on its own — nothing needs animating.
      //
      // Both thresholds are gated on the section actually existing. On a route
      // without one, `coverStart` lands exactly on max scroll, so an ungated check
      // would blink the custom cursor out at the very bottom of the page.
      const coverStart = maxScroll + 2 * vh
      const coverEnd = coverStart + vh
      const covering = hasBottom && y >= coverStart

      // Only hide the fixed stack once it is completely behind the section. Hiding at
      // `coverStart` — the moment the section began entering — is what made the
      // handoff feel like the page breaking: the whole outro vanished in one frame
      // while it was still in full view. On a route with no bottom section, scroll
      // never reaches coverEnd, so this simply never fires.
      //
      // `visibility` rather than `opacity`: it doesn't affect layout (so the spacer
      // keeps its scroll height) and it drops the hidden layers out of the tab order
      // and the accessibility tree, which keeps keyboard focus from wandering
      // through invisible overlay text on the way to the form.
      spacer.style.visibility = hasBottom && y >= coverEnd ? 'hidden' : 'visible'

      // The custom cursor has to go as soon as the section starts covering, not when
      // the spacer hides. `cursor: none` lives on the spacer and isn't inherited by
      // the section, so during the overlap the real system cursor is already being
      // drawn over the section — leaving the ring visible below it would show two
      // cursors at once.
      //
      // SCROLL POSITION IS THE ONLY THING THAT BELONGS IN THIS RULE.
      //
      // It used to also hide the ring whenever `formIn > 0.9`, for what looks like the same
      // two-cursors reason: the outro block sets `cursor: auto` on itself, so once it is
      // live the system cursor is being drawn over a form. But that block is a 330px column
      // in one corner and this property hides the ring across the WHOLE viewport — and on
      // `/tickets` the outro is at full from the very first frame, which puts `formIn` at 1
      // before anybody has scrolled. The screen that route opens on had no pointer on it at
      // all, anywhere outside that column, which is the one screen carrying the offer.
      //
      // Where the pointer happens to BE is the pointer's own business, not the scroll's.
      // CustomCursor hides itself over `[data-system-cursor]` regions and writes `opacity`
      // to do it, so the two owners never clobber each other. See the note there.
      if (cursor) cursor.style.visibility = covering ? 'hidden' : 'visible'

      raf = requestAnimationFrame(tick)
    }

    let symbolIndex = 0
    const nextSymbol = () => {
      if (!symbol) return
      // Never land on the current glyph again — a repeat just reads as a
      // dropped frame rather than a change.
      let pick = symbolIndex
      while (pick === symbolIndex) {
        pick = Math.floor(Math.random() * SYMBOLS.length)
      }
      symbolIndex = pick
      symbol.textContent = SYMBOLS[pick]
    }

    let lastSymbolAt = 0
    const onScroll = () => {
      const now = performance.now()
      if (now - lastSymbolAt < SYMBOL_THROTTLE_MS) return
      lastSymbolAt = now
      nextSymbol()
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cycle = reducedMotion ? 0 : window.setInterval(nextSymbol, SYMBOL_CYCLE_MS)

    let remeasure = 0
    let lastWidth = window.innerWidth
    const onResize = () => {
      const width = window.innerWidth
      const rotated = width !== lastWidth
      lastWidth = width

      /*
        The keyboard again, on the browsers that answer it by shrinking the layout viewport
        rather than the visual one.

        `measure` reads `window.innerHeight` into `vh`, rewrites the spacer height off it and
        refreshes ScrollTrigger. Doing that against a viewport 300px shorter halves every
        ramp on the page and re-lays the scroll out underneath somebody mid-word, which is
        the second half of the same glitch the hold above fixes.

        A height-only resize while a field in that block has focus IS the keyboard, and is
        ignored — `vh` is still correct, because the keyboard did not change the viewport the
        page was laid out for. A rotation changes the WIDTH, which the keyboard never does,
        and is measured normally.
      */
      if (typing && !rotated) return

      cancelAnimationFrame(remeasure)
      remeasure = requestAnimationFrame(measure)
    }

    measure()
    raf = requestAnimationFrame(tick)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('load', onResize)
    const observer = new ResizeObserver(onResize)
    observer.observe(wrap)

    // Only a route with an outro block has a field to focus, and only that block's focus
    // can misread as scroll — so on every other route none of this is wired at all.
    if (outroSignup) {
      outroSignup.addEventListener('focusin', onFocusIn)
      outroSignup.addEventListener('focusout', onFocusOut)
      // `passive`, like every other listener here: neither of these cancels anything, and
      // watching a scroll gesture must never be able to delay one.
      window.addEventListener('wheel', onGesture, { passive: true })
      window.addEventListener('touchmove', onGesture, { passive: true })
    }

    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(remeasure)
      clearInterval(cycle)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('load', onResize)
      observer.disconnect()
      if (outroSignup) {
        outroSignup.removeEventListener('focusin', onFocusIn)
        outroSignup.removeEventListener('focusout', onFocusOut)
        window.removeEventListener('wheel', onGesture)
        window.removeEventListener('touchmove', onGesture)
      }
      slide.scrollTrigger?.kill()
      slide.kill()
    }
  }, [spacerRef, panelRef, wrapRef, cols, hasBottom, openOnOutro])
}
