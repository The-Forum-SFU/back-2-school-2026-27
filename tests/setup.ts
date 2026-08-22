import { afterEach, expect } from 'vitest'

/**
 * Shared test setup.
 *
 * `@testing-library/jest-dom` and `cleanup` are only meaningful under jsdom, and
 * importing them unconditionally would pull a DOM shim into every node-environment
 * test file. Both are loaded lazily, guarded on there actually being a document.
 */
if (typeof document !== 'undefined') {
  const matchers = await import('@testing-library/jest-dom/matchers')
  expect.extend(matchers.default ?? matchers)

  const { cleanup } = await import('@testing-library/react')
  afterEach(() => cleanup())

  /*
   * jsdom ships no IntersectionObserver either, and KeyArt uses one to hold the teaser
   * back until it is nearly on screen.
   *
   * A stub that observes nothing and never fires, which is the honest default: nothing
   * is on screen in jsdom, so the lazy branch stays unentered and the poster frame
   * stands in. A test that wants the loaded state drives `setNear` by replacing this.
   *
   * The component guards on this being undefined and degrades to the still, so this
   * shim is here to exercise the real path rather than to stop a crash.
   */
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
      root = null
      rootMargin = ''
      thresholds = []
    } as unknown as typeof IntersectionObserver
  }

  /*
   * jsdom ships no ResizeObserver, and useScrollEngine observes the gallery wrapper to
   * re-measure when the grid reflows. Unlike IntersectionObserver above, the engine does
   * NOT guard on it, so its absence throws during the mount effect and takes the whole
   * shell down — which is why any test that renders a full route needs this.
   *
   * Observes nothing and never fires. Layout never changes in jsdom, so a re-measure would
   * have nothing to re-measure; a test that wants one calls the callback itself.
   */
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }

  /*
   * jsdom ships no matchMedia, and useViewport calls it on first render — so every
   * component that reads the viewport throws before it renders anything.
   *
   * Answers `false` to everything, which resolves to the desktop breakpoint with a
   * fine pointer and no reduced-motion preference. Any test that cares about a
   * different viewport passes one in explicitly rather than relying on this.
   */
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
}
