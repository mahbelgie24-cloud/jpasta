<!--
One roadmap phase item per PR (spec §15). Keep the diff reviewable.
-->

## What & why

<!-- What does this change, and which finding/phase does it close? -->

## Gates (paste real output)

- [ ] `npm run verify` — format / lint(0) / contrast / typecheck / vitest / build
- [ ] `npx playwright test` — journeys + axe + visual
- [ ] `npm run test:coverage` — coverage ratchet holds
- [ ] Docs updated (spec §, SECURITY.md if auth/money/PII adjacent)
- [ ] No `parseFloat` on money, no raw hex, no physical RTL properties

## Risk

<!-- What could this break? What did you check for regressions? -->
