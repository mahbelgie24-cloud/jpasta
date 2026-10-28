# Project Handoff — JPasta v2 (2026-10-28)

Read with `AGENTS.md`, `docs/technical-spec.md` (§18 is the v2 delta),
`docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/DEPLOY.md`,
`docs/SECURITY.md`.

## 1. Status

| Item       | State                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Platform   | Next.js 16 + Cloudflare Workers (OpenNext), Neon + Hyperdrive                                     |
| Realtime   | Durable Object (`OrderFeed`) + hibernatable WebSockets                                            |
| Cache      | R2 incremental + regional + DO queue + D1 tag cache                                               |
| Tests      | **49/49** (unit, integration, hardening, domain)                                                  |
| Gates      | format ✓ lint ✓ typecheck ✓ build ✓ build:cf ✓                                                    |
| Console    | PIN login, dark theme, board, KDS, manual entry, menu+photos, settings, reports, staff, inventory |
| Storefront | dark editorial landing, live search, zone-aware cart, status page, PWA shell                      |
| Infra      | deploy-ready; placeholders must be replaced (docs/DEPLOY.md)                                      |

## 2. What changed vs v1

- All P0 defects fixed: awaited owner guard, DO realtime, PIN throttle,
  Asia/Hebron reports, customer-zone fees, conditional transitions,
  `order_seq` → `order_counters`, full cache stack, owner-only settings.
- New hardening: payload-bound idempotency, status history + undo,
  session versioning, DB CHECK constraints, stock floor in integer hundredths.
- New design system + DishArt + dark console + PWA + R2 photo pipeline.
- New tests: `domain.test.ts`, `orders-hardening.test.ts`.

## 3. Runbook

```bash
# DB (dedicated container)
docker run -d --name jpasta-pg \
  -e POSTGRES_USER=jpasta -e POSTGRES_PASSWORD=jpasta \
  -e POSTGRES_DB=jpasta -p 54330:5432 postgres:17-alpine
npm run db:migrate
npm run db:seed            # first time
npm run db:seed -- --provision  # schema/settings sync without touching the catalog

npm run dev                # local
npm run build && npx next start -p 3220

npm run format:check && npm run lint && npm run typecheck
npm test
npm run build && npm run build:cf
npx wrangler deploy --dry-run
```

## 4. Invariants (do not break)

1. Money = integer agorot, only `lib/pricing.ts`.
2. Client sends keys, never prices.
3. Idempotency key + payload hash.
4. Delivery fee = selected zone.
5. Server-side RBAC in every action; await guards.
6. Conditional, audited transitions.
7. `Asia/Hebron` business time.
8. Gap-free daily order numbers.
9. Stock never negative (integer hundredths).
10. Realtime via DO; notify after commit.
11. Photos fall back to DishArt.
12. Console uses semantic tokens / dark themes.

## 5. Remaining owner actions

1. Replace `REPLACE_WITH_*` in `wrangler.jsonc` (Hyperdrive, D1) and create
   R2 buckets (docs/DEPLOY.md §1).
2. Set secrets: `DATABASE_URL`, `JPASTA_OWNER_PIN`, `AUTH_PEPPER`,
   `REALTIME_SECRET`.
3. Real menu data + photography (upload from `/console/menu`).
4. Recipes/ingredients for stock control.
5. Domain decision + `NEXT_PUBLIC_SITE_URL` at build time.
6. One-week parallel run before cutover.

## 6. Known limitations

- `next dev` cannot run the real Durable Object; use `wrangler dev`/preview
  for realtime end-to-end.
- Local workerd + raw `pg` sockets are unreliable; production uses
  Hyperdrive. Contingency: `@neondatabase/serverless` (docs/DEPLOY.md §8).
- Web Push handlers exist; VAPID key provisioning + subscription UI is the
  remaining step.
- The console's older pages still use primitive colour utilities; the
  `theme-console` bridge maps them to semantic values. New code must use
  semantic tokens.
