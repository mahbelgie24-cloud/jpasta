# JPasta — Fresh Pasta & Chicken

Digital menu, ordering, and owner console for **JPasta** (Qalqilya) — fresh
pasta made everyday, with a lot of sauce and love.

Full specification: [`docs/technical-spec.md`](./docs/technical-spec.md) —
read it before touching the code. Brand system:
[`docs/brand/brand.md`](./docs/brand/brand.md).

## Stack

Next.js 16 (App Router) · TypeScript strict · React 19 · Tailwind CSS v4 ·
Arabic RTL first-class · production target: **Cloudflare Workers** via
`@opennextjs/cloudflare` (Phase 1) + Neon Postgres + Drizzle.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real values, never commit this file
npm run dev
```

## Quality gates

```bash
npm run format:check   # prettier
npm run lint           # eslint (money-arithmetic rule enforced)
npm run typecheck      # next typegen + tsc --noEmit
npm run build          # deploy gate
```

## Structure

```
app/                  Routes: / (landing), /menu (order), /privacy, /api (Phase 1)
components/brand/     Logo + dish illustration system
components/site/      Landing sections
components/menu/      Digital menu: cart, item sheet, drawer (WhatsApp handoff)
components/ui/        Primitives (button, sheet, price, stepper…)
lib/                  pricing (money boundary), menu-data (placeholder catalog),
                      whatsapp, site constants
docs/                 Spec, brand guide, menu template
```

## Status — Phase 1 (order pipeline live)

- [x] Spec + brand identity + logo
- [x] Design system + landing page
- [x] Digital menu with customization + cart (placeholder catalog, DB-backed)
- [x] **First-party order intake** — server-recomputed prices, idempotency
      keys, sequential order numbers (JP-00001…), token-gated status page
- [x] **Owner console** (`/console`) — PIN login, live orders board
      (SSE push ~225ms + 5s poll fallback), status transitions with
      server-side RBAC
- [x] **Kitchen display** (`/console/kitchen`) — big tickets, aging chips,
      tap-to-advance, new-order chime
- [x] **Delivery zones admin** (`/console/settings`) — live fee editing
- [x] **Offline queue** — failed submits replay exactly-once on reconnect
- [x] Test suite: money-boundary unit tests + integration suite including
      the 20-consecutive-orders DoD gate + offline-queue tests (`npm test`)
- [x] **Reports** — day summary, Z-cash view, 7-day bars, best sellers
      (DoD: report matches manual count exactly — integration-proven)
- [x] **Staff accounts** — PIN uniqueness enforced, role-gated surfaces
- [x] **Manual order entry** + **menu manager v1** (audited price changes)
- [x] **Inventory & recipes** — automatic deduction on sale (audited moves),
      purchase/waste/adjustment log, low-stock alerts, recipe editor
- [x] **Hardening** — nonce CSP + strict-dynamic (browser-verified),
      static security headers, backup script with retention
- [ ] Next: production deploy (Cloudflare + Neon), real menu + photos,
      Web Push, one-week parallel run (spec §15 Phase 5)

### Backups & security

```bash
node scripts/backup-db.mjs   # compressed dump → backups/ (7-day retention)
```

Cron it daily; verify a restore into a scratch DB before trusting it.
Security posture: nonce CSP (strict-dynamic) via proxy + static hardening
headers — see `lib/csp-nonce.ts` and next.config.

### Local database

```bash
# dedicated container (port 54330 — fully isolated from any other project)
docker run -d --name jpasta-pg -e POSTGRES_USER=jpasta -e POSTGRES_PASSWORD=jpasta \
  -e POSTGRES_DB=jpasta -p 54330:5432 postgres:17-alpine
npm run db:migrate && npm run db:seed   # seed aborts on an existing catalog (--force resets)
npx vitest run                          # unit + integration (needs the seeded DB)
```

Console PIN comes from `JPASTA_OWNER_PIN` in `.env.local` (seeded owner account).

See spec §15 for the phased roadmap with Definition of Done.
