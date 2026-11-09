# JPasta v2 — Design System «Basil Atelier»

> Implementation source of truth: `app/globals.css` (`@theme` + utilities).
> Brand rationale: `docs/brand/brand.md`. Preview: `/studio` (noindex).

## 1. Principles

1. **Paper and ink, not floating cards.** Warm cream base, hairline rules,
   rare warm shadows.
2. **Editorial contrast.** Huge display type, generous whitespace,
   asymmetric grids (5/7, 7/5).
3. **The food is the hero.** Large dish art/photography, real sauce colours,
   restrained steam.
4. **One colour leads.** Basil green for action and identity; copper/wheat
   for detail.
5. **Motion serves meaning.** Entrance, reveal, one ambient marquee. Nothing
   dances without a reason.
6. **Arabic first.** Correct shaping, zero letter-spacing, Latin digits for
   prices.

## 2. Colour

Two layers in `@theme`:

- **Primitive**: `basil-25…975`, `cream-50…500`, `wheat-300…600`,
  `copper-300…700`, food tones (`pistachio`, `tomato`), `ink`, status.
- **Semantic** (use these in components): `canvas`, `paper`, `paper-deep`,
  `surface`, `surface-raised`, `surface-sunken`, `line`, `line-strong`,
  `text-primary`, `text-secondary`, `brand`, `brand-strong`, `brand-deep`,
  `accent`, `success`, `warning`, `danger`, `focus`.

**Rules**

- No raw hex in components. Illustration colours come from tokens too.
- Status colour is never alone: icon + label.
- Dark surfaces use `theme-console` / `theme-kitchen` (same components,
  different semantic values).

## 3. Typography

| Role                          | Family                      | Weights                         |
| ----------------------------- | --------------------------- | ------------------------------- |
| Arabic display (hero/section) | **Amiri**                   | 400/700                         |
| UI + body                     | **Alexandria**              | 400/500/600/700/800             |
| Latin display accents         | **Fraunces**                | 600/700 — not the logo wordmark |
| Numerals                      | Alexandria + `tabular-nums` | —                               |

Fluid ladder (only these sizes on brand surfaces):

`type-display` · `type-hero` · `type-section` · `type-title` · `type-body` ·
`type-caption` · `type-micro`.

The kitchen display adds a dedicated two-metre scale — `type-kds-number`,
`type-kds-title`, `type-kds-item`, `type-kds-meta` — used only under
`.theme-kitchen`.

Arabic never gets letter-spacing. Latin display accents may.

## 4. Layout

- Container `--container-page: 1240px`, gutters
  `clamp(1rem, 4vw, 2.5rem)`.
- Section rhythm `--space-section: clamp(4.5rem, 9vw, 9rem)`.
- 12-column editorial grid; lead content spans differently from the rest.
- Full-bleed bands alternate cream / forest to create rhythm.
- The “semolina thread” hairline and grain texture are optional accents,
  never over text.

## 5. Shape, elevation, motion

- Radii: 8 / 12 / 16 / 24 / 32 / 40 / pill.
- Shadows: `shadow-card`, `shadow-lift`, `shadow-overlay` (warm tint), plus
  `shadow-inset` for raised paper.
- Easings: `--ease-out-expo` (entrances), `--ease-spring` (small
  interactions). Durations 150/220/550 ms.
- `prefers-reduced-motion` collapses everything globally.
- Native `<dialog>` for sheets (focus trap, Esc, inert) with a visible scrim.

## 6. DishArt

`components/brand/dish-art.tsx` is a compositional system, not one bowl:

- 3 plate shapes, deterministic pasta nest (seeded by product slug),
  6 sauce colours, topping motifs, basil garnish, steam, grain.
- Same product → same drawing. No two products look identical.
- `components/brand/dish-media.tsx` switches to a real R2 photo when present.
- The same art language feeds the OG image (no emoji).

## 7. Pages

- **/** — dark editorial hero, wheat marquee, asymmetric signature grid,
  dark craft band, paper visit section, horizontal plaque in the header and
  roundel in the footer.
- **/menu** — live open state, forgiving Arabic search, sticky category
  rail, large dish cards, native-form item sheet, 3-step cart with real zone
  fees.
- **/order/status** — live timeline, correct shop time, price breakdown,
  share/reorder.
- **/console** — dark, glare-free; persistent role-aware nav; board, KDS,
  manual entry, menu/photos, settings, reports, staff, inventory.
- **/console/kitchen** — high-contrast `theme-kitchen`, swimlane-ready
  tickets, aging escalation, shortcuts.

## 8. Accessibility bar (gates, not intentions)

- WCAG 2.2 AA; axe serious/critical = fail.
- Skip link, semantic landmarks, correct `aria-labelledby`.
- Every field has a visible label; errors are linked with
  `aria-invalid`/`aria-describedby`.
- Native radio/checkbox for choice groups (arrow keys work).
- Live regions for cart, order status and success.
- Targets ≥ 44×44 px; colour never carries meaning alone.
- Focus is never lost after navigation or dialog close.
- `scripts/check-contrast.mjs` computes AA ratios from tokens in CI.

## 9. Performance

- LCP < 2.0 s (hard fail 2.5 s), INP < 200 ms, CLS < 0.02 on `/` and `/menu`.
- Item sheets mount only while open (v1 shipped 18 hidden dialogs).
- Cart uses an external store to avoid re-rendering the whole menu.
- Fonts self-hosted via `next/font`; Amiri is display-only.
- Product media through `next/image`; illustrations are inline SVG.
- Skeletons mirror real shells; no layout shift.

## 10. Review checklist

Automated gates cover the mechanical parts — see `docs/DESIGN-REVIEW.md` for
the full evidence table: `npm run test:e2e` runs axe (serious/critical =
fail), keyboard-only journeys (skip link, dialog focus return), a
reduced-motion collapse gate, and pixel-compares 375/768/1440 baselines for
stable surfaces plus 375 baselines for the item sheet / cart drawer / order
status (`e2e/visual.spec.ts-snapshots/`). Physical directional classes are
banned by lint.

- [ ] Header uses the horizontal plaque; footer/status/console/icons use the
      roundel; no retyped wordmark; minimum sizes and clear space respected.
- [ ] 375 / 768 / 1440 screenshots reviewed.
- [ ] RTL logical properties only (`ms/me/ps/pe/start/end`).
- [ ] Keyboard-only pass (tab, arrows, Esc, Enter).
- [ ] Reduced-motion pass.
- [ ] axe clean.
- [ ] No raw hex, no ad-hoc type sizes, no sub-44 px targets.
