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
   out as they cross the viewport.
3. **Outro** — a ground fades up over the gallery carrying the campaign key art,
   the wordmark and the date stamp. It fades to **black** rather than the white it
   used to, because there is now something on it. Same black as the gallery, so the
   two read as one dark room the photos leave and the artwork arrives in.
4. **Form sheet** — a cream ruled page rides up over the outro at `z-index: 60`.

Both dark surfaces are flat `#000`, not a tinted gradient. The poster is the only
saturated thing on screen and wants nothing competing behind it, and `exclusion` is a
no-op against black, so the overlay type resolves to pure white. See `GROUND` in
[src/theme.ts](src/theme.ts).

`LandingShell` owns that sequence. Steps 1 to 3 are the same on every route that renders
it, key art included — the outro belongs to the EVENT, not to whatever list a route
happens to own. Only step 4 is a prop (`bottom`), so a route brings its own ending.

The key art is a FIXED layer inside the outro, not a section below the spacer. That
distinction is load-bearing: `hasBottom` — and with it `coverStart` / `coverEnd` in
`useScrollEngine` and the auto-advance — keys off `bottom` only, because the key art never
scrolls. It lives and dies inside the outro.

The outro is a three-way crossfade on one value. The ground and the key art fade **up**
while the hero's caption and rail fade **down** out of the way, so a tagline and a running
clock are not left sitting across the artwork.

| File | Role |
| --- | --- |
| [src/App.tsx](src/App.tsx) | `/`, the landing page |
| [src/components/LandingShell.tsx](src/components/LandingShell.tsx) | The scroll experience, plus whatever a route puts under it |
| [src/lib/useScrollEngine.ts](src/lib/useScrollEngine.ts) | The RAF loop — card scales, phase-2 translate, outro |
| [src/lib/layout.ts](src/lib/layout.ts) | `buildLayout` — the scattered grid |
| [src/components/HeroCanvas.tsx](src/components/HeroCanvas.tsx) | Hero image layers + drag handling |
| [src/components/RevealLayer.tsx](src/components/RevealLayer.tsx) | `hero-reveal`, clipped at the divider |
| [src/components/SplitDivider.tsx](src/components/SplitDivider.tsx) | The draggable rule, handle and keyboard control |
| [src/components/Overlay.tsx](src/components/Overlay.tsx) | Logo, nav, caption, event info, CTA, footer |
| [src/components/BlackPanel.tsx](src/components/BlackPanel.tsx) | The gallery sheet |
| [src/components/KeyArt.tsx](src/components/KeyArt.tsx) | Poster with the teaser resting on it, on the outro |
| [src/components/LandingBottom.tsx](src/components/LandingBottom.tsx) | What `/` puts on the paper sheet: the form, or the tickets |
| [src/theme.ts](src/theme.ts) | The REWIND palette, sampled off the poster |
| [src/components/PageTracking.tsx](src/components/PageTracking.tsx) | Meta Pixel + ad attribution, for every route |

GSAP owns exactly one thing: sliding the panel up over the first viewport
(`ScrollTrigger`, `scrub: true`). Everything else is read from `scrollY` inside
one RAF loop, so no frame ever renders with stale positions. Motion handles only
the staggered entry animations — logo 0s, nav 0.15s, caption 0.3s, info 0.45s.

## The Meta Pixel

Mounted once, at the router root, by
[PageTracking](src/components/PageTracking.tsx). It used to be initialised inside
`ListSection`, which is a section of the signup form, so the pixel existed only on the two
routes that render one. `/tickets` fired nothing, and that is the page every ad points at
from the drop onward.

Two separate problems came with that, and the second is easy to miss: this is a
single-page app, so the pixel's own automatic PageView runs once per DOCUMENT. Every route
change after that is invisible to it. Meta was being told about one page per session.
`trackPageView()` is called per route now, and `initMetaPixel` no longer fires PageView
itself — the two jobs are split so exactly one thing decides when a page view happened.

**Paths that redirect do not report a view.** `isTransient` in that file lists them, and
it matters because both redirects sit on the paid path: after the drop, an ad click on `/`
renders `/`, forwards to `/tickets`, and lands. That is one visit, and counting the
doorway would inflate precisely the traffic being paid for. It reads the SAME
`useTicketsLive()` the two routes redirect on rather than re-deriving it, so the tracker
cannot disagree with the router.

`VITE_META_PIXEL_ID` absent means every function here no-ops, so a preview deploy without
one behaves like the site minus the reporting.

If you verify this with a headless browser, send a normal User-Agent. `fbevents.js`
accepts the event, counts it, and then silently declines to put it on the wire when it
thinks it is looking at automation — the pixel appears fully initialised and no
`facebook.com/tr` request is ever made. That is the tool, not the site.

## The ticket drop, and the one thing that changes by itself

The landing page collects addresses before the drop and sells tickets after it, and it
switches on its own while somebody is looking at it.

One instant drives all of it: `EVENT.ticketDropAt` in
[src/config/event.ts](src/config/event.ts), currently noon Pacific on August 24. Nothing
else names that moment. `general-onsale.opensAt` reads it, the presale panel's drop date
slices it, the mailing list's `closesAt` IS it, and the hero countdown counts to it, so
the clock on screen cannot disagree with the date printed anywhere else.

| Reads it via | What it decides |
| --- | --- |
| `hasDropped(now)` | the pure predicate. Everything below goes through it |
| [useDropped](src/lib/useDropped.ts) | the live version. ONE `setTimeout`, not a poll |
| `ticketsAvailable()` | is there a URL to link to at all? Config only, no clock |
| `ticketsLive(now)` | both. Every ticket link on the site is gated on this |
| `useTicketsLive()` | the live pair, and the ONLY thing the two routes redirect on |

### `/` and `/tickets` are a pair

Before the drop `/` collects addresses and `/tickets` redirects to it. From the drop
onward `/` redirects to `/tickets`, which sells. Both are live redirects, so a tab left
open on `/` at 11:59 moves itself at noon.

On `/tickets` both hero controls SCROLL to the checkout rather than linking out, because
that page has it embedded; the one link off the page is the small "Open in external tab"
above the frame, which is where somebody staring at a blank frame will actually look.

**To view `/tickets` before the drop**, add `?preview=tickets`:

```
http://localhost:5173/tickets?preview=tickets
```

It forces `useTicketsLive()` true without touching `EVENT.ticketDropAt`, which is
load-bearing in eight places and exactly the kind of edit that gets committed by accident.
Not a secret and not environment-gated, so it works on a deploy preview too; there is
nothing behind it to protect, since the link it reveals is a public TicketWeb URL. It
cannot conjure a page out of nothing either: `ticketsAvailable()` still has to be true.

Both redirects carry the query string across, so the flag survives the hop from `/` and,
more importantly, so does a paid click's `fbclid` and UTMs once the drop has landed.

Both sides read `useTicketsLive()` and nothing else. That is what makes a redirect loop
impossible rather than merely unlikely: for any answer it gives, exactly one of the two
routes wants to move. `tests/src/ticketDrop.test.tsx` guards it at the source level —
neither file may re-derive the condition from `hasDropped` and `ticketsAvailable`.

Two gates and not one, because the TicketWeb URL had to go into config days before the
sale opened. `ticketsAvailable()` on its own put a live `[ TICKETS ]` link in the header
of a page counting down to the drop, and following it landed on a real TicketWeb page
selling nothing. `EVENT.tickets.enabled` sits on top of both as the manual override for
pulling every link at once.

`ticketsAvailable()` is also the safety net in the other direction. The date arrives
whether or not anyone finished wiring TicketWeb up, so
[LandingBottom](src/components/LandingBottom.tsx) requires BOTH before it takes the signup
form off the page. If the link is missing at noon, the page keeps doing what it was doing
at 11:59 rather than showing an empty section.

### Two lists, and why they are not one

| | `mailing-list` | `presale-guestlist` |
| --- | --- | --- |
| Route | `/`, public | unlisted, see [src/routes.ts](src/routes.ts) |
| Capacity | none | 75, enforced in `claim_signup` |
| Grants | nothing | discounted door entry |
| Brevo | `BREVO_LIST_ID_MAILING` | `BREVO_LIST_ID_PRESALE` |

Same form component, same fields, same consent wording. The difference is entirely in
config, and three properties carry it: `capacity: null`, no `doorInstructions`, and
`priceCents: 0`. That last one is what
[ListSection](src/components/ListSection.tsx) and [Confirmed](src/pages/Confirmed.tsx)
both test before rendering the price comparison, so a public signup is never shown a
door rate nobody is holding for them.

The marketing opt-in is **optional**. It is recorded either way, so the Brevo list is not
a lawful send list on its own: anything promotional goes to a segment filtered on
`OPT_IN = true`. See the note above `attributesFor` in
[api/_lib/brevo.ts](api/_lib/brevo.ts).

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

Campaign key art, from `Images/Event/` (41 MB of print-weight PNGs and a 22 MB
teaser, none of it web-safe):

```bash
# key art card, 4:5
sips -Z 1080 --setProperty format jpeg --setProperty formatOptions 68 \
  Images/Event/TF-REWIND-B2S-2026-1080x1350.png --out public/event/poster.jpg

# link preview, 16:9. JPEG, because several crawlers still do not decode WebP
sips -Z 1200 --setProperty format jpeg --setProperty formatOptions 82 \
  Images/Event/TF-REWIND-B2S-2026-1920x1080.png --out public/event/poster-og.jpg

# the video's poster frame, and what reduced motion gets instead of the video
sips -Z 1000 --setProperty format jpeg --setProperty formatOptions 68 \
  Images/Event/TF-REWIND-B2S-2026-1080x1920.png --out public/event/teaser-poster.jpg

# lockup. WebP keeps the alpha at a quarter of the PNG's size
sips -Z 1100 Images/Event/REWIND-Logo-w-Sub.png --out /tmp/lockup.png
cwebp -q 88 -alpha_q 90 -m 6 /tmp/lockup.png -o public/event/rewind-lockup.webp

# teaser: 1080x1920 / 22 MB / 14s  ->  360x640 / 3.5 MB
avconvert --preset Preset640x480 \
  --source Images/Event/TF-REWIND-B2S-2026-TEASER.mp4 --output public/event/teaser.mp4
```

`avconvert` has fixed rate control and no bitrate flag, so the preset is the only lever:
`Preset960x540` gives a better 540x960 at 6.6 MB, and `PresetHEVC1920x1080` will not
downscale at all and lands at 11.7 MB. 360x640 is the compromise, and the card is capped
at 300px wide to match it. It is still the heaviest file on the site, which is why
[KeyArt](src/components/KeyArt.tsx) withholds the `<source>` behind an
`IntersectionObserver` rather than trusting `preload="none"`.

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
