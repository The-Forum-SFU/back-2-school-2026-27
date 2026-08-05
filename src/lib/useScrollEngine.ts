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

type Options = {
  spacerRef: RefObject<HTMLDivElement | null>
  panelRef: RefObject<HTMLDivElement | null>
  wrapRef: RefObject<HTMLDivElement | null>
  /** Re-measure when the grid relayouts. */
  cols: number
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
export function useScrollEngine({ spacerRef, panelRef, wrapRef, cols }: Options) {
  useEffect(() => {
    const spacer = spacerRef.current
    const panel = panelRef.current
    const wrap = wrapRef.current
    if (!spacer || !panel || !wrap) return

    const canvas = document.getElementById('main-canvas')
    const overlay = document.getElementById('outro-overlay')
    const info = document.getElementById('outro-info')
    const buy = document.getElementById('outro-buy')
    const footer = document.getElementById('outro-footer')
    const symbol = document.getElementById('circle-symbol')

    let vh = window.innerHeight
    let maxScroll = 0
    let outroOffset = 166
    let cards: Card[] = []

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
      if (overlay) overlay.style.opacity = `${outro}`
      if (info) info.style.transform = `translate3d(0, ${-outroOffset * outro}px, 0)`
      if (buy) buy.style.transform = `scale(${outro})`
      if (footer) footer.style.opacity = `${outro}`

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
    const onResize = () => {
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

    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(remeasure)
      clearInterval(cycle)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('load', onResize)
      observer.disconnect()
      slide.scrollTrigger?.kill()
      slide.kill()
    }
  }, [spacerRef, panelRef, wrapRef, cols])
}
