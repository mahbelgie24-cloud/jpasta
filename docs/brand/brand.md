# JPasta — Brand Identity System

The implementation-ready source of truth for the visual identity. Tokens are
declared once in `app/globals.css` (`@theme`) and referenced everywhere —
never raw hex in components.

## 1. Brand Core

- **Name:** JPasta — جي باستا
- **Secondary line:** Fresh Pasta & Chicken
- **Tagline:** Fresh pasta, cooked to order. With a lot of sauce and love.
- **Product truth:** pasta is bought fresh, not kneaded or made in-house;
  house sauces are prepared fresh daily. Copy may say selected fresh pasta,
  house sauces made fresh daily, marinated chicken, cooked to order; never
  dough, daily pasta-making, handmade, or "made today" for the pasta.
- **Personality:** fresh, warm, appetizing, young — premium without stiffness.
- **Voice:** Arabic-first, friendly, food-forward; English accents from the
  brand line only (never UI chrome).

## 2. Color System

Extracted direction from the owner: **green + beige**, professional and
captivating. The scales below are tuned for AA contrast on the cream base.

### Basil (brand green) — primary

| Token       | Hex       | Role                                                                              |
| ----------- | --------- | --------------------------------------------------------------------------------- |
| `basil-50`  | `#F1F7F2` | Tint background (selected states, chips)                                          |
| `basil-100` | `#DFEEE2` | Tint hover, subtle fills                                                          |
| `basil-200` | `#C0DCC8` | Decorative shapes, illustration fills                                             |
| `basil-300` | `#94C2A4` | Illustration mid-tones                                                            |
| `basil-400` | `#5FA47C` | Icons on dark, illustration accents                                               |
| `basil-500` | `#3D8A5F` | Secondary buttons, links on cream                                                 |
| `basil-600` | `#2C714B` | Hover for primary                                                                 |
| `basil-700` | `#235C3E` | **Primary actions, active states, brand header** (AA on cream, white-on-green AA) |
| `basil-800` | `#1B4831` | Dark surfaces, badge mark background                                              |
| `basil-900` | `#143725` | Footer gradient end, deep panels                                                  |
| `basil-950` | `#0C2419` | Maximum dark (footer, overlay scrim)                                              |

### Cream (warm beige) — base neutrals

| Token       | Hex       | Role                                |
| ----------- | --------- | ----------------------------------- |
| `cream-50`  | `#FDFBF7` | Page base                           |
| `cream-100` | `#F9F5EC` | Cards, raised surfaces              |
| `cream-200` | `#F2EBDB` | Illustration fills, soft wells      |
| `cream-300` | `#E7DDC8` | Borders, dividers                   |
| `cream-400` | `#D6C9AC` | Strong borders, illustration detail |
| `cream-500` | `#BFB08A` | Decorative only                     |

### Wheat (gold accent) — derived from the beige family

| Token       | Hex       | Role                                               |
| ----------- | --------- | -------------------------------------------------- |
| `wheat-300` | `#E3C98F` | Large display accents, illustration highlights     |
| `wheat-400` | `#D4AF6E` | Badge dots, dividers with character, hover accents |
| `wheat-500` | `#B98F4C` | Illustration sauce-gold, "featured" star           |
| `wheat-600` | `#9A7538` | Decorative text on **dark** surfaces only          |

**Rule (AA):** wheat is decorative/large-display only on cream (fails
contrast as body text). On `basil-800+` dark surfaces wheat-300/400 is safe
for large text and icons.

### Logo colours (locked, not UI tokens)

Each supplied lockup carries its own locked pair:

- **Roundel:** green `#296034`, cream `#EBE1BD`.
- **Horizontal header plaque:** green `#134021`, cream `#ECE0B8`.

They sit between `basil-700`/`basil-900` and `cream-300`, but they are asset
colours: never recolour a lockup to match a token, and never promote them to
UI tokens. The UI palette above is unchanged.

### Ink & text

| Token      | Hex       | Role                                            |
| ---------- | --------- | ----------------------------------------------- |
| `ink`      | `#182620` | Primary text on cream (green-tinted near-black) |
| `ink-soft` | `#4A5A51` | Secondary text, timestamps (AA on cream)        |

### Status — deliberately separated from brand usage

| Token        | Hex         | Role               | Rule                                                                |
| ------------ | ----------- | ------------------ | ------------------------------------------------------------------- |
| `terracotta` | `#B3402F`   | Error, destructive | Always icon + text label, never color alone                         |
| `bronze`     | `#B4791B`   | Warning, low stock | Same pairing rule                                                   |
| success      | `basil-600` | Order ready, saved | Icon + label required (brand green carries brand meaning elsewhere) |

## 3. Typography

| Use                   | Family         | Weights         | Notes                                                                                             |
| --------------------- | -------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| Arabic display + body | **Alexandria** | 400/500/700/800 | `--font-arabic`; body 1.7 line-height, headings 1.25                                              |
| Latin display accents | **Fraunces**   | 600/700         | `--font-display`; large Latin accents only — the wordmark is inside the logo asset, never retyped |
| Prices / numeric data | Alexandria     | 700             | `tabular-nums` — legibility where accuracy matters                                                |

**Type tiers** (fluid, clamp-based — see globals.css): `type-hero`,
`type-section`, `type-title`, `type-body`, `type-micro`. No ad-hoc sizes.

## 4. Shape, Elevation, Motion

- **Radii:** 8 (chips) / 12 (inputs) / 16 (buttons, small cards) / 24 (cards,
  modals) / 32 (heroes) / 40 (hero badge) / pill (primary CTA).
- **Shadows:** warm-tinted ladder — `shadow-card` (resting), `shadow-lift`
  (hover/interactive), `shadow-overlay` (dialogs).
- **Motion:** spring `cubic-bezier(.34,1.56,.64,1)` entrances (120–240ms);
  `fade-up` scroll reveal; one ambient marquee; everything behind
  `prefers-reduced-motion`.
- **Icons:** Lucide, stroke 2, round caps.

## 5. Logo

The identity is the supplied **JPasta roundel**: a deep-green circular field
framed by a cream outer ring and a second thin inner ring, with the wordmark
`JPASTA` in cream outlined capitals and `Fresh Pasta & Chicken` beneath it.
The roundel is one lockup — the wordmark, rules and field are part of the
asset, not typeset in the UI.

- **Files:** `public/brand/logo.svg` (full roundel, with the secondary line),
  `public/brand/logo-mark.svg` (compact roundel without the secondary line,
  for small spaces), `public/brand/logo-mono.svg` (single-colour line art for
  print/receipts), `public/brand/logo-horizontal.svg` (the wide rounded header
  plaque), `public/brand/logo-512.png` (transparent raster for OG/social),
  `app/icon.svg` (favicon), `app/favicon.ico` (fallback), `public/icons/*`
  (PWA/Apple icons, generated).
- **In-app rendering:** `components/brand/logo.tsx` references those files
  with `next/image`; the wordmark is never retyped in Fraunces or any other
  face. `Logo` = full/mark roundel; `LogoMark` = compact/mono;
  `HeaderLogo` = horizontal plaque.
- **Clear space:** the height of the wordmark's `J` on all sides; never crop
  the outer cream ring.
- **Minimum size:** full roundel 96px on screen (the secondary line needs the
  room); compact mark 32px; horizontal plaque 40px high; favicon/PWA follow
  the generated set. Print: 12mm for the full roundel, 8mm for the mono line
  art.
- **Colours (locked):** roundel green `#296034` / cream `#EBE1BD`; horizontal
  plaque green `#134021` / cream `#ECE0B8`. These are the supplied asset
  colours — do not recolour them to UI tokens.
- **Never:** recolor, stretch, outline, add a drop shadow, crop the ring, place
  the full-colour roundel on a busy photo without a cream/green safe area, or
  recreate the wordmark in another typeface. The earlier twirl “j” mark is
  retired.
- **Receipts:** `logo-mono.svg` (single-colour, thermal printers are
  black-only). Use the mono line art, not the colour roundel.

### Header lockup (horizontal)

The sticky top bar uses a header-specific horizontal lockup, not the roundel:
a wide deep-green plaque with rounded corners and a double cream frame. The
rooster/fork/pasta emblem sits at the RTL start, with `J PASTA` enlarged
beside it and `Fresh Pasta & Chicken` beneath the wordmark. The arrangement
uses the header's horizontal space so the name stays readable at 40px.

- **File:** `public/brand/logo-horizontal.svg` — 1600×557; the rounded green
  field and rounded frame are vector, the cream emblem, wordmark and tagline
  are a clean trace of the supplied art.
- **Rendering:** `HeaderLogo`; 40px high on phones, 44px on small screens,
  52px on desktop (minimum 40px), width auto from the 1600×557 aspect ratio.
  The corner radius and frame are built into the asset, never CSS-clipped.
- **Clear space:** one quarter of the lockup height on all sides; keep the
  green margin and the frame intact.
- **Never:** stretch, recolour, crop the frame, set it below 40px high, or use
  it in the footer, status page, console, receipts or app icons. The roundel
  is the primary mark on those surfaces.

## 6. Imagery

Real food photography is the Phase 1 target (R2-hosted). Until then — and as
the permanent empty-state — the **dish illustration system**
(`components/brand/dish-illustration.tsx`) renders stylized flat bowls with
per-dish sauce/topping variations from palette-adjacent food tones. Never
stock photos with watermarks; never emoji as food imagery.

## 7. Application by Surface

| Surface            | Priority                              | Brand expression                                                                                                         |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/` landing        | Editorial, appetizing, brand-defining | Cream base, basil display type, wheat accents, horizontal plaque in the header, roundel in the footer, illustration hero |
| `/menu`            | One-hand ordering, zero friction      | Cream cards, basil pill CTAs, bottom sheets, sticky category nav                                                         |
| `/console`         | Calm clarity under pressure           | Dark `theme-console`, big status colors, 44px+ targets, thumb-reach actions                                              |
| `/console/kitchen` | Readable from two metres              | High-contrast `theme-kitchen`, huge type, aging escalation                                                               |
| Receipts/print     | Legibility                            | Monochrome roundel, plain text, tabular figures                                                                          |

## 8. v2 implementation notes (2026-11 logo update)

The editorial system (paper/ink, Amiri/Alexandria/Fraunces, DishArt) is
unchanged. The supplied roundel replaces the earlier twirl “j” mark, and the
supplied horizontal plaque is the header lockup.

- **Display type:** **Amiri** for Arabic hero/section headings, paired with
  Alexandria for UI/body and Fraunces for Latin accents. The full ladder is
  `type-display` → `type-micro`. The logo wordmark is part of the SVG asset;
  it is never set in Fraunces.
- **Semantic tokens:** components use `surface/paper/line/text/brand/accent`
  rather than raw scales. The console and kitchen are the same components
  under dark semantic themes.
- **DishArt:** the flat one-bowl illustration is replaced by a compositional
  system (plate shape, seeded pasta nest, sauce, toppings, garnish, steam).
  `DishMedia` swaps in real R2 photography when a product has one; the
  illustration is the permanent fallback.
- **Landing:** dark editorial hero, wheat marquee, asymmetric signature grid,
  dark craft band, paper visit section. The header uses the horizontal plaque;
  the footer uses the roundel. The oversized Fraunces wordmark was removed.
- **Two lockups, two jobs:** the horizontal plaque is header-only; the roundel
  is the primary mark on the footer, status pages, console, app icons and
  receipts. Never swap their surfaces.
- **OG/PWA:** the share card shows the roundel; the PWA uses PNG + maskable +
  monochrome icons and a branded offline page.
- **Never:** emoji as food, stock photos with watermarks, raw hex in
  components, colour as the only signal, or a retyped logo wordmark.
