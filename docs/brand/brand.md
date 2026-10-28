# JPasta — Brand Identity System

The implementation-ready source of truth for the visual identity. Tokens are
declared once in `app/globals.css` (`@theme`) and referenced everywhere —
never raw hex in components.

## 1. Brand Core

- **Name:** JPasta — جي باستا
- **Secondary line:** Fresh Pasta & Chicken
- **Tagline:** Fresh pasta made everyday. With a lot of Sauce and love
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

| Use                      | Family         | Weights         | Notes                                                  |
| ------------------------ | -------------- | --------------- | ------------------------------------------------------ |
| Arabic display + body    | **Alexandria** | 400/500/700/800 | `--font-arabic`; body 1.7 line-height, headings 1.25   |
| Latin display (wordmark) | **Fraunces**   | 600/700         | `--font-display`; "JPasta", big Latin numerals/accents |
| Prices / numeric data    | Alexandria     | 700             | `tabular-nums` — legibility where accuracy matters     |

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

The mark: a fork lifting a twirled pasta nest (spiral) with a basil leaf —
rounded strokes on a basil-800 rounded-square badge, cream pasta, one wheat
highlight strand.

- **Files:** `app/icon.svg` (badge mark / favicon), `public/brand/logo.svg`
  (full lockup), `public/brand/logo-mark.svg` (mark only),
  `public/brand/logo-mono.svg` (single-color print/receipt).
- **In-app rendering:** `components/brand/logo.tsx` — mark as inline SVG +
  wordmark as live text (Fraunces), so the wordmark always ships the real
  webfont and stays crisp at every size.
- **Clear space:** height of the "J" cap on all sides. **Minimum:** mark
  32px, lockup 120px wide.
- **Never:** recolor outside the palette, stretch, outline, or place the
  full-color mark on busy photos without a cream/green safe area.
- **Receipts:** `logo-mono.svg` (single-color basil-900 on white) — thermal
  printers are black-only.

## 6. Imagery

Real food photography is the Phase 1 target (R2-hosted). Until then — and as
the permanent empty-state — the **dish illustration system**
(`components/brand/dish-illustration.tsx`) renders stylized flat bowls with
per-dish sauce/topping variations from palette-adjacent food tones. Never
stock photos with watermarks; never emoji as food imagery.

## 7. Application by Surface

| Surface            | Priority                              | Brand expression                                                            |
| ------------------ | ------------------------------------- | --------------------------------------------------------------------------- |
| `/` landing        | Editorial, appetizing, brand-defining | Cream base, basil display type, wheat accents, illustration hero            |
| `/menu`            | One-hand ordering, zero friction      | Cream cards, basil pill CTAs, bottom sheets, sticky category nav            |
| `/console`         | Calm clarity under pressure           | Dark `theme-console`, big status colors, 44px+ targets, thumb-reach actions |
| `/console/kitchen` | Readable from two metres              | High-contrast `theme-kitchen`, huge type, aging escalation                  |
| Receipts/print     | Legibility                            | Monochrome mark, plain text, tabular figures                                |

## 8. v2 implementation notes (2026-10-28)

The identity is unchanged; the expression is sharper.

- **Display type:** **Amiri** for Arabic hero/section headings, paired with
  Alexandria for UI/body and Fraunces for Latin accents. The full ladder is
  `type-display` → `type-micro`.
- **Semantic tokens:** components use `surface/paper/line/text/brand/accent`
  rather than raw scales. The console and kitchen are the same components
  under dark semantic themes.
- **DishArt:** the flat one-bowl illustration is replaced by a compositional
  system (plate shape, seeded pasta nest, sauce, toppings, garnish, steam).
  `DishMedia` swaps in real R2 photography when a product has one; the
  illustration is the permanent fallback.
- **Landing:** dark editorial hero, wheat marquee, asymmetric signature grid,
  dark craft band, paper visit section, oversized wordmark.
- **OG/PWA:** the share card is drawn from the same art language (no emoji);
  the PWA uses PNG + maskable icons and a branded offline page.
- **Never:** emoji as food, stock photos with watermarks, raw hex in
  components, or colour as the only signal.
