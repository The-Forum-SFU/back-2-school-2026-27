# Back 2 School 2026 — The Forum University

Scroll-driven Y2K landing page. React 19 + TypeScript + Vite 6, Tailwind v4,
GSAP 3.15 (ScrollTrigger) and Motion 12.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## How the page is put together

Two phases, both driven off `window.scrollY`:

1. **Hero** (first 100vh) — `hero-base` fills the viewport and `hero-reveal` is
   clipped to everything right of a divider the user drags to compare the two.
   A black panel slides up over the top.
2. **Gallery** — the panel carries a scattered grid of photos that scale in and
   out as they cross the viewport, then a white overlay fades in behind a "view"
   CTA.

| File | Role |
| --- | --- |
| [src/App.tsx](src/App.tsx) | Composition and the `scroll-spacer` root |
| [src/lib/useScrollEngine.ts](src/lib/useScrollEngine.ts) | The RAF loop — card scales, phase-2 translate, outro |
| [src/lib/layout.ts](src/lib/layout.ts) | `buildLayout` — the scattered grid |
| [src/components/HeroCanvas.tsx](src/components/HeroCanvas.tsx) | Hero image layers + drag handling |
| [src/components/RevealLayer.tsx](src/components/RevealLayer.tsx) | `hero-reveal`, clipped at the divider |
| [src/components/SplitDivider.tsx](src/components/SplitDivider.tsx) | The draggable rule, handle and keyboard control |
| [src/components/Overlay.tsx](src/components/Overlay.tsx) | Logo, nav, caption, event info, CTA, footer |
| [src/components/BlackPanel.tsx](src/components/BlackPanel.tsx) | The gallery sheet |

GSAP owns exactly one thing: sliding the panel up over the first viewport
(`ScrollTrigger`, `scrub: true`). Everything else is read from `scrollY` inside
one RAF loop, so no frame ever renders with stale positions. Motion handles only
the staggered entry animations — logo 0s, nav 0.15s, caption 0.3s, info 0.45s.

## The exclusion blend, and its one exception

Overlay type uses `mix-blend-mode: exclusion`, so it inverts from black to white
as the black panel passes underneath it. Anything single-colour **white** gets
this for free — the wordmark and the cursor both ship white and resolve to black
over the light hero, white over the gallery.

Two traps if you swap assets:

- **Black artwork is invisible under exclusion.** Excluding against black is a
  no-op. The cursor badge ships black on transparent, so
  [CustomCursor.tsx](src/components/CustomCursor.tsx) inverts it to white and
  lets the blend produce the black.
- **Full-colour artwork gets inverted.** The bear would go cyan, so it is
  deliberately kept out of every exclusion group — hence the two separate fixed
  layers in `LogoMark` rather than one flex row. A parent that creates a
  stacking context confines a child's blending to that context, so nesting the
  wordmark inside a positioned wrapper silently leaves it plain white. Keep
  `mix-blend-mode` on the same top-level element that carries the animated
  opacity.

## Assets

Source images live in `HERO/` and `Images/Gallery/` (~105 MB, not web-safe).
The served copies in `public/` are downscaled to ~3.2 MB total:

```bash
# hero: 2560px wide, q82
sips -Z 2560 --setProperty format jpeg --setProperty formatOptions 82 \
  HERO/HERO_BASE.png --out public/hero/hero-base.jpg

# gallery: 1200px long edge, q78 (cards render <=520px CSS wide)
sips -Z 1200 --setProperty format jpeg --setProperty formatOptions 78 \
  Images/Gallery/gallery-01.jpg --out public/gallery/gallery-01.jpg
```

Brand marks (originals kept alongside):

| Served | Source | Used by |
| --- | --- | --- |
| `public/logo/bear_head.png` | as supplied | logo badge, favicon |
| `public/logo/wordmark.png` | `horizontal_white_logo.png`, 1100px | "THE FORUM" lockup |
| `public/cursor/tf-badge.png` | `Images/Cursor/PlainBadge_Black.png`, 200px | custom cursor |

Paths are declared in [src/assets.ts](src/assets.ts). To swap a photo, replace
the file in `public/gallery/` — the layout is derived from array length, so
adding or removing entries reflows on its own.

## Responsive

Mobile < 640px (2 columns) · tablet 640–1024px (3) · desktop >= 1024px (4).

The hero divider works everywhere — drag it, or focus the handle and use the
arrow keys (hold shift for bigger steps, Home/End to slam it to either edge).
Drag is bound to the whole hero rather than just the handle, with
`touch-action: pan-y` so vertical swipes still scroll the page.

The custom cursor is desktop-and-mouse only, and its badge stops spinning under
`prefers-reduced-motion`.
