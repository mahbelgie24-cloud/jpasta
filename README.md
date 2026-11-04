# JPasta — Fresh Pasta & Chicken

Digital menu, first-party ordering, and an owner console for **JPasta**
(Qalqilya) — fresh pasta cooked to order, house sauces made fresh daily, and a
lot of love.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 ·
Drizzle + Neon Postgres · **Cloudflare Workers** via
`@opennextjs/cloudflare` · R2 / D1 / Durable Objects · Arabic RTL first-class.

- Business spec: [`docs/technical-spec.md`](./docs/technical-spec.md) + §18 v2 delta
- Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Design system: [`docs/DESIGN.md`](./docs/DESIGN.md) · brand: [`docs/brand/brand.md`](./docs/brand/brand.md)
- Deploy runbook: [`docs/DEPLOY.md`](./docs/DEPLOY.md)
- Audit (2026-11-02, honest findings + fixes): [`docs/AUDIT-2026-11-02.md`](./docs/AUDIT-2026-11-02.md)
- **Latest audit (2026-11-04, production-readiness pass)**:
  [`docs/audit/04-production-readiness-2026-11-04.md`](./docs/audit/04-production-readiness-2026-11-04.md).
  Earlier passes: [`01` findings](./docs/audit/01-findings.md),
  [`00` baseline](./docs/audit/00-project-understanding.md),
  [`02` roadmap](./docs/audit/02-roadmap.md),
  [`03` report](./docs/audit/03-final-report.md)
- Menu photo prompts (18 dishes + logo prompt): [`docs/menu-photo-prompts.md`](./docs/menu-photo-prompts.md)
- Handoff: [`docs/HANDOFF.md`](./docs/HANDOFF.md) · next-session prompt: [`docs/NEXT-SESSION-PROMPT.md`](./docs/NEXT-SESSION-PROMPT.md)

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
- **123 tests** (unit + integration + hardening regressions) plus a
  **49-test Playwright suite** (`npm run test:e2e`): real journeys, axe
  a11y gate (serious/critical = fail) and visual regression at
  375/768/1440.
- **Lighthouse budgets** (`npm run test:lighthouse` / `:desktop`): **two
  honest gates**. Mobile (Lighthouse's default profile) has hard CWV/byte
  gates — LCP < 4.5s, CLS < 0.05, JS < 300KB, fonts < 250KB — while its
  performance score and TBT are tracked as warnings, because the mobile lab
  score is bounded by React App Router hydration (~74KB React DOM). Desktop
  proves the code itself is lean — performance ≥ 0.95, LCP < 1.5s,
  CLS < 0.02, TBT < 200ms. A controlled real-throttled mobile probe
  (1.6 Mbps/150ms/4× CPU) measured FCP 1.67s and LCP 2.07s; the old 98/100
  figure was the desktop preset and is superseded.
- **Settings-driven shop** (`/console/settings`): hours, minimum order,
  payment methods, the ordering flag, and the public shop name/phone/WhatsApp
  — owner-edited, live without a deploy; the money path enforces the minimum
  server-side on a fresh read, and Hero/Footer/Visit/MobileNav/receipt read
  the same settings.
- **Order archive & receipts** (`/console/orders`): local-day history with
  status/date filters, order/name/phone/item search, an 80mm printable
  receipt (settings-driven footer), and a per-order audit timeline.
- **Web Push** (`/console/settings`): per-device VAPID subscription, empty
  tickles on new orders, pending-count notification, no customer data in the
  push service. `npm run vapid` generates the key pair.
- **Accounting exports**: owner-only CSV for the day's orders and a Z summary
  (UTF-8 BOM for Excel Arabic), PII excluded by default, `pii=1` audited, and
  every cell guarded against CSV formula injection.
- **Console speed**: ⌘/Ctrl+K command palette, KDS swimlanes with a fullscreen
  wall mode, and quick-add for dishes with no options.
- **Operational hygiene**: `/api/health` reports version/uptime, server errors
  emit structured `onRequestError` lines, and a daily Cron prunes expired
  sessions/old login attempts without touching the order audit trail.
- **2026-11-04 hardening**: idempotent replay survives the ordering kill
  switch, cash-on-delivery is delivery-only, dine-in is console-only (spec
  §7), delivery-fee and inventory-cost changes are audited, archives export
  PII-free by default, the service worker caches dish media and never caches
  error pages, and CSV formula guards cover leading whitespace.
- **2026-11-04 production-readiness pass**: the login throttle now actually
  locks after the failure ladder (the previous reset made lockout dead
  code), manual console entry records the chosen payment method, the status
  page shows the real method instead of "cash on pickup", invalid status
  links return a real 404, public read actions carry a 240/min edge limit,
  backups can be AES-encrypted before upload, sessions are request-memoized,
  and the dependency set was upgraded (production audit stays at 0).
- **CI** runs three jobs on every push/PR: `verify` (the full gate +
  OpenNext bundle), `e2e` (Playwright against a fresh build + Postgres),
  and `lighthouse` (budget assertions).

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
`AUTH_PEPPER` and `REALTIME_SECRET` are required for production (32+ chars); `PII_ENCRYPTION_KEY` (64 hex chars) turns on field-level encryption of customer PII (spec §13)
**and for `next start`**, which runs in production mode — E2E needs them
locally too. Changing `AUTH_PEPPER` requires `npm run db:seed -- --provision`
to re-bind the owner credential.

## Scripts

```bash
npm run dev            # local Next
npm run build          # deploy gate (Next)
npm run build:cf       # OpenNext worker bundle
npm run preview        # local workerd
npm run deploy         # check-env → build → wrangler deploy
npm run typecheck      # next typegen + tsc
npm run lint
npm test               # vitest (123 tests)
npm run test:e2e       # build + Playwright: journeys, axe, visual (port 3220)
npm run test:lighthouse # LHCI budgets on / and /menu (set CHROME_PATH locally)
npm run icons          # regenerate favicon/PWA/OG from public/brand/logo*.svg
npm run vapid          # generate the optional Web Push key pair
npm run db:backup      # compressed logical backup (7-day retention)
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

Cron it daily; verify a restore into a scratch DB before trusting it. Set
`BACKUP_ENCRYPTION_KEY` (32+ chars) to have the script write an
OpenSSL-encrypted `.sql.gz.enc` before the dump is uploaded as a deploy
artifact.
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
