import { useRef } from 'react'
import BlackPanel from './components/BlackPanel'
import CustomCursor from './components/CustomCursor'
import HeroCanvas from './components/HeroCanvas'
import {
  Caption,
  EventInfo,
  Footer,
  HeaderNav,
  LogoMark,
  ViewButton,
} from './components/Overlay'
import { columnsFor, useViewport } from './lib/viewport'
import { useScrollEngine } from './lib/useScrollEngine'

export default function App() {
  const vp = useViewport()
  const cols = columnsFor(vp)

  const spacerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const hasCursor = vp.isDesktop && !vp.isTouch

  useScrollEngine({ spacerRef, panelRef, wrapRef, cols })

  return (
    <div
      id="scroll-spacer"
      ref={spacerRef}
      style={{
        position: 'relative',
        userSelect: 'none',
        background: '#fff',
        height: '500vh',
        cursor: hasCursor ? 'none' : 'auto',
      }}
    >
      <HeroCanvas isMobile={vp.isMobile} />

      <BlackPanel panelRef={panelRef} wrapRef={wrapRef} cols={cols} />

      <div
        id="outro-overlay"
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 12, background: '#fff', opacity: 0 }}
      />

      <LogoMark vp={vp} />
      <HeaderNav vp={vp} />
      <Caption vp={vp} />
      <EventInfo vp={vp} />
      <ViewButton vp={vp} />
      <Footer vp={vp} />

      {hasCursor && <CustomCursor />}
    </div>
  )
}
