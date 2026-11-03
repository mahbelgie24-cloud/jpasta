# JPasta — Design Review & Sign-off Package

> Last updated: 2026-10-28. Preview surface: `/studio` (public, noindex).
> This is the checklist the owner reviews before visual sign-off
> (HANDOFF §15). Everything mechanical is automated and green; what remains
> for the owner is explicitly listed at the end.

## 1. What is enforced by machines (green today)

| Gate                                   | Where                                 | What it proves                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WCAG AA contrast, computed from tokens | `npm run check:contrast`              | No token pair ships below AA; not spot checks — all pairs                                                                                                                                                                                                                                                              |
| axe serious/critical = fail            | `e2e/a11y.spec.ts`                    | `/`, `/menu`, `/privacy`, `/console/login`, `/console`, `/console/kitchen`                                                                                                                                                                                                                                             |
| Keyboard-only journeys                 | `e2e/interaction.spec.ts`             | Skip link moves real focus (WCAG 2.4.1), `<dialog>` sheets trap focus and return it to the trigger, cart bar operable without a pointer                                                                                                                                                                                |
| `prefers-reduced-motion` collapse      | `e2e/motion.spec.ts`                  | Global 0.01ms collapse + `motion-reduce:animate-none` on the marquee, with a sanity run proving the gate can tell the difference                                                                                                                                                                                       |
| Pixel baselines, 375/768/1440          | `e2e/visual.spec.ts`                  | `/`, `/menu`, `/privacy`, `/console/login` full-page + item sheet / cart drawer / order status at 375 (15 baselines). Wall-clock elements (open chip, status timestamp) are masked; live-data surfaces (board, kitchen) are gated by axe + journeys because their content changes per second                           |
| Physical-RTL ban                       | `eslint.config.mjs`                   | `pl-/pr-/ml-/mr-`, `text-left/right`, `left-/right-`, `rounded-l/r/tl/…` fail lint; logical properties only (audited: zero legacy violations)                                                                                                                                                                          |
| Performance budgets                    | `lighthouserc.json` + `.desktop.json` | **mobile hard gates** (LCP < 4.5s, CLS < 0.05, JS < 300KB, fonts < 250KB; perf/TBT warnings) + **desktop hard budget** (perf ≥ 0.95, LCP < 1.5s, CLS < 0.02, TBT < 200ms). Controlled real-throttled mobile probe: FCP 1.67s / LCP 2.07s / CLS 0. The previous 98/100 figure was the desktop preset and is superseded. |

## 2. Design-system conformance notes

- **Tokens only.** Components use semantic tokens; the dark console and the
  kitchen read the same components through `.theme-console` /
  `.theme-kitchen` variable remapping (globals.css). Eight legacy console
  files still write primitive utility names (e.g. `bg-cream-50`) — the bridge
  remaps their rendered values, so output is coherent today; renaming them to
  semantic tokens is a tracked post-launch refactor (HANDOFF §11/§12.10),
  deliberately not churned right before launch.
- **Focus.** A global `:focus-visible` ring from the `focus` token covers
  every interactive element, including the console keypad and board buttons.
- **RTL.** Arabic-first with logical properties everywhere; the new lint rule
  keeps it that way. `dir="ltr"` islands (phone numbers, order numbers) are
  deliberate.
- **Imagery.** DishArt illustrations are the placeholder system until real
  photography lands (owner task) — never a broken image, never stock photos.
- **Type.** Fluid ladder only (`type-display … type-micro`), Amiri for Arabic
  display, Alexandria for UI/body, Fraunces for Latin accents, Arabic gets
  zero letter-spacing. The logo wordmark is part of the supplied SVG, never
  typeset.
- **Logo.** Two lockups, two jobs: `HeaderLogo` renders the wide rounded
  plaque in the sticky header only; `Logo`/`LogoMark` render the roundel on
  the footer, status pages, console, app icons and receipts.
  Favicon, Apple, PWA, maskable and monochrome icons come from
  `npm run icons`. Clear space and minimum sizes are in brand.md §5.

## 3. Fixed during this review (evidence the gates bite)

1. Skip-link targets were not focusable → `tabIndex={-1}` on all `<main>`s;
   focus now actually moves (keyboard spec).
2. Four axe serious violations (heat chip aria, PIN dots aria, logo link
   name mismatch, sub-AA category subtitle) — fixed in components.
3. Baselines added for the three interactive states customers touch most.

## 4. What the owner still owns (cannot be automated)

- [ ] **Visual sign-off** — walk `/` , `/menu`, `/studio`, a full order, and
      the console on a real phone. Aesthetics are the owner's call.
- [ ] **Logo sign-off** — confirm the horizontal header plaque at phone size,
      the roundel in the footer, the PWA icon and the mono receipt on a real
      device/printer.
- [ ] **Real-device pass** on a mid-range Android (owner runs the shop from
      a phone; emulators are not that device).
- [ ] **Real menu + photography** into R2 (DishArt stands in until then).
- [ ] Locked otherwise: green/beige, Amiri/Alexandria/Fraunces.
