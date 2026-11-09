# JPasta v2 — Professional Handoff

**Prepared:** 2026-10-28
**Repository:** `/home/max/Projects/jpasta`
**Commit:** `8faf333` — `feat: JPasta v2 — Cloudflare-native rebuild + Basil Atelier`
**Tag:** `v2.0.0`
**Working tree:** clean at `8faf333`; these handoff docs were added on top and
are intentionally left uncommitted until the owner reviews them.
**Status:** production-ready codebase, **not yet deployed** (infrastructure and owner data are the remaining gates)

> **2026-11-03 update (v2.3):** Wave 0 hardening closed the client-controlled
> order source, fail-open settings/PII/secrets, unauthenticated DO broadcast,
> destructive deploy tests, and the missing DB constraints. New in the same
> pass: Web Push (empty VAPID tickles), owner-only CSV/Z exports, the console
> command palette, KDS swimlanes + fullscreen, quick-add, server re-pricing of
> persisted carts, `/api/health` version/uptime, `onRequestError` logging, and
> a daily session/login-attempt prune. 104 unit/integration tests and 49 E2E
> journeys are green; real-device push and the owner's visual sign-off remain.

---

## 1. Executive summary

JPasta is a single-shop restaurant platform for **JPasta — Fresh Pasta & Chicken**
(Qalqilya, Palestine): a public Arabic-first storefront, first-party ordering,
a phone-first owner console, a kitchen display, reports, staff, settings, and
inventory.

v2 rebuilt the v1 platform in place:

- **Correctness/security first:** every P0 defect from the audit is closed and
  regression-tested.
- **Cloudflare-native runtime:** Durable Object realtime, R2 media + ISR cache,
  D1 tag cache, custom Worker entry, PWA.
- **Elite visual layer:** “Basil Atelier” design system, Amiri/Alexandria/Fraunces,
  the DishArt illustration system, dark editorial storefront, dark console and
  high-contrast KDS.
- **Deploy-ready:** `npm run verify`, `npm run build:cf`, and
  `npx wrangler deploy --dry-run` are green. Only account resources, secrets,
  recipes/ingredients, and owner sign-off remain.

**Read this whole file before changing code.** Then read, in order:

1. `AGENTS.md` — project rules and v2 invariants
2. `docs/technical-spec.md` — business spec; **§18 is the v2 delta and wins**
3. `docs/ARCHITECTURE.md` — runtime, order pipeline, realtime, caching, security
4. `docs/DESIGN.md` — design system and page language
5. `docs/SECURITY.md` — ASVS L2 mapping and threat model
6. `docs/DEPLOY.md` — the only supported production path
7. `docs/adr/*` — why OpenNext, why a DO, why the money invariants

---

## 2. Current state (verified)

| Item      | State                                                                                    |
| --------- | ---------------------------------------------------------------------------------------- |
| Framework | Next.js 16 App Router, React 19, TypeScript strict                                       |
| Styling   | Tailwind v4, OKLCH tokens, fluid type ladder                                             |
| Data      | Neon Postgres + Drizzle + Hyperdrive (Workers)                                           |
| Hosting   | Cloudflare Workers via `@opennextjs/cloudflare`                                          |
| Realtime  | `OrderFeed` Durable Object + hibernatable WebSockets                                     |
| Cache     | R2 incremental + regional + DO queue + D1 tag cache                                      |
| Media     | bundled `public/media/products/` WebP + R2 uploads + `DishArt` fallback                  |
| Auth      | PIN + PBKDF2 (WebCrypto) + HMAC lookup + DB throttle                                     |
| PWA       | `public/sw.js`, offline page, manifest, PNG/maskable icons                               |
| Tests     | **70/70** unit/integration + **44/44** E2E (`e2e/`, Playwright)                          |
| Gates     | format ✓ lint ✓ contrast ✓ typecheck ✓ tests ✓ e2e ✓ lhci ✓ build ✓ build:cf ✓ dry-run ✓ |
| CI        | three jobs on push/PR: `verify`, `e2e` (Playwright), `lighthouse` (LHCI budgets)         |
| Routes    | `/`, `/menu`, `/order/status/[id]`, `/privacy`, `/studio` (noindex), console suite       |
| Deploy    | `wrangler.jsonc` has `REPLACE_WITH_*` placeholders by design                             |

---

## 3. Product context (do not re-litigate)

- **Brand:** JPasta / جي باستا; green + beige; tagline
  “Fresh pasta, cooked to order. With a lot of sauce and love.”
- **Pasta sourcing:** bought fresh and cooked to order, **not** kneaded or
  produced in-house. Never use dough, daily-production, handmade, or “made
  today” claims; the craft story is selected fresh pasta, house sauces
  prepared fresh daily, and marinated chicken.
- **Location:** Qalqilya, next to Abu Ali Iyad school.
- **Hours:** daily 13:00 → 01:00 (crosses midnight; every day calculation must
  use `Asia/Hebron`).
- **Channels:** takeaway, delivery, dine-in (2 tables).
- **Payments:** cash / card terminal / cash on delivery. **No online gateway.**
- **Single branch.** No multi-tenancy, no branches table.
- **Owner operates from a phone.** Every console surface is mobile-first and
  one-hand operable.
- **No existing POS.** The console + kitchen display are the operating system.
- **Currency:** ₪ ILS, integer agorot everywhere.

---

## 4. Architecture at a glance

```
Browser
  ├─ Static assets ─────────────── Cloudflare CDN (ASSETS)
  └─ Worker: jpasta (worker.ts)
       ├─ /api/realtime (WS) ─────► OrderFeed Durable Object
       └─ OpenNext handler ──────► Next.js 16 App Router
                                     ├─ Server Actions
                                     ├─ RSC pages
                                     └─ lib/server (DAL)
                                            │
              ┌─────────────────────────────┼──────────────────────────┐
              ▼                             ▼                          ▼
        Hyperdrive → Neon PG          R2 (media + ISR)          D1 + DO (tags/queue)
```

**Key decisions and why**

| Decision               | Choice                             | Reason                                                   | Revisit?                                         |
| ---------------------- | ---------------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| Adapter                | OpenNext                           | Proven with the full cache stack + custom-worker DO path | Vinext spike after launch (`docs/adr/0001`)      |
| Database               | Neon + Hyperdrive                  | ACID for money; Cloudflare-supported pooling             | Keep                                             |
| Realtime               | Durable Object                     | Only correct cross-isolate fan-out; hibernation is cheap | Keep (`docs/adr/0002`)                           |
| PIN hash               | PBKDF2 210k via WebCrypto          | Workers-native; legacy scrypt still verifies             | Keep                                             |
| Cache                  | R2 + regional + DO queue + D1 tags | `revalidateTag` must propagate across isolates           | Keep                                             |
| Design                 | Amiri + Alexandria + Fraunces      | Editorial Arabic contrast with a geometric UI face       | Owner can swap to Reem Kufi via `/studio` review |
| PPR / Cache Components | **Not adopted yet**                | Correctness first; spike later                           | Yes, post-launch                                 |
| Payments               | Cash/card terminal only            | Owner decision                                           | Phase 6                                          |

---

## 5. The money path (must not regress)

`placeOrder` in `lib/server/orders.ts`:

1. zod parse (client sends product/option **keys only**)
2. `sha256(stableStringify(input))` → `payload_hash`
3. transaction:
   - replay by `idempotency_key`; if found, **payload hash must match**
   - load products + modifier groups/options from DB
   - recompute every line price from DB
   - delivery: validate `zone_id` (active) → fee from that zone
   - atomic `order_counters` upsert → `JP-YYMMDD-NNN`
   - insert order + items + `order_status_history` (`received`)
   - deduct recipes from stock in integer hundredths (floor at 0)
4. commit
5. `notifyOrdersChanged()` → DO → every console/kitchen screen

Hard invariants:

1. Money is integer agorot; `lib/pricing.ts` is the only boundary.
2. The client never sends a price.
3. Every order write has an idempotency key bound to its payload.
4. Delivery fee comes from the selected zone in the DB.
5. Authorization is server-side in every action; **await** guards.
6. Status changes are conditional (`WHERE status = expected`) and audited.
7. Business days use `Asia/Hebron`, never the process timezone.
8. Order numbers are gap-free per local day.
9. Stock never goes negative (`lib/domain/qty.ts`).
10. Realtime is a DO; notify after commit.
11. Bundled/R2 photos resolve through `DishMedia`; `DishArt` is the fallback — never a broken image.
12. Console uses `theme-console` / `theme-kitchen`; new code uses semantic tokens.

---

## 6. Surface map

| Route                          | Purpose                                                | Key files                                       |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------------------- |
| `/`                            | Dark editorial landing, signature dishes, craft, visit | `app/page.tsx`, `components/site/*`             |
| `/menu`                        | Search, categories, item sheet, cart, zone fees        | `app/menu/page.tsx`, `components/menu/*`        |
| `/order/status/[id]`           | Token-gated live status, price breakdown               | `app/order/status/**`                           |
| `/privacy`                     | Privacy policy                                         | `app/privacy/page.tsx`                          |
| `/studio`                      | Internal design gallery (noindex)                      | `app/studio/page.tsx`                           |
| `/console/login`               | PIN keypad + physical keyboard + throttle errors       | `app/console/login/*`                           |
| `/console`                     | Orders board (WS + polling fallback), advance/cancel   | `app/console/console-board.tsx`                 |
| `/console/kitchen`             | High-contrast KDS, aging, sound                        | `app/console/kitchen/*`                         |
| `/console/new`                 | Manual phone/walk-in entry with zone fee               | `app/console/new/*`                             |
| `/console/orders`              | Day archive: date/status/search, revenue summary       | `app/console/orders/page.tsx`                   |
| `/console/orders/[id]`         | Order detail + items + audit history                   | `app/console/orders/[orderId]/page.tsx`         |
| `/console/orders/[id]/receipt` | 80mm printable receipt (settings footer)               | `app/console/orders/[orderId]/receipt/page.tsx` |
| `/console/menu`                | Availability, price audit, R2 photo upload             | `app/console/menu/*`, `app/actions/media.ts`    |
| `/console/settings`            | Shop settings + delivery zones/fees (owner-only)       | `app/console/settings/*`                        |
| `/console/reports`             | Day/Z/best sellers/7-day series                        | `app/console/reports/*`                         |
| `/console/staff`               | Staff + PIN reset + session revoke                     | `app/console/staff/*`                           |
| `/console/inventory`           | Ingredients, moves, recipes, low stock                 | `app/console/inventory/*`                       |
| `/api/health`                  | DB readiness / uptime                                  | `app/api/health/route.ts`                       |
| `/api/realtime-token`          | 2-minute WS token                                      | `app/api/realtime-token/route.ts`               |
| `/api/media/[...key]`          | R2 media with immutable caching                        | `app/api/media/[...key]/route.ts`               |

---

## 7. Data model (v2 additions in bold)

```
users (id, name, role, pin_hash, **pin_lookup**, **session_version**, is_active)
sessions (token_hash, **user_version**, expires_at, **last_seen_at**)
**login_attempts (key, failed_count, locked_until)**
categories → products (**image_key/alt/width/height/color**, price, heat, badges)
modifier_groups → modifiers
orders (**payload_hash**, **zone_id**, **cancelled_reason**, totals, status, access_token)
order_items (snapshot name/detail/note/price/qty)
**order_status_history (from, to, actor, reason)**
**order_counters (day, last_number)**
delivery_zones (name, fee, sort_order, active)
settings (key/value; seeded, runtime-editable by owner)
ingredients / recipes / inventory_moves (**created_by**)
price_changes (audit)
**push_subscriptions (endpoint, p256dh, auth)**
```

Migration: `db/migrations/0002_tiresome_risque.sql` (safe backfills + CHECKs).
`db/seed.ts -- --provision` syncs owner/settings without touching the catalog.

---

## 8. Security posture

- **Sessions:** 32-byte opaque token, sha256 at rest, HttpOnly
  `__Host-jpasta_session` in production, 7-day absolute + 12-hour idle,
  `users.session_version` invalidation.
- **PIN:** PBKDF2-HMAC-SHA256 210k (WebCrypto), legacy scrypt verified and
  upgraded on login; HMAC `pin_lookup` UNIQUE; progressive DB lockout;
  Workers `AUTH_LIMIT`.
- **RBAC:** `requireOwner`/`requireStaff` in every restricted action/page.
  Settings is owner-gated in both page and actions.
- **CSP:** per-request nonce + `strict-dynamic` on dynamic routes; static tier
  with SRI. `base-uri 'none'`, `frame-ancestors 'none'`, same-origin WS only.
- **Uploads:** owner-only, MIME allowlist, 8 MB cap, generated R2 key.
- **ASVS L2 mapping:** `docs/SECURITY.md` (implementation-level, not an audit).

**AUTH_PEPPER rotation caveat:** it changes every `pin_lookup`. Rotating it
requires re-provisioning the owner PIN and resetting every staff PIN. Plan it.

---

## 9. Runbook

```bash
# 1. Local database (dedicated container, port 54330)
docker run -d --name jpasta-pg \
  -e POSTGRES_USER=jpasta -e POSTGRES_PASSWORD=jpasta \
  -e POSTGRES_DB=jpasta -p 54330:5432 postgres:17-alpine
npm run db:migrate
npm run db:seed                    # first install
npm run db:seed -- --provision     # after schema/settings changes

# 2. Development
npm run dev                        # http://localhost:3000

# 3. Production-like local
npm run build
npx next start -p 3220             # use 3220; never 3000

# 4. Full verification (the only acceptable gate)
npm run verify                     # format + lint + contrast + types + tests + build
npm run build:cf                   # OpenNext worker bundle
npx wrangler deploy --dry-run      # bundles worker.ts + lists bindings

# 5. Production deploy (owner credentials required)
#    Follow docs/DEPLOY.md exactly; replace wrangler placeholders first.
```

Environment matrix:

| Variable                             | Kind           | Notes                                                                                 |
| ------------------------------------ | -------------- | ------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`               | build-time     | canonical/OG/sitemap; must not be localhost in prod                                   |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`        | build-time     | digits only                                                                           |
| `DATABASE_URL`                       | secret/runtime | Node fallback; Workers use Hyperdrive                                                 |
| `JPASTA_OWNER_PIN`                   | secret         | 6 digits; provisioning only                                                           |
| `AUTH_PEPPER`                        | secret         | ≥32 chars; stable once users exist                                                    |
| `REALTIME_SECRET`                    | secret         | ≥32 chars; safe to rotate                                                             |
| `PII_ENCRYPTION_KEY`                 | secret         | 64 hex chars (32 bytes); required in production; rows written before it stay readable |
| `CRON_SECRET`                        | secret         | ≥32 chars; authorises `/api/cron/prune` (optional; route returns 503 without it)      |
| `VAPID_PRIVATE_KEY`                  | secret         | P-256 JWK JSON from `npm run vapid` (optional; disables push when absent)             |
| `VAPID_PUBLIC_KEY`                   | secret         | base64url P-256 public key from `npm run vapid`                                       |
| `VAPID_SUBJECT`                      | secret         | https:// or mailto: contact URI                                                       |
| `NEXT_PUBLIC_COMMIT_SHA`             | build-time     | reported by `/api/health`; set to `github.sha` in deploy                              |
| `ORDER_LIMIT` / `AUTH_LIMIT`         | binding        | `wrangler.jsonc`                                                                      |
| `ORDER_FEED` / `NEXT_CACHE_DO_QUEUE` | binding        | DO classes                                                                            |
| `MEDIA` / `NEXT_INC_CACHE_R2_BUCKET` | binding        | R2                                                                                    |
| `NEXT_TAG_CACHE_D1`                  | binding        | D1                                                                                    |
| `HYPERDRIVE`                         | binding        | Neon pooled URL                                                                       |

Local console PIN is `JPASTA_OWNER_PIN` from `.env.local` (currently `135790`
in the owner's local environment; never commit it).

---

## 10. Verification evidence at handoff

| Check                          | Result                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`               | exit 0                                                                                                                                                                                                                                                                                                                                                    |
| Tests                          | **70/70** (`domain`, `orders`, `orders-hardening`, `archive`, `inventory`, `reports`, `offline`, `pricing`, `security-headers`, `settings`, `pii`)                                                                                                                                                                                                        |
| E2E (`npm run test:e2e`)       | **44/44** — journeys (storefront order → status page; console PIN → board transitions → KDS), axe scans, keyboard-only + reduced-motion gates, 15 visual baselines                                                                                                                                                                                        |
| Lighthouse (`test:lighthouse`) | **mobile hard gates**: LCP < 4.5 s, CLS < 0.05, JS < 300 KB, fonts < 250 KB (performance/TBT are warnings: React-bound simulator). **Desktop hard budget**: perf ≥ 0.95, LCP < 1.5 s, CLS < 0.02, TBT < 200 ms. Controlled real-throttled mobile probe: FCP 1.67 s / LCP 2.07 s. The old 98/100 / ≤64 ms figure was the desktop preset and is superseded. |
| `npm run build`                | exit 0                                                                                                                                                                                                                                                                                                                                                    |
| `npm run build:cf`             | exit 0                                                                                                                                                                                                                                                                                                                                                    |
| `wrangler deploy --dry-run`    | exit 0; bindings listed (DO, R2, D1, Hyperdrive, Images, rate limits)                                                                                                                                                                                                                                                                                     |
| Route smoke                    | `/`, `/menu`, `/studio`, `/privacy`, `/console/login`, `/api/health`, `/manifest.webmanifest`, `/sw.js`, `/offline.html` → 200                                                                                                                                                                                                                            |
| Console auth                   | `/console` → **307** `/console/login` (proxy optimistic redirect)                                                                                                                                                                                                                                                                                         |
| Health                         | `{"ok":true,"db":"up","latencyMs":8}`                                                                                                                                                                                                                                                                                                                     |
| Owner credential               | PBKDF2 hash verifies; `pin_lookup` matches                                                                                                                                                                                                                                                                                                                |
| Contrast gate                  | all critical token pairs pass                                                                                                                                                                                                                                                                                                                             |
| Screenshots                    | captured at 1440/390; owner visual sign-off still required                                                                                                                                                                                                                                                                                                |

**Not yet done:** Lighthouse CI, real-device pass, production deploy, real
photography. (Playwright E2E, axe automation and visual baselines shipped
2026-10-28 — see §11.)

---

## 11. Remaining work (priority order)

### Owner / infrastructure (blocks go-live)

1. Create Neon project + pooled URL.
2. `wrangler hyperdrive create jpasta-pg …` → paste id.
3. Create `jpasta-media` + `jpasta-opennext-cache` R2 buckets.
4. `wrangler d1 create jpasta-tags` → paste id.
5. Set secrets: `DATABASE_URL`, `JPASTA_OWNER_PIN`, `AUTH_PEPPER`, `REALTIME_SECRET`.
6. `db:migrate` + `db:seed` on production.
7. Domain + `NEXT_PUBLIC_SITE_URL`; deploy; run `docs/DEPLOY.md` §5.
8. Real menu + bundled photos are seeded; recipes/ingredients and optional R2 replacements remain.
9. One-week parallel run before cutover.

### Engineering (can start now, no accounts)

1. ~~Playwright + axe + visual regression~~ **done (2026-10-28)**: `e2e/`
   covers storefront journeys, console auth/board/KDS, axe (serious/critical
   = fail) on the six public surfaces, and 12 visual baselines at
   375/768/1440. Run `npm run test:e2e`; baselines live in
   `e2e/visual.spec.ts-snapshots/` (regenerate with `--update-snapshots`
   after an intentional visual change — and commit them: the CI `e2e` job
   compares against the checked-in baselines).
2. ~~Lighthouse CI~~ **done (2026-10-28; corrected 2026-11-02)**:
   two explicitly labelled gates. `lighthouserc.json` runs the **mobile**
   profile with hard CWV/byte gates (LCP < 4.5 s, CLS < 0.05, JS < 300 KB,
   fonts < 250 KB) and warns on the React-bound performance/TBT score.
   `lighthouserc.desktop.json` proves the code is lean: performance ≥ 0.95,
   LCP < 1.5 s, CLS < 0.02, TBT < 200 ms. The original 98/100, LCP 1.06 s,
   TBT 64 ms figures were produced with the **desktop** preset — that was a
   mislabeled gate, not a mobile result.
   After the mobile correction the fonts were subsetted (Amiri 101 KB + 21 KB
   → one 64 KB file; Fraunces 37 KB → 34 KB; the shekel glyph no longer pulls
   the Latin-ext face) and the decorative SVG `feTurbulence`/grain layers were
   removed; a controlled real-throttled mobile probe measured FCP ≈ 1.7 s and
   LCP ≈ 2.1 s. TBT and the mobile simulator's LCP remain bounded by the
   React/App Router runtime (~74 KB React DOM).
3. ~~Settings-driven behaviour~~ **done (2026-10-28; extended 2026-11-02)**:
   `lib/server/settings.ts` (typed, per-key defensive parsing, cached with
   the `settings` tag) drives opening hours (`OpenStatus` everywhere), the
   storefront minimum order (enforced inside `placeOrder`, fresh read), the
   accepted payment methods (cart-drawer picker), the `ordering_enabled`
   master flag (ANDed with the catalog readiness on `/menu`), and the public
   shop name / phone / WhatsApp (Hero, Footer, Visit, MobileNav, receipt).
   The owner edits all of it under `/console/settings` — saved via
   `updateShopSettings` with `updateTag` (read-your-own-writes; this Next 16
   deprecates the one-argument `revalidateTag` inside Server Actions). It
   also surfaced a hard rule — see §12.16.
4. ~~Web Push~~ **done (2026-11-03)**: WebCrypto VAPID, per-device toggle in
   `/console/settings`, empty tickles on new orders, endpoint allowlist and
   automatic 404/410 pruning. Remaining: enable it on the owner's real phone.
5. ~~Console polish~~ **done (2026-11-03, KDS refresh 2026-11-08)**: KDS
   swimlanes, shared aging clock, sound toggle, fullscreen wall mode,
   ⌘/Ctrl+K command palette, server-re-priced cart. Remaining: an explicit
   offline badge in the console chrome.
6. ~~Order history page + receipt/print view~~ **done (2026-11-02)**:
   `/console/orders` (local-day archive, status filter, order/name/phone/item
   search, revenue summary), `/console/orders/[id]` (items + audit history +
   PII), and `/console/orders/[id]/receipt` (80mm print, settings footer).
7. **Cache Components / PPR spike** (after production stability).
8. **Vinext spike** (ADR 0001) — time-boxed, do not migrate mid-sprint.

### Nice-to-have

- **Inventory reversal on cancellation/undo is a deliberate business rule**:
  sales deduct recipe stock and a cancellation does not add it back — the
  kitchen may have consumed the ingredients. Owners adjust with a waste /
  adjustment move (audited). Revisit only if the owner wants _pre-preparation_
  cancellations to restock; that needs a status-based rule + a `return`
  reason + an undo re-deduct path.
- Loyalty/points, aggregated delivery platforms, PalPay research (Phase 6).
- Sentry/APM or Workers Logpush dashboard.

---

## 12. Known pitfalls (read before debugging)

1. **Integration tests TRUNCATE `orders`** in the configured DB. Never point
   `DATABASE_URL` at production when running `npm test`.
2. **`db:seed --force` truncates orders.** It is blocked only when
   `NODE_ENV=production`; be careful locally too.
3. **`next dev` / `next start` have no Durable Object.** Realtime falls back to
   polling; use `wrangler dev`/`npm run preview` for true WS verification.
4. **Local workerd + raw `pg` sockets are unreliable.** Production uses
   Hyperdrive. Contingency: `@neondatabase/serverless` (DEPLOY §8).
5. **OpenNext build warns** that the generated worker does not export the DOs.
   `wrangler` bundles `worker.ts` (which does). Verify with
   `npx wrangler deploy --dry-run`.
6. **`.open-next/worker.d.ts`** is generated by `scripts/ensure-opennext-stub.mjs`
   so `tsc`/`next build` work on a clean clone. Do not delete it from scripts.
7. **`AUTH_PEPPER` is not freely rotatable** (see §8).
8. **`NEXT_PUBLIC_*` are build-time.** Changing them requires a rebuild.
9. **`wrangler.jsonc` placeholders** block `npm run deploy` by design.
10. **Console colour bridge:** older console pages use primitive utilities;
    `.theme-console` maps them. New code must use semantic tokens.
11. **Arabic display font utility is `font-display-ar`** (Amiri); plain
    `font-display` is Fraunces (Latin only).
12. **`/studio` is public but noindex**; it is the design review surface.
13. **`next start` runs in production mode.** PIN login refuses without
    `AUTH_PEPPER` (spec §8.5 fail-closed) and `/api/realtime-token` needs
    `REALTIME_SECRET`; both must be in `.env.local`/`.dev.vars` for the E2E
    webServer. After changing the pepper, re-bind the credential with
    `npm run db:seed -- --provision` (staff PINs need a reset too).
14. **A stale `next-server` squatting on 3220** is silently reused by the
    Playwright `webServer` (`reuseExistingServer`) and serves the old build
    — kill it (`pkill -f next-server`) after building a changed tree.
15. **axe is a real gate now:** `e2e/a11y.spec.ts` fails on serious/critical
    violations. It already caught and fixed four real defects (aria-label on
    a bare span/div, a logo link whose accessible name omitted its visible
    text, a sub-AA Latin subtitle under menu category headings).
    16a. **E2E workers are capped at 4** (playwright.config.ts): the single
    `next start` fixture has a 5-client pool and a 210k-iteration PBKDF2 on
    every login — wider parallelism saturated it and turned login latency
    into flakes. `enterPin` also settles with a 30s budget for the same
    reason.
16. **Never query the shared pool inside an open transaction.** Inside
    `db.transaction(...)` use the `tx` handle only; anything reading through
    `db` queues on the same 5-client pool the transaction is holding. Five
    concurrent orders each awaiting an in-transaction `db` read deadlocked
    the reports DoD suite (10 s hook timeout, "Cannot use a pool after
    calling end"). `placeOrder` reads the minimum-order setting BEFORE it
    opens its transaction for exactly this reason — keep that shape.
17. **Font subsets live in `app/fonts/`.** `amiri-700-ar.woff2` keeps the
    Arabic shaping features and `fraunces-latin.woff2` the variable axis;
    regenerating them without `init/medi/fina/rlig` breaks Arabic shaping.
    See `app/fonts/README.md` and re-run the visual + a11y gates.
18. **Lighthouse has two gates.** `lighthouserc.json` (mobile) hard-gates
    LCP/CLS/JS/font bytes and warns on the React-bound performance/TBT score;
    `lighthouserc.desktop.json` hard-gates perf ≥ 0.95 / LCP < 1.5 s / TBT
    < 200 ms. The old 98/100 was the desktop preset. Host load materially
    changes the mobile simulator's numbers — run it on an idle machine.

---

## 13. Where to change what

| Need                            | File                                                                        |
| ------------------------------- | --------------------------------------------------------------------------- |
| Business constants/hours/phone  | `lib/site.ts`                                                               |
| Money conversion/formatting     | `lib/pricing.ts`                                                            |
| Business time/timezone          | `lib/domain/time.ts`                                                        |
| Stock arithmetic                | `lib/domain/qty.ts`                                                         |
| Order pipeline                  | `lib/server/orders.ts`                                                      |
| Delivery zones                  | `app/actions/settings.ts`                                                   |
| Shop settings (hours/min/flags) | `lib/server/settings.ts`, `app/console/settings/shop-settings-editor.tsx`   |
| Auth/session                    | `lib/server/session.ts`, `lib/server/pin.ts`, `lib/server/auth-throttle.ts` |
| RBAC wrappers                   | `lib/server/guard.ts`                                                       |
| Realtime server                 | `durable-objects/order-feed.ts`, `lib/server/order-feed.ts`                 |
| Realtime client                 | `hooks/use-orders-feed.ts`                                                  |
| Catalog read path               | `lib/server/catalog.ts`                                                     |
| Media upload/serve              | `app/actions/media.ts`, `app/api/media/[...key]/route.ts`                   |
| Design tokens/type              | `app/globals.css`                                                           |
| Dish art                        | `components/brand/dish-art.tsx`, `dish-media.tsx`                           |
| Storefront sections             | `components/site/*`                                                         |
| Cart/checkout                   | `components/menu/*`                                                         |
| Console shell/nav               | `app/console/layout.tsx`, `components/console/*`                            |
| DB schema/migrations            | `db/schema.ts`, `db/migrations/*`                                           |
| Deploy config                   | `wrangler.jsonc`, `open-next.config.ts`, `worker.ts`                        |
| Verification                    | `package.json` (`verify`), `.github/workflows/ci.yml`                       |

---

## 14. Definition of done for the next phase

- [ ] Production infra replaced, migrated, deployed, and verified per DEPLOY §5.
- [ ] Realtime ticket latency < 1 s on production WebSocket.
- [ ] Z report matches a manual count at 00:30 local.
- [ ] 20 consecutive production orders with exact totals and one idempotent replay.
- [ ] axe clean on `/`, `/menu`, `/console`, `/console/kitchen`
      (automated in `e2e/a11y.spec.ts`; also covers `/privacy`, `/console/login`).
- [ ] Lighthouse gates green: mobile hard (LCP < 4.5 s, CLS < 0.05,
      JS < 300 KB, fonts < 250 KB) and desktop (perf ≥ 0.95, LCP < 1.5 s,
      CLS < 0.02, TBT < 200 ms); mobile perf/TBT are warnings.
- [ ] Real menu + photos + recipes signed off by the owner.
- [ ] Backup restore rehearsed into a scratch database.
- [ ] One-week parallel run completed.
- [ ] `npm run verify` and `npm run build:cf` green after every change.

---

## 15. Handoff checklist

- [x] Code committed and tagged (`v2.0.0`), tree clean.
- [x] Spec, architecture, design, security, deploy, ADRs updated.
- [x] Migrations applied locally; seed/provision documented.
- [x] 104 tests + all gates green.
- [x] Cloudflare bundle + dry-run verified.
- [x] Owner credentials verified locally.
- [ ] Owner accounts/resources (see §11).
- [ ] Visual sign-off by the owner.
- [ ] Production deploy + parallel run.

---

_If anything here conflicts with `docs/technical-spec.md`, the spec wins.
If the spec is silent, prefer the simpler single-shop pattern with the lowest
operational overhead._
