# JPasta — Fresh Pasta & Chicken

Digital menu, first-party ordering, and an owner console for **JPasta**
(Qalqilya) — fresh pasta made every day, with a lot of sauce and love.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 ·
Drizzle + Neon Postgres · **Cloudflare Workers** via
`@opennextjs/cloudflare` · R2 / D1 / Durable Objects · Arabic RTL first-class.

- Business spec: [`docs/technical-spec.md`](./docs/technical-spec.md) + §18 v2 delta
- Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Design system: [`docs/DESIGN.md`](./docs/DESIGN.md) · brand: [`docs/brand/brand.md`](./docs/brand/brand.md)
- Deploy runbook: [`docs/DEPLOY.md`](./docs/DEPLOY.md)

## What shipped in v2

- **Correctness/security:** awaited owner guards everywhere, O(1) PIN login
  with a durable throttle, payload-bound idempotency, customer-zone delivery
  fees, conditional status transitions + audit history + owner undo,
  `Asia/Hebron` business days, gap-free daily order numbers, DB CHECK
  constraints.
- **Cloudflare-native runtime:** `OrderFeed` Durable Object with hibernatable
  WebSockets, R2 incremental cache + D1 tag cache + DO revalidation queue,
  custom worker entry, health endpoint, structured logs.
- **Elite UI:** “Basil Atelier” design system, Amiri/Alexandria/Fraunces
  typography, the DishArt illustration system, dark editorial landing, live
  menu search, real zone fees in the cart, dark console, PWA shell + offline
  page, photo upload to R2.
- **49 tests** (unit + integration + hardening regressions).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

Local database (dedicated container, port 54330):

```bash
docker run -d --name jpasta-pg \
  -e POSTGRES_USER=jpasta -e POSTGRES_PASSWORD=jpasta \
  -e POSTGRES_DB=jpasta -p 54330:5432 postgres:17-alpine
npm run db:migrate
npm run db:seed
```

Console PIN comes from `JPASTA_OWNER_PIN` in `.env.local`.
`AUTH_PEPPER` and `REALTIME_SECRET` are required for production (32+ chars).

## Scripts

```bash
npm run dev            # local Next
npm run build          # deploy gate (Next)
npm run build:cf       # OpenNext worker bundle
npm run preview        # local workerd
npm run deploy         # check-env → build → wrangler deploy
npm run typecheck      # next typegen + tsc
npm run lint
npm test               # vitest (49 tests)
npm run icons          # regenerate PWA icons from app/icon.svg
```

Quality gates:
`npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`.

## Structure

```
app/                 routes + server actions
  api/               health, realtime-token, media
  console/           dark owner console (+ kitchen)
  menu/              customer ordering
components/
  brand/             logo, DishArt, DishMedia
  site/              landing sections, nav
  menu/              cart, item sheet, product card
  console/           board, nav, chrome
  ui/                primitives
db/                  schema + migrations + seed
durable-objects/     OrderFeed
lib/domain/          pure rules (time, qty, hash, realtime tokens)
lib/server/          data access + guards + orders + realtime
worker.ts            custom Cloudflare entry
```

## Hard invariants

1. Money is integer agorot; `lib/pricing.ts` is the only boundary.
2. The client never sends a price.
3. Every order write has an idempotency key bound to its payload.
4. Delivery fees come from the selected zone in the DB.
5. Authorization is server-side in every action; unawaited guards are bugs.
6. Status changes are conditional and audited.
7. Business days use `Asia/Hebron`, never the process timezone.
8. Design tokens only; RTL logical properties; 44px targets; reduced motion.

## Backups & security

```bash
node scripts/backup-db.mjs   # compressed dump → backups/ (7-day retention)
```

Cron it daily; verify a restore into a scratch DB before trusting it.
Security posture: nonce CSP (`strict-dynamic`) via `proxy.ts`, static
hardening headers in `next.config.ts`, and the ASVS 5.0 L2 mapping in
[`docs/SECURITY.md`](./docs/SECURITY.md).

## Deploying

Production target: **Cloudflare Workers + Neon**. Full runbook:
[`docs/DEPLOY.md`](./docs/DEPLOY.md). Quick reference:

```bash
npm run build:cf   # OpenNext worker bundle (no account needed)
npm run preview    # local workerd via wrangler dev
npm run deploy     # check-env → build → wrangler deploy
```
