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
 * Base tone of the signup sheet.
 *
 * There is no paper IMAGE any more. The ruled sheet at the end of the scroll is
 * drawn in CSS — see `.paper-surface` in src/index.css, which owns the colour, the
 * blue ruling and the red margin rule. This constant exists only for the places
 * where a JS value is unavoidable; keep it equal to `--paper` there.
 */
export const PAPER_WHITE = '#fcfcf7'

/**
 * REWIND campaign key art, derived from the originals in `Images/Event/`.
 *
 * The supplied files are print-weight PNGs totalling 41 MB, which is thirteen times the
 * entire rest of `public/`. What ships here are downscaled derivatives, following the
 * same convention as the hero and the gallery. See the Assets section of the README for
 * the exact sips and avconvert commands that produced them.
 */

/** 4:5 poster, the key art card on the landing page. 1080x1350. */
export const POSTER = '/event/poster.jpg'

/**
 * 16:9 crop for link previews. 1200x675.
 *
 * JPEG rather than WebP deliberately: this one is read by crawlers rather than browsers,
 * and several of them still do not decode WebP.
 */
export const POSTER_OG = '/event/poster-og.jpg'

/**
 * "REWIND" lockup with its subtitle. Transparent, and the type is white and chrome, so
 * it is legible on a DARK surface only. Do not put it on the paper sheet.
 */
export const REWIND_LOCKUP = '/event/rewind-lockup.webp'

/**
 * 14s vertical teaser, re-encoded from 22 MB to 3.5 MB at 360x640.
 *
 * Still the largest single asset on the site, which is why KeyArt sets `preload="none"`
 * and does not attach a source until the card scrolls into view. Nobody who never
 * reaches the bottom of the page pays for it.
 *
 * 360x640 is the ceiling avconvert's fixed rate control allows at a sane file size: its
 * next preset up holds the same bitrate curve and lands at 6.6 MB. The card renders
 * around 300px wide, so the resolution is matched to the slot rather than generous.
 */
export const TEASER_VIDEO = '/event/teaser.mp4'

/** First-frame still. The video's poster, and what reduced motion gets instead. */
export const TEASER_POSTER = '/event/teaser-poster.jpg'

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
