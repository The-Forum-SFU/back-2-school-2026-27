/**
 * The REWIND campaign palette, sampled from the printed key art.
 *
 * Source: Images/Event/TF-REWIND-B2S-2026-1920x1080.png. Every value below was measured
 * off that file rather than picked by eye, so the site and the poster are the same
 * artwork. `navy` is 42% of the poster's pixels and is the ground everything else sits on;
 * `aqua` is the iPod, the treble clef and the venue line, and is the one accent.
 *
 * ⚠️ NONE OF THESE MAY GO ON THE HERO OVERLAY.
 *
 * Every layer in Overlay.tsx spreads `overlayBase`, which carries
 * `mixBlendMode: 'exclusion'` so white type can read black over the light hero and white
 * over the black panel. Exclusion inverts against the backdrop, so a saturated colour in
 * that group does not render as itself: aqua over white comes out a muddy rose, and it
 * changes again the moment the gallery panel slides underneath. The caption, the
 * countdown, EventInfo, the header control and the footer stay '#fff' for that reason.
 *
 * These belong on surfaces OUTSIDE that group: anything inside the `#signup` section,
 * which is a sibling of the scroll spacer and does no blending at all, and the small dark
 * chrome around the key art.
 *
 * The three LIGHTING colours below are documentation rather than working tokens now. They
 * were used to tint the gallery and the outro and are not any more; see GROUND. They stay
 * because they are what the poster is actually lit with, and the next person reaching for
 * a colour should be able to see the whole sampled set rather than the surviving half.
 *
 * Not Tailwind theme tokens: this project has no `@theme` block and styles in inline
 * objects (see src/components/form/Field.tsx, which owns the paper palette the same way).
 */
export const REWIND = {
  /** The accent. The iPod body, the treble clef, "CELEBRITIES NIGHTCLUB". */
  aqua: '#46D5C8',
  /** One step up, for hover and for type that has to hold against a photo. */
  aquaBright: '#4CEFC6',
  /** The bloom around every lit object. Low alpha only, never as a fill. */
  glow: '#7AFFF1',
  /** Lighting. The light falling in from the top left of the poster. */
  blue: '#1A5EB8',
  /** Lighting. Deeper blue, between `blue` and `navy`. */
  denim: '#112859',
  /**
   * The dark the poster's own frame sits at, and near-black by design.
   *
   * For chrome AROUND the artwork: the rim on the teaser, the ticket frame's backdrop
   * before it paints. Not for the big surfaces, which are flat #000. See GROUND.
   */
  navy: '#14131F',
  /** Lighting. The warm light in the bottom right corner. Balances `blue`, never leads. */
  rust: '#552E30',
  /** The poster's white, which is slightly cool. For type on a dark ground. */
  offWhite: '#E3EFED',
} as const


/**
 * The ground under the gallery and the outro. Flat, and deliberately so.
 *
 * Both surfaces were briefly a navy-to-blue gradient lit from two corners, on the theory
 * that they should echo the poster's own lighting. They should not. The poster is a
 * photograph with real light in it; a CSS radial pretending to be the same thing reads as
 * a template, and it put a second, weaker version of the artwork's colour directly behind
 * the artwork, which is competition rather than support.
 *
 * Flat black wins on three counts. The poster is the only saturated thing on screen and
 * has nothing to fight. Photographs sit better on black than on a tinted ground. And
 * `mix-blend-mode: exclusion` is a NO-OP against #000, so the overlay type resolves to
 * pure white here, where over blue it inverted to a gold cast nobody asked for.
 *
 * If this ever wants texture, reach for grain over gradient. The poster is heavily
 * halftoned and grain belongs to the same vocabulary; a smooth ramp does not.
 */
export const GROUND = '#000'
