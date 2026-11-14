# Contributing to JPasta

Thanks for helping build JPasta. This is a single-shop production system —
real orders, real money — so the rules below are strict on purpose.

## The non-negotiables

1. **Read `docs/technical-spec.md` first.** It is the canonical source of
   truth. `AGENTS.md` summarizes the hard rules; the spec wins conflicts.
2. **One roadmap phase item at a time** (spec §15). Finish, verify, review,
   commit — then ask before stretching scope.
3. **Money is integer agorot.** `lib/pricing.ts` is the only conversion
   boundary; `parseFloat` on money is lint-banned. Prices render only via
   `components/ui/price.tsx`.
4. **Every order write carries an `idempotencyKey`** (spec §9). Provenance
   (`source`) is a server argument, never client input.
5. **Authorization is server-side** in every action/route that touches
   restricted data — the UI hiding something is never the boundary.
6. **Design system discipline:** tokens from `app/globals.css` only (no raw
   hex), logical RTL properties only, ≥44px targets, `prefers-reduced-motion`
   respected. See `docs/brand/brand.md`.
7. **Content truth:** pasta is bought fresh and cooked to order. Never write
   dough-making / handmade / "made today" claims.

## Workflow

```bash
npm ci                 # also installs the lefthook pre-commit hooks
npm run db:migrate     # against the local test DB on :54330
npm run db:seed
npm run verify         # format + lint + contrast + typecheck + tests + build
npx playwright test    # journeys + axe + visual (needs the seeded DB)
```

- `npm run test:coverage` enforces the coverage ratchet on `lib/**`
  (thresholds in `vitest.config.mts` — raise them, never lower them).
- Pre-commit runs prettier + eslint on staged files; CI runs everything.
- Cross-browser smoke: `npx playwright test --project=firefox` runs locally;
  webkit additionally needs system deps once:
  `sudo npx playwright install-deps webkit`. CI installs all three browsers.
- Integration tests refuse a non-loopback `TEST_DATABASE_URL` and truncate
  tables — never point them at a real environment.

## Commit style

Conventional Commits (`feat:`, `fix:`, `perf:`, `test:`, `chore:`, …) with a
body that says **why**. Reference the audit/finding id when fixing one
(e.g. `SEC-18`).

## Reporting security issues

See `SECURITY.md`. Please do not open public issues for vulnerabilities.
