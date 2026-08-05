import type { KeyboardEvent } from 'react'

type Props = {
  split: number
  onSplitChange: (next: number) => void
}

/**
 * The draggable seam between the two hero images: a full-height rule with a
 * grab handle at its middle.
 *
 * Dragging itself is owned by the hero container (so the whole image responds,
 * not just the handle) — this component contributes the visuals plus keyboard
 * control, since a drag-only slider is unreachable without a pointer.
 *
 * Painted solid white rather than blended: `exclusion` would invert it against
 * the backdrop and read as washed out. The soft shadow is what keeps pure white
 * from disappearing into the hero's near-white background.
 */
export default function SplitDivider({ split, onSplitChange }: Props) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02
    const moves: Record<string, number> = {
      ArrowLeft: split - step,
      ArrowRight: split + step,
      Home: 0,
      End: 1,
    }
    const next = moves[e.key]
    if (next === undefined) return
    e.preventDefault()
    onSplitChange(next)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${(split * 100).toFixed(3)}%`,
        width: 0,
        zIndex: 40,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -1,
          width: 2,
          background: '#fff',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.28)',
        }}
      />

      <div
        role="slider"
        tabIndex={0}
        aria-label="Drag to compare hero images"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(split * 100)}
        onKeyDown={onKeyDown}
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          transform: 'translate(-50%, -50%)',
          // Hit target stays finger-sized even though the ring drawn inside it
          // is deliberately small.
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
        }}
      >
        <svg
          width="34"
          height="34"
          viewBox="0 0 34 34"
          fill="none"
          aria-hidden="true"
          style={{ filter: 'drop-shadow(0 0 6px rgba(0, 0, 0, 0.35))' }}
        >
          <circle cx="17" cy="17" r="16.25" stroke="#fff" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  )
}
