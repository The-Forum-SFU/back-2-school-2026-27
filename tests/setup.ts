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
