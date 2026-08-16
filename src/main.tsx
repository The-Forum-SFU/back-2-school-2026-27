import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { ROUTES } from './routes'

/**
 * EVERY route is lazy, deliberately.
 *
 * Lazy-loading only the guestlist would keep it out of the landing chunk but would
 * NOT keep GSAP and motion out of the guestlist route — a static `import App` makes
 * them deps of the entry chunk, so they'd download on every route. The cost of the
 * extra lazy() is one round trip on the landing page, which is noise next to the hero
 * imagery it's already fetching.
 */
const Landing = lazy(() => import('./App'))
const Guestlist = lazy(() => import('./pages/Guestlist'))
const Confirmed = lazy(() => import('./pages/Confirmed'))
const Privacy = lazy(() => import('./pages/Privacy'))

// Matches the global body background so a chunk's load window doesn't flash.
const Fallback = <div style={{ position: 'fixed', inset: 0, background: '#fff' }} />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={Fallback}>
        <Routes>
          <Route path={ROUTES.LANDING} element={<Landing />} />
          <Route path={ROUTES.GUESTLIST} element={<Guestlist />} />
          <Route path={ROUTES.CONFIRMED} element={<Confirmed />} />
          {/* Must be a real route, not the catch-all below: the form's consent notice
              links here and records that sentence against every submission. */}
          <Route path={ROUTES.PRIVACY} element={<Privacy />} />
          {/* `replace` so the back button returns to the form, not to a redirect that
              bounces straight forward again. */}
          <Route
            path={ROUTES.CONFIRMATION}
            element={<Navigate to={ROUTES.CONFIRMED} replace />}
          />
          {/*
            Anything else goes to the landing page rather than rendering nothing.
            A mistyped guestlist URL is the common case — one wrong character in a
            forwarded link — and a blank white screen reads as a broken site.
          */}
          <Route path="*" element={<Navigate to={ROUTES.LANDING} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
