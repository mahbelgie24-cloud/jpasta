# Technical & Product Specification

## JPasta — Fresh Pasta & Chicken — Digital Menu, Ordering & Owner Console

|                      |                                                                                   |
| -------------------- | --------------------------------------------------------------------------------- |
| **Version**          | 1.0                                                                               |
| **Date**             | October 27, 2026                                                                  |
| **Status**           | Approved baseline (owner decisions embedded) — Phase 0 in execution               |
| **Primary audience** | The owner (decision maker), plus AI coding agents as execution context            |
| **Predecessor**      | Ayasofia Sweet platform — proven patterns inherited, failures corrected (see §17) |

---

## 1. Business Profile

| Field                | Value                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| **Brand name**       | JPasta — جي باستا                                                                      |
| **Secondary line**   | Fresh Pasta & Chicken                                                                  |
| **Tagline**          | "Fresh pasta made everyday. With a lot of Sauce and love"                              |
| **Concept**          | Fresh daily-made pasta with house sauces and fresh chicken — casual, appetizing, young |
| **Phone / WhatsApp** | 0566064976 (+970 56 606 4976)                                                          |
| **Address**          | بجانب مدرسة أبو علي اياد — قلقيلية، فلسطين                                             |
| **Hours**            | Daily 1:00 PM – 1:00 AM (crosses midnight — every time computation must handle this)   |
| **Service channels** | Takeaway (primary), Delivery (primary), Dine-in (2 tables only)                        |
| **Audience**         | City residents and visitors, all ages, skewing young — mobile-first, social-native     |
| **Currency**         | ₪ ILS (agorot minor units)                                                             |

**Operating reality (owner-confirmed):** there is **no existing POS system**. The
owner will run the business **from his mobile phone**. Every staff-facing
surface must therefore be **mobile-first**, one-hand operable, and fast on
mid-range Android devices — not adapted-from-desktop.

**Branch posture:** single location, new shop, **no branches planned**. The
schema is deliberately single-branch (simpler than Ayasofia's); if expansion
ever happens, it will be a planned migration, not an embedded abstraction.

---

## 2. Engineering Philosophy

1. **Correctly-sized, not maximally complex.** A single-shop, owner-run
   business gets a modular single-app architecture. No microservices, no
   premature multi-tenancy, no distributed complexity. (Inherited from
   Ayasofia §2 — it was right, and it stays.)
2. **Real money, real stock.** Data integrity and auditability outrank visual
   polish when they conflict. Every order write is idempotent; every money
   value is an integer.
3. **Design is a first-class requirement, not a phase.** The owner has
   explicitly made UI/UX the project's defining bar. Design review is a gate
   on every user-facing merge, with the same seriousness as tests.
4. **Data before go-live.** The Ayasofia lesson (§17): the code can be
   launch-ready while the _data_ blocks the launch. Real menu completeness is
   tracked as a launch gate from day one.

---

## 3. Goals and Non-Goals

**Goals**

- A beautiful, fast, mobile-first **digital menu + ordering** surface that
  makes the owner proud to share it (QR on the counter, link on Instagram).
- **WhatsApp order handoff in v0** (the shop's real ordering behavior today),
  graduating to **first-party order capture** (database + owner console) in
  Phase 1 — so no order is ever lost to a chat scroll-back.
- An **owner console** (phone-first) to receive, track and advance orders:
  the KDS is the owner's phone or a cheap tablet, not dedicated hardware.
- Takeaway/delivery/dine-in channels with delivery fee and zone rules that
  the owner can configure himself — no code deploy for operational changes.
- Daily reporting the owner actually opens: orders, revenue, best sellers.
- Inventory & recipes (Phase 4): fresh pasta is produced daily; ingredient
  tracking protects both cost control and "fresh" claims.

**Explicit Non-Goals (v1)**

- No multi-branch support (§1 posture).
- No online payment gateway (cash, card terminal, cash-on-delivery only; a
  payment-provider abstraction is kept so PalPay/others can plug in later).
- No native mobile app — PWA covers it.
- No drive-thru channel, no Wi-Fi captive portal (not part of this business).
- No loyalty engine in v1 (strong Phase 6 candidate; the schema will not
  prevent it).

---

## 4. Architecture Decision

**Pattern:** Modular Monolith — one Next.js application with internally
bounded modules (storefront, ordering, owner console, catalog). Same
philosophy as Ayasofia §4.

**Platform: Cloudflare — this is the material change from Ayasofia.**

| Concern        | Decision                                                                                | Rationale                                                                                                |
| -------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Hosting        | **Cloudflare Workers** via `@opennextjs/cloudflare`                                     | Owner requirement. Free tier is generous; global edge is minutes from Qalqilya's users                   |
| Database       | **PostgreSQL (Neon)** + **Drizzle ORM**, pooled via Neon serverless driver / Hyperdrive | Postgres ACID + RLS-class rigor for money; Neon is serverless and Workers-native; no Supabase dependency |
| Realtime       | **Durable Objects + WebSocket** (KDS/order-status push)                                 | Cloudflare-native replacement for Supabase Realtime; WebSocket hibernation keeps it free-tier friendly   |
| Storage/images | **Cloudflare R2** (zero egress) + Workers Image Resizing                                | Menu photos live in R2, resized at the edge                                                              |
| Cache          | Workers Cache API + KV (catalog, flags)                                                 | In-process cache made global                                                                             |
| Rate limiting  | **Workers native rate limiting binding** (+ DO fallback)                                | No limiter table needed; the durable-limiter work from Ayasofia maps onto platform primitives            |
| Auth           | **Better Auth** (self-hosted, DB sessions) + custom PIN factor                          | Never hand-roll full auth; Better Auth is the 2026 standard for TS stacks, Workers-compatible            |
| Email/notify   | Phase-gated: Web Push first (owner console), WhatsApp deep links always                 | Zero-dependency notification path                                                                        |
| Monitoring     | **Sentry** (Workers SDK) + Cloudflare Web Analytics + self-hosted Web Vitals sink       | Same observability posture as Ayasofia, without Vercel coupling                                          |

**Why not D1 (SQLite)?** D1 lacks RLS-class policy enforcement and exact
numeric semantics. Money handling is cleaner on Postgres. Neon's scale-to-zero
and HTTP driver fit Workers without connection-pool friction.

**Entry surfaces:**

- `/` — public landing (brand, story, hours, location, featured dishes, SEO/JSON-LD)
- `/menu` — customer digital menu + ordering (no login; Arabic RTL first-class)
- `/order/status/[orderId]` — token-gated order status (Phase 1+)
- `/console` — owner console (auth): live orders, menu manager, settings, reports
- `/console/kitchen` — KDS view (owner's phone/tablet)
- `/api/*` — health, vitals sink, order intake (Phase 1+)

---

## 5. Technology Stack

| Layer       | Choice                                                     | Rationale                                                                                       |
| ----------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Language    | TypeScript strict (`noUncheckedIndexedAccess`)             | Silent money errors are structurally prevented, not reviewed away                               |
| Framework   | **Next.js 16 (App Router)** + React 19                     | Best-documented React framework materially improves agent output quality; team expertise exists |
| UI          | **Tailwind CSS v4** + hand-rolled accessible primitives    | Full control of the design system; native `<dialog>`-based sheets; zero component-library bloat |
| Data access | Drizzle ORM + drizzle-zod                                  | SQL-transparent, typed; zod schemas generated from tables                                       |
| Validation  | Zod 4                                                      | One schema language across actions and forms                                                    |
| Offline     | Service Worker + **Dexie** (Phase 2, console POS)          | The owner's phone must keep taking orders through a signal drop                                 |
| Testing     | **Vitest 4** + **Playwright** (+ axe, + visual regression) | Money/stock logic is unit-gated; UX is E2E- and screenshot-gated                                |
| Fonts       | `next/font` self-hosted (Alexandria, Fraunces)             | Zero external font requests; zero CLS                                                           |
| Lint/format | ESLint (next core-web-vitals + TS) + Prettier              | Proven on the exact framework version; money-arithmetic rule enforced in lint                   |
| CI/CD       | GitHub Actions → `wrangler deploy` (preview + prod)        | Cloudflare-native pipelines; previews per PR                                                    |

---

## 6. Standards & Compliance Baseline

Named so "best practice" is verifiable:

- **Accessibility:** WCAG 2.2 AA. Touch targets ≥ 44×44px on every interactive
  element (the console is used under time pressure). axe-core in CI (serious +
  critical = fail). Color never carries meaning alone.
- **Security:** OWASP ASVS 5.0 **L2** mapping maintained from Phase 1 (the
  Ayasofia mapping doc is the template). Authorization enforced **server-side
  in every action**; the UI is never the gate. Secrets only in environment
  variables / Wrangler secrets. SBOM (CycloneDX) generated per release.
- **Performance:** Core Web Vitals budgets as CI gates on `/` and `/menu`:
  LCP < 2.0s (target; hard fail 2.5s), INP < 200ms, CLS < 0.02 (hard fail
  0.1). First Load JS budget per route, asserted in CI.
- **i18n:** Arabic RTL native (`dir="rtl"`, logical properties everywhere).
  English is a structured second locale via `next-intl` (Phase 1) — the brand
  line and product names are bilingual from day one.
- **Money representation (upgrade over Ayasofia):** all money is stored as
  **integer minor units (agorot) in INTEGER/BIGINT columns**. No
  numeric-as-string parsing anywhere in application code; `lib/pricing.ts`
  is the single conversion/formatting boundary. No JS float ever touches a
  price.
- **Versioning:** SemVer releases, Conventional Commits (commitlint),
  protected `main`, required CI checks.

---

## 7. Order Channels

| Channel  | Entry point                                      | Notes                                                                                  |
| -------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Takeaway | `/menu` (customer) or `/console` (owner-entered) | Primary channel today                                                                  |
| Delivery | `/menu` (customer) or `/console`                 | Address + zone-based fee (settings-driven, server-computed); cash on delivery          |
| Dine-in  | `/console` (owner-entered)                       | 2 tables; no table-QR system — overkill at this scale                                  |
| WhatsApp | `/menu` cart → wa.me handoff (v0)                | Graduates to first-party capture in Phase 1; WhatsApp stays as a share/receipt channel |

---

## 8. System Modules

### 8.1 Storefront (`/` + `/menu`)

Landing with brand story, featured dishes, hours/location, WhatsApp CTA.
Menu: category navigation, product cards, pasta-accurate customization sheet,
cart drawer, order placement (v0: WhatsApp handoff; Phase 1: first-party).
Mobile-first, one-hand reach: primary actions live in the bottom third.

### 8.2 Owner Console (`/console`) — phone-first

- **Orders board:** live incoming orders (WebSocket via Durable Objects),
  status advance (received → preparing → ready → completed), cancel with
  reason. Large targets, no dialogs for primary flows.
- **Manual order entry:** walk-in/delivery phone orders with the same cart
  components as the storefront.
- **Menu manager:** categories, products, prices, availability toggles,
  modifier groups (pasta-accurate), description/badge editing.
- **Settings:** hours, delivery zones/fees, payment methods, receipt footer,
  feature flags. Everything settings-driven changes behavior without deploys.
- **Reports (Phase 3):** today/this week revenue, order count, best sellers,
  simple margin view (requires recipes). Z-style cash summary.

### 8.3 KDS (`/console/kitchen`)

Live ticket board, huge type, elapsed-time chips, channel tags (🛍 Takeaway /
🛵 Delivery / 🍽 Table), audible new-order alert. Runs on any browser; same
data path as the orders board.

### 8.4 Catalog & Content

Placeholder catalog (beautiful, realistic, owner-reviewable) is seeded in
Phase 0 and **replaced by the real menu via the admin UI or a JSON ingest**
(`docs/menu-template.json` + ingest script, Phase 1). Photos go to R2 with
generated illustrations as the fallback placeholder — never a broken image.

### 8.5 Identity & Access

**Phase 1 (shipped):** a single owner signs in with a 6-digit PIN. Sessions
are DB-backed opaque tokens (sha256-hashed at rest) in HttpOnly cookies;
PINs are scrypt-hashed with a per-user salt and compared constant-time
(`lib/server/pin.ts`). Deliberately sized to this business — **Better Auth is
re-evaluated in Phase 3** when staff accounts and multiple credentials land;
the session layer is isolated in `lib/server/session.ts` for that swap.
Roles: `owner` and `staff` (staff management in Phase 3). Every console
action re-checks the session server-side.

---

## 9. Data Model (Core Entities)

Money columns: `INTEGER` minor units (agorot). Timestamps: `timestamptz`.

```
users             (id, email, password_hash, name, role[owner|staff], pin_hash, active)
sessions          (Better Auth managed)
categories        (id, slug, name_ar, name_en, sort_order, is_active)
products          (id, category_id, name_ar, name_en, description_ar, base_price_minor,
                   image_r2_key, is_available, is_featured, heat_level, track_inventory)
modifier_groups   (id, product_id, name_ar, type[single|multi], is_required, max_selections)
modifiers         (id, group_id, name_ar, price_delta_minor, ingredient_id, ingredient_qty)
orders            (id, order_number, channel[takeaway|delivery|dine_in], status,
                   customer_name, customer_phone, address, zone_id, subtotal_minor,
                   delivery_fee_minor, discount_minor, total_minor, payment_method,
                   source[storefront|console|whatsapp], idempotency_key UNIQUE,
                   access_token UNIQUE, created_at)
order_items       (id, order_id, product_id, product_name_ar, selected_modifiers jsonb,
                   notes, quantity, unit_price_minor, line_total_minor)
delivery_zones    (id, name_ar, fee_minor, is_active)          -- settings-driven
ingredients       (id, name, unit, current_stock_qty, reorder_threshold, cost_per_unit_minor)
recipes           (product_id, ingredient_id, quantity_used)
inventory_moves   (id, ingredient_id, delta_qty, reason[sale|purchase|waste|adjustment],
                   ref_order_id, created_by, notes, created_at)
price_changes     (id, entity_type, entity_id, old_minor, new_minor, changed_by, created_at)
settings          (key, value)  -- hours, tax_rate(0 today), receipt_footer, flags, phone
```

Every order is fully reconstructable; every price change leaves an audit row;
every stock movement carries a reason. (Inherited invariant — it made
Ayasofia auditable.)

---

## 10. Product & Modifier System — Pasta-Accurate

The modifier model mirrors how pasta is actually ordered, per-product:

| Modifier group | Type          | Options (typical)                                             |
| -------------- | ------------- | ------------------------------------------------------------- |
| **Size**       | Single        | فردي Regular / كبير Large (+Δ price)                          |
| **Sauce**      | Single        | where a dish offers a choice (e.g. pink / alfredo / marinara) |
| **Extras**     | Multi, priced | دجاج مشوي، فطر، بارميزان إضافي، خبز ثوم، صلصة إضافية          |
| **Heat level** | Single, +0    | بدون حار / وسط / حار 🔥                                       |
| **Doneness**   | Single, +0    | al dente / مطبوخ أكثر (default al dente; kitchen note)        |

Desserts/drinks define only the groups they need. The builder enforces
required groups client-side **and** server-side (Phase 1); multi-group caps
(`max_selections`) are validated on the server. Line notes (free text) are
length-capped.

---

## 11. Brand Identity System

Derived from the owner's direction: **green + beige**, professional,
captivating, elite-tier. Full system in `docs/brand/brand.md`; tokens live in
`app/globals.css` (`@theme`) as the single source of truth.

### 11.1 Palette

| Token family      | Role                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `basil-50 … 950`  | Brand green scale. `basil-700` primary actions; `basil-800/900/950` dark surfaces & footer; `basil-950`-tinted `ink` for text |
| `cream-50 … 500`  | Warm beige neutrals. `cream-50` page base, `cream-100` cards, `cream-300` borders                                             |
| `wheat-300 … 600` | Wheat-gold accent (pasta/semolina). **Decorative/large display only** — fails AA on cream as body text                        |
| Status            | `terracotta` error (never brand-green), `bronze` warning — always paired with icon + label                                    |

**Why green ≠ success-color conflict:** brand green carries brand meaning
(actions, selection). Success states pair the green with an explicit icon +
label ("تم") — color alone never encodes state (WCAG 1.4.1).

### 11.2 Typography

| Use                      | Family                     | Notes                                                                                     |
| ------------------------ | -------------------------- | ----------------------------------------------------------------------------------------- |
| Arabic display & body    | **Alexandria** (variable)  | Geometric Arabic with excellent weights; headings ExtraBold, body Regular 1.7 line-height |
| Latin display (wordmark) | **Fraunces** (variable)    | Premium food-brand serif; the "JPasta" wordmark, large Latin accents                      |
| Prices / numerals        | Alexandria, `tabular-nums` | Accuracy over flair in numeric data                                                       |

### 11.3 Shape, Elevation, Motion

- Radii: 8 / 12 / 16 / 24 / 32 / 40px + pill CTAs. Nothing sharp.
- Shadows: warm-tinted (`rgb(24 38 32 / …)`), three-step ladder (card / lift / overlay).
- Motion: spring easing `cubic-bezier(.34,1.56,.64,1)` for entrances; 150–250ms
  micro-transitions; `prefers-reduced-motion` fully respected; marquee is
  the single ambient animation.
- Iconography: Lucide, 2px round caps — matches the brand's soft geometry.

### 11.4 Logo

The mark: a **twirled fork lifting a pasta nest** (spiral), with a basil-leaf
accent — drawn as rounded strokes on a green rounded-square badge. Lockup:
mark + "JPasta" (Fraunces) + "FRESH PASTA & CHICKEN" letterspaced caps.
Variants: full-color (cream/basil), monochrome cream (on dark), monochrome
basil (print). Files: `app/icon.svg`, `public/brand/`. Clear space = cap
height of "J"; minimum mark size 32px. **Receipts use the monochrome mark.**

### 11.5 Imagery & Illustration

Until real photography arrives: a flat **illustration system**
(`components/brand/dish-illustration.tsx`) renders stylized bowls/pasta with
per-dish sauce and topping variations — appetizing, consistent, on-brand.
Real photos (Phase 1+) replace illustrations per product; illustrations
remain the empty/fallback state.

---

## 12. Design & UX Bar (the defining requirement)

The owner's explicit instruction: **elite-tier UI/UX is the project's
highest-priority deliverable.** Enforced as gates, not intentions:

1. **Editorial type scale** (`type-hero` / `type-section` / `type-title`
   clamps) — no per-page ad-hoc sizes.
2. **One-hand mobile ergonomics** on `/menu` and `/console`: nav at thumb
   level, 44px targets, bottom sheets for actions.
3. **Design review gate:** every user-facing merge is screenshot-reviewed at
   375/768/1440 (Playwright visual snapshots) + axe scan, before approval.
4. **Perceived performance:** skeletons that mirror real shells, optimistic
   cart updates, zero layout shift (fonts preloaded via `next/font`,
   media dimensions reserved).
5. **Arabic typography quality:** correct shaping everywhere, RTL logical
   properties (`ms/me/ps/pe/start/end`), Arabic-Indic numerals only where
   culturally expected (prices stay Latin digits for menu-board consistency).
6. **Delight within restraint:** spring entrances, the twirl mark as loading
   indicator, generous whitespace — no decoration that costs clarity.

---

## 13. Non-Functional Requirements

- **Offline (Phase 2):** console order-entry queues to IndexedDB and syncs
  with idempotency keys on reconnect — same invariant as Ayasofia §12.
- **Backups:** Neon PITR + nightly logical dump to R2 (encrypted), restore
  rehearsed before go-live.
- **Observability:** Sentry (Workers), vitals sink → Postgres, SLOs: console
  order submit p95 < 1s; storefront p75 LCP < 2.0s.
- **Privacy:** customer name/phone/address encrypted at rest (AES-256-GCM)
  when the key is set; order-status pages token-gated; privacy policy page
  ships with the storefront.
- **Compliance note:** confirm VAT/e-invoicing obligations with an
  accountant before enabling tax (settings ship with `tax_rate = 0`).

---

## 14. Division of Labor

AI agents execute under this spec with the AGENTS.md guardrails. The owner is
the single decision maker. One roadmap item at a time; finish, verify, review,
commit — then move on.

---

## 15. Phased Roadmap — with Definition of Done

**Phase 0 — Foundations & Brand (this delivery)**
Repo, toolchain, CI skeleton, design system, identity/logo, landing page,
digital menu with customization + cart + WhatsApp handoff, placeholder
catalog.
_DoD: build/typecheck/lint green; Lighthouse ≥ 95 on `/` and `/menu` (mobile);
axe clean; visual review approved by owner._

**Phase 1 — Order Pipeline & Console Core** ✅ (delivered 2026-10-27)
Postgres + Drizzle schema + migrations (local: dedicated Docker Postgres on
:54330; production target Neon); first-party order intake (idempotent,
server-recomputed prices); token-gated order status page with auto-refresh;
console orders board (2.5s polling — the DO WebSocket upgrade lands with the
KDS in Phase 2); owner PIN console login (minimal DB-backed sessions, §8.5).
_DoD status: order placed from a phone appears on the console board < 3s ✅
(browser-verified); 20 consecutive test orders with zero calculation errors ✅
(`__tests__/orders.integration.test.ts`); RBAC enforced server-side on every
console action ✅._

**Phase 2 — Kitchen & Reliability** ✅ core delivered (2026-10-27)
**Realtime: SSE bus** (`lib/server/bus.ts` + `/api/console/stream`) — orders
push to every console/kitchen screen in **~225ms from DB commit** (measured
end-to-end through the real browser path; DoD < 2s). Notify fires strictly
_after_ transaction commit. On Cloudflare Workers the bus swaps to a Durable
Object behind the same `notifyOrdersChanged()` contract. **Kitchen display**
(`/console/kitchen`): huge tickets, elapsed chips color-shifting at 5/10min,
tap-to-advance. **New-order alert**: WebAudio chime + title flash + haptics,
mute toggle persisted. **Delivery zones admin** (`/console/settings`): fees
and active zones edited live (server-validated, ≥1 active zone enforced).
**Offline queue** (`lib/offline/`): Dexie-backed; failed storefront submits
queue locally and replay exactly-once on reconnect (payloads carry their own
idempotency keys — server UNIQUE constraint is the guarantee); covered by
`__tests__/offline-queue.test.ts`.
_DoD status: KDS ticket latency < 2s ✅ (225ms measured). Airplane-mode
entry syncs exactly once ✅ (unit-verified; console manual-entry UI lands
with Phase 3's console expansion). Web Push deferred to the console
expansion pass (VAPID + subscription storage — infrastructure untouched)._

**Phase 3 — Reporting & Staff** ✅ core delivered (2026-10-27)
Reports (`/console/reports`): local-day summary cards, Z-style cash view,
7-day bars, best sellers — DoD gate proven by
`__tests__/reports.integration.test.ts` (known orders → report matches the
manual count to the last agorot; found and fixed a real GROUP BY bug).
Staff (`/console/staff`): add/deactivate with PIN uniqueness enforced
server-side via verifyPin (spec §8.1 guardrail); roles gate every owner
surface via requireOwner(). Manual order entry (`/console/new`): walk-in
and phone orders through the same protected pipeline (source=console).
Menu manager v1 (`/console/menu`): availability + prices, every price
change audited to price_changes.
_DoD status: end-of-day report matches a manual count exactly ✅._

**Phase 4 — Inventory & Recipes** ✅ delivered (2026-10-27)
Automatic recipe-driven deduction inside the order transaction (one audited
`inventory_moves` row per affected ingredient, reason=sale, referencing the
order); admin (`/console/inventory`, owner-only): ingredients with costs,
purchase/waste/adjustment moves, recipe editor per product, low-stock
highlight at the reorder threshold. Composite PK on recipes for audited
upserts (migration 0001). Extras-ingredient linkage lands with real menu
data. DoD proven by `__tests__/inventory.integration.test.ts`.
_DoD status: selling 10 identical dishes deducts exactly the recipe
quantities ✅ (5000g − 200g×10, one audited move)._

**Phase 5 — Hardening & Go-Live** (in progress — 2026-10-27)
Shipped: **CSP with per-request nonce + strict-dynamic** via the Next 16
Proxy (`proxy.ts`, `lib/csp-nonce.ts`) — browser-verified that hydration,
dialogs and the order flow work unchanged under the strict policy; static
hardening headers (nosniff, DENY framing, referrer, permissions, prod HSTS)
in next.config; unit-tested (`__tests__/security-headers.test.ts`).
**Backups**: `scripts/backup-db.mjs` — compressed logical dump, 7-day
retention, printed restore command + scratch-restore verification habit
(cron example in the script header). Remaining (owner/production): ASVS L2
mapping doc, restore rehearsal on the production DB, real menu + photos,
**one-week parallel run**, cutover.
_DoD: all gates green + owner sign-off._

**Phase 6 — Candidates (post-launch)**
Loyalty/points, online payment (PalPay research), order-card share images,
aggregated delivery-platform intake.

---

## 16. Open Questions (owner/accountant confirmation needed)

1. **VAT:** confirm the applicable rate and whether e-invoicing obligations
   apply (ships as `tax_rate = 0`, settings-changeable, zero code impact).
2. **Delivery zones & fees:** which neighborhoods, flat vs distance-based
   (Phase 2 screen; placeholder flat fee until then).
3. **Domain:** `jpasta.ps` / `jpasta.co` availability (Cloudflare registrar).
4. **Cloudflare account:** the owner provisions the account + Workers plan
   (free tier suffices to start) and shares API token via Wrangler login.
5. **Real menu & photos:** template at `docs/menu-template.json`; photos to
   R2. Recipes/ingredients required before Phase 4 goes live.
6. **Receipt printing:** is a thermal printer owned today (model/connection)?
   Browser-print path works regardless; monochrome mark is ready for it.

---

## 17. Inherited Lessons (from the Ayasofia platform)

Kept (proven): modular monolith; integer-minor-unit money; idempotent order
writes; server-side RBAC; audit trails; offline-first POS thinking; RTL as a
first-class constraint; CI seed gates; "one week parallel run" as
non-negotiable.

Fixed here (Ayasofia's pain points): staging-class isolation from day one
(Neon branch per preview deploy); real-data completeness tracked as a launch
gate (not discovered at the end); design decisions locked in the brand doc
before screens (no mid-flight redesigns); observability via platform
primitives instead of an app-side limiter table; i18n structured from the
start instead of retrofitted bilingualism.
