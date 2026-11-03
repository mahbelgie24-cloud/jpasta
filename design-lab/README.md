# JPasta — Design Lab

Three complete, independent homepage directions for JPasta, built to be
reviewed side by side against the live page. Nothing here is wired into the
Next.js app; every concept is a standalone static page.

## How to preview

```bash
python3 -m http.server 4173 -d design-lab
```

- Comparison index: <http://localhost:4173/>
- 01 — Atelier: <http://localhost:4173/v1-atelier/>
- 02 — Grid: <http://localhost:4173/v2-basil/>
- 03 — Souk: <http://localhost:4173/v3-souk/>

The live page remains at <http://localhost:3000> for comparison.
Baseline captures are in `_baseline/`; review captures are in `screenshots/`.

## The brief, read from the project

- JPasta is a small pasta-and-chicken shop in Qalqilya. The food truth is
  selected fresh pasta (not made in-house), house sauces prepared fresh daily,
  marinated chicken, cooked to order. No dough, handmade, or “made today”
  claims.
- Arabic is the first language and RTL is the default. Prices are integer
  agorot, rendered in Latin digits with the shekel sign.
- The brand is green + warm beige. The supplied roundel and horizontal plaque
  are the only logo assets; the wordmark is never retyped.
- The current homepage is a dark editorial hero with an illustrated plate,
  a marquee, an asymmetric dish grid, a dark craft band, a three-step section,
  and a paper visit section.
- The owner does not like the current page enough. The redesign brief is
  explicitly aesthetic: three distinct, elite directions, not a tweak.

What the best hospitality sites in 2026 do well, and what this lab borrows:

1. A clear, appetite-led first viewport with the menu one action away.
2. Editorial pacing: one strong image at a time, not a carousel of everything.
3. Real food photography with consistent grading, plus a restrained palette.
4. An actual point of view in the typography, not a neutral template face.
5. Mobile-first ordering, thumb-zone actions, 44px targets.
6. Motion that answers an action; no entrance animation on every section.
7. Accessible contrast, visible focus, reduced-motion support, semantic HTML.

Reference points studied: Qissa (Sevenoaks), Mujo Atlanta, BoccaLupo, Butcher
& Bee, Le Bernardin, Zahav, Casa Momo, TÒPAS, plus the 2026 trend reporting on
editorial typography, scroll-driven CSS, bento composition and real
photography. The concepts are original; no layout is copied.

## Concept 01 — Atelier / أتيليه

**Positioning:** the small kitchen with a big point of view. A food journal,
not a fast-food menu.

- Palette: paper `#F7F1E5`, forest `#1F3B2B`, ink `#1C2A21`,
  terracotta `#B4522F`, wheat `#C89954`, cream `#FCF8EF`.
- Type: Amiri 700 for Arabic display (existing brand face), IBM Plex Sans
  Arabic for body and UI, Fraunces italic for small Latin accents.
- Layout: 12-column editorial grid; asymmetric hero (type / arched photo);
  a signature section that is an index, not a card grid; full-bleed craft
  band; paper visit section.
- Signature idea: a printed menu index with dotted leaders and a photograph
  that follows the hovered row; a circular “cooked to order” seal.
- Motion: one orchestrated page load, scroll reveals, a slow seal rotation,
  a dish sheet that rises from the bottom. Everything stops under reduced
  motion.

## Concept 02 — Grid / شبكة

**Positioning:** confidence through structure. A design-studio treatment of
the same honest menu.

- Palette: near-black green `#07130D`, forest `#0E2A1B`, bone `#EFEADF`,
  wheat `#C9A25F`, acid `#D8EA72`.
- Type: Alexandria 300–800 for Arabic and Latin, no decorative face.
- Layout: visible 12-column grid, full-height split hero, a menu as a data
  table with filters, a sticky craft chapter, an oversized Qalqilya visit
  block.
- Signature idea: the menu reads like an index — name, description, price,
  hover preview — and the hero type is set against a clipped full-bleed
  photograph.
- Motion: scroll-progress rule, scroll-driven image reveals, row hover
  inversion. Reduced motion removes all travel.

## Concept 03 — Souk / سوق

**Positioning:** the warmth and bustle of a Levantine market, made premium.
The youngest, most social direction.

- Palette: sand `#F6E7CC`, cream `#FFF9EE`, tomato `#C94F2D`,
  pistachio `#5C7F4E`, olive `#25301D`, butter `#F2C14E`.
- Type: Baloo Bhaijaan 2 for display, Rubik for body (both Arabic + Latin).
- Layout: arch-shaped hero photograph, offset “print” shadows, ticket menu
  cards on a horizontal rail, a mood-based recommendation module, a wavy
  three-step path, a sunlit visit block.
- Signature idea: “شو مزاجك اليوم؟” — three moods change the recommended dish,
  and the menu is a physical-feeling rail you can drag.
- Motion: springy but short; sticker tilt; no parallax.

## Shared quality floor

- `lang="ar" dir="rtl"`, logical properties only, no physical left/right.
- 320 / 375 / 768 / 1024 / 1440 / 2560 width behaviour.
- WCAG AA contrast on all text; visible `:focus-visible`; skip link.
- 44×44px minimum targets; native `<dialog>` for overlays with focus return.
- `prefers-reduced-motion` collapses animation and marquee.
- Semantic landmarks, real buttons and links, labelled icon controls.
- Local fonts, responsive WebP images, no framework runtime, no build step.
- No emoji as icons; no stock-photo claims in copy.

## Asset notes

- Logo files are the supplied brand assets in `assets/brand/`.
- Photography is placeholder material from Unsplash and Pexels (free
  licences), downloaded for local review only. It must be replaced with real
  JPasta photography before production; the brand rules forbid stock photos
  on the live site.
- Amiri and Fraunces are the project’s existing subsets. IBM Plex Sans
  Arabic, Alexandria, Rubik and Baloo Bhaijaan 2 are SIL Open Font License
  families fetched from Google Fonts for this lab.
- All fonts are self-hosted. No page requests an external font, script or
  image at runtime.

## Verification (final)

| Check                                                            | Result                            |
| ---------------------------------------------------------------- | --------------------------------- |
| axe WCAG 2.2 AA, all four pages, desktop + mobile                | **0 violations**                  |
| Horizontal overflow, 320 / 375 / 768 / 1024 / 1440 / 2560        | **none**                          |
| Interactive targets                                              | **≥ 44×44 px** on every page      |
| Console errors / failed requests                                 | **none**                          |
| Dialogs, focus return, Esc close, cart, filters, mood, rail drag | **verified in Playwright**        |
| `prefers-reduced-motion`                                         | all ambient motion disabled       |
| Comparison page                                                  | axe **0**, responsive down to 320 |

## Review artifacts

- Live comparison index: <http://localhost:4173/>
- Atelier: <http://localhost:4173/v1-atelier/>
- Grid: <http://localhost:4173/v2-basil/>
- Souk: <http://localhost:4173/v3-souk/>
- Shareable static report (private):
  <https://artifacts.commandcode.ai/qcxpcjdm6xeyh7os>

The report is generated into `publish/compare-artifact.html` with all images
and fonts embedded. Regenerate it if the concept pages change.

## Screenshot map

- `_baseline/` — the current site before the lab (desktop + mobile).
- `screenshots/v1-atelier-desktop.png`, `-tablet`, `-mobile`, `-320` — final
  full-page captures for Atelier; the same set exists for Grid and Souk.
- `screenshots/v1-card.webp` and `v1-mobile.webp` (and the other concepts) —
  optimized crops used by the comparison page.
- `screenshots/states/` — evidence of the real interaction states: dish
  sheets, cart, filter result, mood result, mobile navigation.
- `screenshots/lab-full-final.png` — the complete comparison page.

## Not in this folder

The concepts are deliberately not wired into the Next.js app. Each is a
static page with its own CSS and JavaScript; production adoption would mean
porting one direction into the existing components and tokens, then running
the repo’s `verify` gate and Playwright visual baselines again. The real menu
data, prices and shop facts are already used in the copy.
