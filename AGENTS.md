<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation
notices. (Notably: Middleware is now called **Proxy**; `next lint` is gone;
typecheck runs `next typegen` first.)

<!-- END:nextjs-agent-rules -->

# JPasta — Project Rules

Canonical source of truth: `docs/technical-spec.md`. If anything here
conflicts with the spec, the spec wins. Read the spec and `docs/brand/brand.md`
before starting work.

## Scope discipline

Work on **one roadmap phase item at a time** (spec §15). Finish, verify,
review, commit — then ask before stretching scope.

## Copy truth

Pasta is bought fresh and cooked to order — never kneaded or produced
in-house. Do not write dough, daily pasta-making, handmade, or "made today"
claims. The honest craft story is selected fresh pasta, house sauces prepared
fresh daily, marinated chicken, and cooking to order.

## Money representation

All money is an **integer in minor units (agorot)**. `lib/pricing.ts` is the
single conversion/formatting boundary. `parseFloat` on money is lint-banned.
No raw JS float ever touches a price. Prices render only via
`components/ui/price.tsx`.

## Order writes and idempotency

Every code path that creates or modifies an order (from Phase 1 on) **must**
generate and pass an `idempotencyKey` (spec §9). A retried request or offline
replay must never duplicate a sale.

## Exports, notifications, and retention

- CSV exports are **owner-only**, default to **no PII**, and every cell must
  pass `lib/csv.ts` (quoting + formula-injection neutralisation). PII export
  is `pii=1` and audited; never log the values.
- Web Push sends an **empty tickle** only. Never put customer data in a push
  payload; the service worker fetches the pending count. Subscription
  endpoints must pass `isAllowedPushEndpoint()` (HTTPS browser hosts only).
- The daily prune removes expired sessions and old login attempts. It must
  never delete `order_status_history` — that is the audit trail.

## Role-based access control

Authorization is enforced **server-side**, in every server action and route
handler that touches restricted data (spec §8.5). The UI hiding something is
never the security boundary.

## Design system discipline

- Colors, radii, shadows, motion come from tokens in `app/globals.css`
  (`@theme`) — **no raw hex or ad-hoc values in components**
  (`docs/brand/brand.md` is the reference).
- Fluid type tiers only (`type-hero` / `type-section` / `type-title` /
  `type-body` / `type-micro`) — no per-page font sizes.
- Arabic RTL is first-class: use logical properties (`ms/me/ps/pe/start/end`),
  never physical left/right, and test at 375px width.
- Every interactive target ≥ 44×44px; color never carries meaning alone.
- `prefers-reduced-motion` must be respected everywhere.

## Cloudflare posture

The production target is Cloudflare Workers (`@opennextjs/cloudflare`,
spec §4). Keep `npm run build` green — it is the deploy gate. Platform
bindings (DO, R2, D1, Hyperdrive) are configured in `wrangler.jsonc`, never
hardcoded. `worker.ts` is the custom entry: it exports `OrderFeed` and
intercepts `/api/realtime` before Next.js.

## v2 invariants (do not regress)

- **Order provenance is server-owned.** `placeOrder(input, { source })` —
  never accept `source` from a client payload. The storefront action asserts
  `"storefront"`; console intake asserts `"console"` after its guard.
- **Delivery fee = the customer's selected zone.** `zoneId` is validated
  server-side; never pick the cheapest active zone.
- **Idempotency is payload-bound.** `payload_hash` must match on replay, and
  the key must stay stable across a retry of the same payload
  (`lib/idempotency.ts`).
- **Fail closed on money rules and secrets.** A failed shop-settings read
  rejects orders; production writes PII only when `PII_ENCRYPTION_KEY` is
  present; missing/short `AUTH_PEPPER` or `REALTIME_SECRET` must fail, never
  degrade to a weaker path.
- **Integration tests never touch a non-loopback database.**
  `TEST_DATABASE_URL` is the only test connection; the suites are destructive
  and must fail, not skip, when the guard cannot prove the host is local.
- **Transitions are conditional.** Update with `WHERE status = expected`
  inside a transaction; append to `order_status_history`.
- **Business time is `Asia/Hebron`.** Use `lib/domain/time.ts`; never
  `new Date(y,m,d)` or the process timezone.
- **Order numbers are gap-free per local day** (`order_counters`).
- **Every restricted action awaits a guard** (`lib/server/guard.ts` or
  `requireOwner`/`requireStaff`). An un-awaited async guard is a security bug.
- **Stock never goes negative.** Use `lib/domain/qty.ts` (integer
  hundredths), not floats.
- **Realtime is a Durable Object**, not an in-process bus. Keep
  `notifyOrdersChanged()` after commit.
- **Photos**: curated catalog photos are committed WebP derivatives under
  `public/media/products/` (seeded as `media/products/<slug>.webp`); owner
  replacements live in R2. `DishMedia` handles both and falls back to
  `DishArt` — never a broken image.
- **Console uses the dark `theme-console` tokens**; the KDS uses
  `theme-kitchen`. New console code must use semantic tokens directly.

## When the spec doesn't answer a question

Look for the closest section in `docs/technical-spec.md`. If it is silent,
prefer the simpler single-shop pattern with the lowest operational overhead.
