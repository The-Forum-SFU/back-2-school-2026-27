import { useMemo, type RefObject } from 'react'
import { GALLERY } from '../assets'
import { buildLayout } from '../lib/layout'

type Props = {
  panelRef: RefObject<HTMLDivElement | null>
  wrapRef: RefObject<HTMLDivElement | null>
  cols: number
}

/**
 * The black sheet that slides up over the hero, carrying a scattered grid of
 * photos. Card scales are driven per-frame by the scroll engine, not by CSS —
 * this component only lays them out.
 */
export default function BlackPanel({ panelRef, wrapRef, cols }: Props) {
  const rows = useMemo(() => buildLayout(GALLERY.length, cols), [cols])
  const cells = useMemo(() => rows.flat(), [rows])

  return (
    <div
      ref={panelRef}
      className="fixed inset-0"
      style={{
        zIndex: 10,
        background: '#000',
        transform: 'translateY(100vh)',
      }}
    >
      <div ref={wrapRef} style={{ width: '100%', paddingTop: 'min(400px, 40vh)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 20,
            padding: '0 20px',
          }}
        >
          {cells.map((imageIndex, cellIndex) => {
            const col = cellIndex % cols

            if (imageIndex === -1) {
              // Spacer: holds the column slot so the scatter keeps its rhythm.
              return (
                <div key={cellIndex} style={{ aspectRatio: '2 / 3' }} aria-hidden="true" />
              )
            }

            return (
              <div
                key={cellIndex}
                className="bp-card overflow-hidden"
                style={{
                  aspectRatio: '2 / 3',
                  transform: 'scale(0)',
                  transformOrigin: col < cols / 2 ? 'right bottom' : 'left bottom',
                }}
              >
                <img
                  src={GALLERY[imageIndex]}
                  alt=""
                  draggable={false}
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
