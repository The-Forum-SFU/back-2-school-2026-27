type Props = {
  image: string
  /** Divider position across the hero, 0 (far left) to 1 (far right). */
  split: number
}

/**
 * The second hero image, clipped to everything right of the divider. Left of
 * it, HERO_BASE shows through from the layer below.
 */
export default function RevealLayer({ image, split }: Props) {
  const clip = `inset(0 0 0 ${(split * 100).toFixed(3)}%)`

  return (
    <div
      className="absolute inset-0 bg-center bg-cover bg-no-repeat pointer-events-none"
      style={{
        zIndex: 30,
        backgroundImage: `url(${image})`,
        clipPath: clip,
        WebkitClipPath: clip,
      }}
    />
  )
}
