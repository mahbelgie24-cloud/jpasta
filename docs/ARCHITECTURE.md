# JPasta v2 — Architecture

> Canonical business spec: `docs/technical-spec.md` (v2 delta in §18).
> Design system: `docs/brand/brand.md` + `docs/DESIGN.md`.
> Deploy runbook: `docs/DEPLOY.md`.

## 1. Shape

A modular monolith on **Cloudflare Workers**:

```
Browser
  │
  ├─ Static assets ─────────────── Cloudflare CDN (ASSETS)
  │
  └─ Worker: jpasta (worker.ts)
       ├─ /api/realtime (WS) ─────► OrderFeed Durable Object
       └─ OpenNext handler ──────► Next.js 16 App Router
                                     ├─ Server Actions (orders, console)
                                     ├─ RSC pages (storefront, console)
                                     └─ Data Access Layer (lib/server)
                                            │
                    ┌───────────────────────┼────────────────────────┐
                    ▼                       ▼                        ▼
              Hyperdrive → Neon PG     R2 (media + ISR)        D1 + DO (tags/queue)
```

**Why one app:** single shop, owner-run, one deployment, one schema. No
microservices, no multi-tenancy, no distributed transactions.

## 2. Layers

| Layer   | Location                           | Rule                                              |
| ------- | ---------------------------------- | ------------------------------------------------- |
| UI      | `app/**/page.tsx`, `components/**` | No business rules; no direct DB                   |
| Actions | `app/actions/**`                   | Thin: auth guard → zod → domain call → revalidate |
| Domain  | `lib/server/**`, `lib/domain/**`   | `server-only`; all money/stock/time rules         |
| Data    | `db/schema.ts`, `db/migrations`    | Constraints are the last line of defence          |
| Runtime | `worker.ts`, `durable-objects/**`  | Only Cloudflare-specific plumbing                 |

**Guard rule:** every action that touches restricted data goes through
`lib/server/guard.ts` or an explicit `await requireOwner()/requireStaff()`.
An un-awaited async guard is a no-op — this was a real v1 defect.

## 3. Order pipeline (the money path)

```
placeOrder(input, { source, actorId? })
  1. zod parse (client sends product/option KEYS only; provenance is a
     server argument, never part of the payload)
  2. sha256(stableStringify(input)) → payloadHash
  3. replay by idempotencyKey; if found, assert payloadHash matches and
     return the original order — BEFORE the ordering kill switch/payment
     gates, so a lost response can always be retried
  4. channel rules: COD is delivery-only; dine-in is console-only
  5. BEGIN
     a. replay check again (concurrent duplicate loses the unique race)
     b. load products + modifier groups/options from DB
     c. recompute every line price from DB
     d. delivery: validate zoneId (active) → fee from deliveryZones
     e. atomic daily counter → JP-YYMMDD-NNN
     f. insert order + items + status history (received)
     g. deduct recipes from stock (integer hundredths; floors at 0)
  6. COMMIT
  7. notifyOrdersChanged() → OrderFeed DO → every console/kitchen screen
```

Invariants:

- Money is integer agorot end-to-end (`lib/pricing.ts`).
- No client price is ever trusted.
- `idempotency_key` is UNIQUE **and** payload-bound.
- Totals are CHECKed in Postgres: `total = subtotal + delivery_fee`.
- Status transitions are conditional (`WHERE status = expected`) and audited.
- Cancellation requires a reason; owner undo within 5 minutes.
- Product prices, delivery-zone fees and inventory unit costs all leave
  `price_changes` audit rows.
- Dine-in is a console-only channel (spec §7); the storefront cannot create
  one, and it never carries a delivery address/zone.

## 4. Realtime

`OrderFeed` is one Durable Object (`idFromName("jpasta")`) with hibernatable
WebSockets. One instance owns every console/kitchen connection regardless
of which Worker isolate handled the write.

- Handshake: `/api/realtime?token=…` (2-minute HMAC token from the
  authenticated Next route). The custom worker intercepts the upgrade and
  forwards it to the DO; the DO verifies the token with WebCrypto.
- Fan-out: `notifyOrdersChanged()` POSTs `/broadcast` to the DO with the
  `REALTIME_SECRET` bearer; the DO verifies it in constant time and rejects
  implausible timestamps.
- Client: `hooks/use-orders-feed.ts` — WebSocket first, exponential
  reconnect, 8-second polling only while the socket is down, visibility-aware.
  `BroadcastChannel` keeps tabs in sync and elects one tab for the chime.
- Local Node (tests/dev): `next start` has no DO; the client falls back to
  polling and the in-process bus handles same-process notifications.

### 4.1 Web Push

`notifyNewOrderPush()` runs after commit and sends an **empty** VAPID push
(WebCrypto ES256, no Node libraries) to every active staff subscription.
There is deliberately no payload: the service worker fetches
`/api/console/pending-count` and renders the notification itself, so no
customer data crosses a push service. Subscription endpoints are checked
against a browser-push host allowlist before the server will POST to them.
`VAPID_PRIVATE_KEY`/`VAPID_PUBLIC_KEY` are optional; without them the
transport is disabled rather than degraded.

## 5. Caching

`open-next.config.ts`:

- **R2 incremental cache** + regional cache: ISR/SSG survives isolates.
- **DO queue**: deduplicated time-based revalidation.
- **D1 tag cache**: `updateTag("catalog")` / `revalidatePath("/menu")`
  actually propagate.

KV is deliberately not used (eventually consistent → stale menu after an
owner edit is a money-visible bug).

## 6. Time

Cloudflare Workers run in UTC. Every business-day calculation uses
`lib/domain/time.ts` with `Asia/Hebron` explicitly:

- reports / Z-cash / best sellers,
- order numbers,
- opening-hours state,
- status-page timestamps.

Never use `new Date(y, m, d)` or the process timezone for business days.

## 7. Security

- Sessions: 32-byte opaque tokens, sha256 at rest, HttpOnly `__Host-`
  cookie in production, 7-day absolute + 12-hour idle expiry,
  `users.session_version` invalidates on credential/role change.
- PIN: scrypt with per-user salt + O(1) HMAC lookup (`pin_lookup` UNIQUE)
  - DB throttle with progressive lockout + Workers rate-limit binding.
- RBAC: owner-only money/settings/staff/inventory/reports, enforced in the
  action, not the nav.
- CSP: per-request nonce + `strict-dynamic` on dynamic routes, static tier
  with SRI. `base-uri 'none'`, `frame-ancestors 'none'`, same-origin
  WebSocket only.
- Idempotency payload binding prevents replay with a different cart; the
  client key is stable across retries of the same payload.
- A failed settings read rejects the order (the owner's kill switch and
  minimum are never silently replaced by defaults).
- DB CHECK constraints protect totals, quantities, stock, fees, the order
  number shape, the payload hash, and a cancelled order's reason.
- DB UNIQUE(product/group, key) prevents a duplicate option key from silently
  mispricing a line.
- Cart quotes reuse `computeOrderLines`, so a persisted cart is re-priced
  against the live catalog before submit (a stale localStorage price is
  corrected, never charged).

## 8. Media

- Photos live in R2 (`MEDIA`), served via `/api/media/[...key]` with
  `immutable` caching (or a public R2 custom domain later).
- Upload is an owner-only server action (8 MB, MIME-validated).
- Products without a photo render the deterministic `DishArt` system —
  never a broken image.

## 9. PWA / offline

- `public/sw.js` precaches the shell, serves navigations network-first with
  an offline fallback, caches media and immutable assets, and handles Web
  Push notifications.
- The storefront order queue (Dexie) replays exactly once using the original
  idempotency key.
- Registration is production-only and non-blocking.

## 10. Observability

- `lib/server/log.ts` emits one-line JSON events (`order.place_failed`,
  `order.transition_failed`, …) ready for Workers Logpush.
- `instrumentation.ts` `onRequestError` captures unhandled server errors as
  the same JSON shape (path, route, render source, digest — never a body).
- `/api/health` reports DB readiness, latency, uptime and the build revision
  (`NEXT_PUBLIC_COMMIT_SHA`, set by deploy), and logs the DB error on 503.
- A daily Cron Trigger (`0 3 * * *`) calls `/api/cron/prune` with
  `CRON_SECRET`; it removes expired sessions and login attempts older than
  30 days. The order audit trail is never pruned.
- `wrangler observability.enabled` is on.

## 11. Decisions

- `docs/adr/0001-opennext.md` — why OpenNext, not vinext (for now).
- `docs/adr/0002-realtime-durable-object.md` — why a DO, not SSE.
- `docs/adr/0003-money-idempotency.md` — the money invariants.
