# Project Handoff — JPasta (2026-10-27)

Working handoff for the next agent/session. Read together with `AGENTS.md`,
`docs/technical-spec.md`, `docs/brand/brand.md`, and `README.md`. The
technical spec is canonical wherever anything conflicts.

## 1. Status at a glance

| Item              | State                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Repo              | `/home/max/Projects/jpasta` — git init on `main`, **nothing committed yet** (owner's call) |
| Phases delivered  | **0–4 complete + Phase 5 hardening core** (spec §15) — all DoD gates green                 |
| Working tree      | 24 untracked items — the entire platform. **Do not reset/clean.**                          |
| Tests             | **31/31 passing** (`npx vitest run`; sequential files — see vitest.config note)            |
| Gates             | format ✓ lint ✓ typecheck ✓ build ✓ (all green at handoff)                                 |
| Local server      | `next start -p 3220` (production build). Foreign Docker project owns `:3000` — never touch |
| Database          | Postgres 17 in dedicated Docker container **`jpasta-pg`** on `:54330` (fully isolated)     |
| Owner console PIN | `135790` (from `JPASTA_OWNER_PIN` in `.env.local`) · staff «سالم الكاشير» PIN `246810`     |
| Realtime          | SSE push, **~225ms commit→kitchen-DOM** (measured through the real browser path; DoD < 2s) |
| Source of truth   | `docs/technical-spec.md`; design decisions in `docs/brand/brand.md`                        |

## 2. What the project is

Digital menu + ordering + owner console for **JPasta — Fresh Pasta & Chicken**
(Qalqilya, Palestine). Fresh daily pasta; most sales are takeaway/delivery;
2 dine-in tables; the owner runs the business **from his phone**. Single
branch by explicit decision (no branches table). Currency ₪ ILS, all money
as **integer minor units (agorot)** — `lib/pricing.ts` is the only money
boundary and `parseFloat` on money is lint-banned.

Stack: Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 ·
Drizzle ORM · Postgres (local Docker; production target **Neon**) ·
production hosting target **Cloudflare Workers via @opennextjs/cloudflare** ·
Dexie offline queue · Vitest. Arabic RTL first-class.

## 3. Surfaces & what lives where

| Route                        | Purpose                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                          | Landing (brand, featured, hours/location, JSON-LD Restaurant schema)                                                                 |
| `/menu`                      | Customer ordering — DB-backed catalog (placeholder fallback), customization sheet, cart, **first-party submit** + WhatsApp secondary |
| `/order/status/[orderId]?t=` | Token-gated status page, auto-refresh 4s                                                                                             |
| `/console`                   | Orders board — SSE push + 5s fallback, advance/cancel (two-tap)                                                                      |
| `/console/login`             | PIN keypad login (owner + staff)                                                                                                     |
| `/console/kitchen`           | KDS — huge tickets, aging chips (5/10min → bronze/terracotta), chime                                                                 |
| `/console/new`               | Manual order entry (walk-in/phone), `source=console`                                                                                 |
| `/console/menu`              | Menu admin v1 — availability + price edits (audited)                                                                                 |
| `/console/inventory`         | Ingredients, purchase/waste/adjustment moves, recipe editor, low-stock                                                               |
| `/console/reports`           | Day summary, Z-cash view, 7-day bars, best sellers (owner-only)                                                                      |
| `/console/staff`             | Add/deactivate staff, PIN uniqueness enforced server-side                                                                            |
| `/console/settings`          | Delivery zones/fees (live, server-validated)                                                                                         |
| `/api/console/stream`        | SSE (session-cookie auth)                                                                                                            |

Key libs: `lib/server/orders.ts` (money-critical pipeline),
`lib/server/inventory.ts` (deduction + moves), `lib/server/reports.ts`,
`lib/server/session.ts` + `lib/server/pin.ts`, `lib/server/catalog.ts`,
`lib/server/bus.ts` (in-process event bus), `lib/offline/*` (Dexie queue),
`hooks/use-orders-feed.ts` (shared SSE+poll feed), `lib/alert.ts`.

## 4. Hard invariants (do not break)

1. **Idempotency**: every order write carries a client-generated
   `idempotencyKey` with a DB UNIQUE constraint; replays return the original
   order. `placeOrder` normalizes its input (zod defaults) — tests/scripts
   get the same behavior as the action.
2. **Server-recomputed prices**: clients send product/option KEYS only.
   Selections are revalidated against DB groups; the delivery fee comes from
   `delivery_zones` — never from the client.
3. **Notify AFTER commit**: `notifyOrdersChanged()` is called after the
   transaction returns, not inside it (notifying inside races the commit —
   measured 2.9s instead of 225ms).
4. **RBAC server-side**: `requireOwner()` at the top of every owner action
   and page; `getSessionUser()` for console surfaces. UI hiding links is
   never the boundary.
5. **Money**: integer agorot end-to-end; display only via
   `components/ui/price.tsx`.
6. **Audit trails**: `price_changes` on every price edit;
   `inventory_moves` on every stock change (reason + reference).
7. **Design tokens only** (`app/globals.css` `@theme`), fluid type tiers,
   RTL logical properties, 44px targets, `prefers-reduced-motion`.

## 5. Environment runbook

```bash
# database (dedicated container; isolated from every other project)
docker run -d --name jpasta-pg -e POSTGRES_USER=jpasta -e POSTGRES_PASSWORD=jpasta \
  -e POSTGRES_DB=jpasta -p 54330:5432 postgres:17-alpine
npm run db:migrate && npm run db:seed     # seed aborts on existing catalog (--force resets)

# showcase data (idempotent, fixed idempotency keys)
npx tsx --tsconfig scripts/tsconfig.json scripts/demo-order.mts
npx tsx --tsconfig scripts/tsconfig.json scripts/demo-inventory.mts

# quality gates (run all after any change)
npm run format:check && npm run lint && npm run typecheck && npm run build
npx vitest run                            # 31 tests; integration needs the seeded DB

# server
npm run build && npx next start -p 3220   # :3220 dedicated; NEVER :3000
curl -sI http://localhost:3220/menu | grep -i content-security-policy
```

Backups: `node scripts/backup-db.mjs` (gzip → `backups/`, 7-day retention,
prints the restore command — verify a restore into a scratch DB before
trusting it). Cron example in the script header.

**Gotchas learned the hard way:**

- Integration suites TRUNCATE orders in `beforeAll` — after a test run the
  board/status demo data is gone; re-run the demo scripts. Test files run
  sequentially (`fileParallelism: false`) because they share one DB.
- `tsx` needs `--tsconfig scripts/tsconfig.json` (maps `server-only` → stub
  and `@/*`).
- Playwright-style actionability checks are unreliable in the IAB pane —
  drive UI via `evaluate()` clicks when automating.
- `next start` must be restarted after every build; the compound
  `pkill … && start` pattern is flaky here — start it in its own call.

## 6. Verification evidence at handoff

| Check                | Result                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run`     | **31/31** — pricing boundary, 20-order DoD, idempotent replay, reports manual-count DoD, inventory 10-dish DoD, offline queue exact-once, CSP builder |
| End-to-end (browser) | order → DB → console board → advance → status page reflects: verified repeatedly; SSE latency **225ms** (commit 1793124893504 → DOM 1793124893729)    |
| CSP strict-dynamic   | landing + hydration + dialogs + cart work unchanged (browser-verified); headers on every response                                                     |
| Backup               | real dump produced (`backups/jpasta_*.sql.gz`) + retention + restore command                                                                          |
| Staff flows          | add + duplicate-PIN rejection verified in-browser                                                                                                     |
| Gates                | format/lint/typecheck/build all exit 0                                                                                                                |

## 7. Remaining work (priority order)

1. **Commit the tree** — five phases of work are uncommitted. Owner hasn't
   authorized it yet; it is the single most urgent protective action.
2. **Production deploy** (needs owner): Cloudflare account + Neon project,
   `@opennextjs/cloudflare` wiring, wrangler config, secrets (`DATABASE_URL`,
   `JPASTA_OWNER_PIN`, VAPID later), env validation script.
3. **Real menu + photos** (owner data — launch gate): replace the placeholder
   catalog via the console UI; photos to R2 (illustrations already implement
   the fallback path).
4. **Recipes for the real menu** — the inventory system is data-gated exactly
   like Ayasofia was; the editor is ready for the owner to fill.
5. **ASVS L2 mapping doc** (template exists in the Ayasofia repo), staging
   environment, restore rehearsal on production.
6. **One-week parallel run** — non-negotiable before cutover (spec §15).
7. Web Push (VAPID + subscriptions + SW push handler), loyalty, online
   payment research, delivery-platform intake — Phase 6.

## 8. Rules for the next session

- Spec is canonical; brand doc governs all visual choices. Do not re-litigate
  owner decisions (green/beige identity, no branches, cash-only payments,
  `tax_rate = 0` pending accountant, WhatsApp as secondary channel).
- One roadmap item at a time; verify, then ask.
- Read the local Next.js docs (`node_modules/next/dist/docs/`) before writing
  framework code — Proxy≠Middleware conventions, typegen-first typecheck.
- Keep the money/RBAC/idempotency/audit invariants (§4) intact in any change.
- Report real command output, never claims. Never start anything on `:3000`.

## 9. Open questions for the owner

1. VAT rate / e-invoicing obligations (accountant) — ships as `tax_rate = 0`.
2. Domain (jpasta.ps?) + Cloudflare account/plan + Neon project.
3. Real menu data (template: `docs/menu-template.json` planned; the console
   menu manager also accepts direct entry) + dish photography.
4. Thermal receipt printer model/connection (browser-print path works; the
   monochrome mark is ready in `public/brand/logo-mono.svg`).
5. Delivery zones beyond the flat placeholder fee.
