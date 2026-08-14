import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'

/**
 * BOTH routes are lazy, deliberately.
 *
 * Lazy-loading only Presale would keep Presale out of the landing chunk but would
 * NOT keep GSAP and motion out of /presale — a static `import App` makes them deps
 * of the entry chunk, so they'd download on every route. The cost of the second
 * lazy() is one extra round trip on the landing page, which is noise next to the
 * hero imagery it's already fetching.
 */
const Landing = lazy(() => import('./App'))
const Presale = lazy(() => import('./pages/Presale'))

// Matches the global body background so a chunk's load window doesn't flash.
const Fallback = <div style={{ position: 'fixed', inset: 0, background: '#fff' }} />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={Fallback}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/presale" element={<Presale />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
