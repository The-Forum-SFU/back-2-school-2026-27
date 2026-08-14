/** Hero comparison pair. `hero-base` sits left of the divider, `hero-reveal`
 *  right of it. Both are the same pose, so the seam reads as one image. */
export const HERO_BASE = '/hero/hero-base.jpg'
export const HERO_REVEAL = '/hero/hero-reveal.jpg'

/** Bear-head badge. Full colour — must stay out of any `exclusion` group. */
export const LOGO_BEAR = '/logo/bear_head.png'

/** "THE FORUM" wordmark. White on transparent, so `exclusion` inverts it. */
export const LOGO_WORDMARK = '/logo/wordmark.png'

/** TF monogram for the custom cursor. Black on transparent. */
export const CURSOR_BADGE = '/cursor/tf-badge.png'

/**
 * Crumpled lined notebook paper, 600×783. Backs the signup sheet at the end of
 * the scroll.
 *
 * Used as a contained sheet rather than a full-bleed background: it's a picture of
 * one piece of paper — punch holes down the left, red margin rule, torn edges — so
 * tiling it repeats those features visibly, and stretching it across a desktop-width
 * section is a ~2.4x upscale that turns the ruled lines to mush. Kept near its native
 * width it stays crisp and reads as an actual sheet.
 */
export const PAPER = '/crumbled_paper.jpg'

/** Lightest tone sampled from PAPER — used where a real colour is unavoidable. */
export const PAPER_WHITE = '#f7f8f9'

/** Gallery photos, in the order they appear down the black panel. */
export const GALLERY = [
  '/gallery/gallery-01.jpg',
  '/gallery/gallery-02.jpg',
  '/gallery/gallery-03.jpg',
  '/gallery/gallery-04.jpg',
  '/gallery/gallery-05.jpg',
  '/gallery/gallery-06.jpg',
  '/gallery/gallery-07.jpg',
  '/gallery/gallery-08.jpg',
  '/gallery/gallery-09.jpg',
  '/gallery/gallery-10.jpg',
]

export const FONT = "'Inter Tight', sans-serif"
