/** Radius of the spotlight, in px. Tune this to resize the reveal. */
export const SPOTLIGHT_R = 400

/** Falloff of the mask, from the centre of the spotlight to its edge. */
const STOPS: [number, number][] = [
  [0, 1],
  [0.4, 1],
  [0.6, 0.75],
  [0.75, 0.4],
  [0.88, 0.12],
  [1, 0],
]

function spotlightMask(x: number, y: number): string {
  const stops = STOPS.map(
    ([offset, alpha]) => `rgba(255,255,255,${alpha}) ${offset * 100}%`,
  ).join(', ')
  return `radial-gradient(circle ${SPOTLIGHT_R}px at ${x}px ${y}px, ${stops})`
}

type Props = {
  image: string
  cursorX: number
  cursorY: number
}

/**
 * The second hero image, punched through by a soft circular mask that trails
 * the cursor. Everywhere the mask is transparent, HERO_BASE shows through from
 * the layer below.
 */
export default function RevealLayer({ image, cursorX, cursorY }: Props) {
  const mask = spotlightMask(cursorX, cursorY)

  return (
    <div
      className="absolute inset-0 bg-center bg-cover bg-no-repeat pointer-events-none"
      style={{
        zIndex: 30,
        backgroundImage: `url(${image})`,
        maskImage: mask,
        WebkitMaskImage: mask,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
      }}
    />
  )
}
