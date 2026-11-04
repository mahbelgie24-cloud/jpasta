# Production Deploy Runbook — Cloudflare Workers + Neon

Target: **Cloudflare Workers** via `@opennextjs/cloudflare`, **Neon Postgres**
via **Hyperdrive**, **R2** for media + ISR cache, **D1** for the tag cache,
and a **Durable Object** for realtime. Everything is wired in
`wrangler.jsonc` + `open-next.config.ts` + `worker.ts`.

> The build is deploy-ready on a clean clone. The steps below are the only
> ones that need the owner's Cloudflare/Neon accounts.

---

## 0. Prerequisites

- Node ≥ 22
- A Cloudflare account (`npx wrangler login`)
- A Neon Postgres project (copy the **pooled** URL)
- The production domain (e.g. `jpasta.ps`)

```bash
npm ci
npx wrangler login
```

---

## 1. Create the data plane

```bash
# Hyperdrive → Neon
npx wrangler hyperdrive create jpasta-pg \
  --connection-string="$NEON_POOLED_URL"
# → paste the printed id into wrangler.jsonc (HYPERDRIVE.id)

# R2: product photos + OpenNext incremental cache
npx wrangler r2 bucket create jpasta-media
npx wrangler r2 bucket create jpasta-opennext-cache

# D1: OpenNext tag cache (on-demand revalidation)
npx wrangler d1 create jpasta-tags
# → paste database_id into wrangler.jsonc (NEXT_TAG_CACHE_D1)
```

`npm run deploy` refuses to run while `wrangler.jsonc` still contains
`REPLACE_WITH_*` (`scripts/check-env.mjs`).

---

## 2. Secrets (never in the repo)

```bash
npx wrangler secret put DATABASE_URL      # Neon pooled URL
npx wrangler secret put JPASTA_OWNER_PIN  # 6 digits
npx wrangler secret put AUTH_PEPPER       # openssl rand -hex 32
npx wrangler secret put REALTIME_SECRET   # openssl rand -hex 32
npx wrangler secret put PII_ENCRYPTION_KEY # openssl rand -hex 32 (64 hex)
npx wrangler secret put CRON_SECRET        # openssl rand -hex 32 (optional)
# BACKUP_ENCRYPTION_KEY is a GitHub Actions secret (not a Worker secret):
# it encrypts the pre-deploy dump before it is uploaded as an artifact.
npx wrangler secret put VAPID_PRIVATE_KEY  # npm run vapid (optional)
npx wrangler secret put VAPID_PUBLIC_KEY   # npm run vapid (optional)
npx wrangler secret put VAPID_SUBJECT      # https://jpasta.ps (optional)
```

| Secret                  | Purpose                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Node fallback connection (Workers use Hyperdrive first)                          |
| `JPASTA_OWNER_PIN`      | provisioning the owner account                                                   |
| `AUTH_PEPPER`           | O(1) PIN lookup HMAC (must stay stable)                                          |
| `REALTIME_SECRET`       | signs 2-minute WebSocket tokens                                                  |
| `PII_ENCRYPTION_KEY`    | AES-256-GCM for customer PII at rest (required in prod)                          |
| `CRON_SECRET`           | authorises the daily prune route (optional)                                      |
| `BACKUP_ENCRYPTION_KEY` | GitHub Actions secret: client-side encryption of the pre-deploy dump (32+ chars) |
| `VAPID_PRIVATE_KEY`     | Web Push signing key (`npm run vapid`, optional)                                 |
| `VAPID_PUBLIC_KEY`      | browser subscription key (`npm run vapid`, optional)                             |
| `VAPID_SUBJECT`         | VAPID contact URI (https or mailto)                                              |

`NEXT_PUBLIC_*` values are **build-time**; export them in the deploy shell.

---

## 3. Migrate + provision

```bash
DATABASE_URL="$NEON_POOLED_URL" npm run db:migrate
DATABASE_URL="$NEON_POOLED_URL" npm run db:seed          # first install only
# after a schema-only change (keeps the catalog and orders):
DATABASE_URL="$NEON_POOLED_URL" npm run db:seed -- --provision
```

`db:seed --force` is refused when `NODE_ENV=production` **and** whenever the
database host is not loopback (it truncates orders). The host guard is the
reliable one because the deploy workflow does not export `NODE_ENV`.

### Menu catalog updates (no schema change)

When `lib/menu-data.ts` changes, replace only the catalog:

```bash
DATABASE_URL="$NEON_POOLED_URL" npm run db:menu
```

- Runs in one transaction: deletes the old categories/products/modifier
  groups, inserts the new catalog, and touches nothing else.
- `orders`, `order_items`, `order_status_history`, `settings`,
  `delivery_zones`, `users` and `ingredients` stay intact. Historical items
  keep their `name_ar`/`detail_ar`/price snapshots; their `product_id`
  becomes `NULL`.
- Recipes attached to removed products are deleted (cascade). Old product
  photos are removed with their rows; new products render the DishArt
  illustration until the owner uploads photos from `/console/menu`.
- The catalog cache has a 5-minute bound (`unstable_cache`); allow up to five
  minutes for the storefront to show the new menu.
- Never use `db:seed --force` against production — it truncates orders.

---

## 4. Deploy

```bash
NEXT_PUBLIC_SITE_URL="https://jpasta.ps" \
NEXT_PUBLIC_WHATSAPP_NUMBER="970566064976" \
npm run deploy
```

`npm run deploy` = `check-env` → OpenNext build → `wrangler deploy`.

The custom entry `worker.ts` exports `OrderFeed` + the OpenNext cache Durable
Objects. OpenNext's own build logs a warning about DO exports because it
validates the generated `.open-next/worker.js`; wrangler bundles `worker.ts`
and the classes are present (verify with `npx wrangler deploy --dry-run`).

---

## 5. First-deploy verification

```bash
# 1. health + DB
curl -s https://jpasta.ps/api/health

# 2. CSP on a dynamic and a static route
curl -sI https://jpasta.ps/console/login | grep -i content-security-policy
curl -sI https://jpasta.ps/menu | grep -i content-security-policy

# 3. DB through the worker (20 × 200)
for i in $(seq 1 20); do curl -s -o /dev/null -w "%{http_code}\n" https://jpasta.ps/menu; done

# 4. realtime: open /console on two devices, place a real order,
#    confirm the ticket appears in < 1s and the badge says مباشر.

# 5. reports: place an order at 00:30 local and check the Z report.

# 6. media: upload a dish photo from /console/menu and confirm it renders.

# 7. backup + restore rehearsal (see §7).
```

---

## 6. Operations

- **Rollback:** `npx wrangler rollback`
- **Logs:** `npx wrangler tail` (structured JSON events)
- **Schema change:** generate migration → `db:migrate` → deploy → run
  `db:seed -- --provision` if credentials/settings changed.
- **Menu content change:** `npm run db:menu` (see §3); it never touches orders.
- **Secret rotation:** `npx wrangler secret put <NAME>`; no redeploy needed.
- **Service worker:** bump `VERSION` in `public/sw.js` when the shell changes.

---

## 7. Backups

```bash
DATABASE_URL="$NEON_POOLED_URL" node scripts/backup-db.mjs
```

Compressed logical dump in `backups/` with 7-day retention. **Rehearse a
restore into a scratch database before trusting it.** Neon PITR is the
primary recovery path; the dump is the portable copy.

The deploy workflow uploads the pre-migration dump as a GitHub artifact.
Set the `BACKUP_ENCRYPTION_KEY` Actions secret (32+ characters) and the
script writes an OpenSSL AES-256-CBC/PBKDF2 `.sql.gz.enc` instead; the key
never appears in the process list or the artifact. Without it, the script
warns and uploads the dump unencrypted (GitHub encrypts artifacts at rest,
but the archive itself is not client-side encrypted). Restore an encrypted
dump with the printed command:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
  -in backups/jpasta_<stamp>.sql.gz.enc | gunzip -c | psql "$DATABASE_URL"
```

---

## 8. Known limitations

- Local `wrangler dev` cannot run the internal DO cache classes in the same
  way as production; the OpenNext build warns about this. The custom
  `OrderFeed` DO is still exercised by `wrangler dev`/preview.
- Raw `pg` sockets over workerd are unreliable in local preview. Production
  uses Hyperdrive's platform-side multiplexing. If production ever shows the
  same flakiness, switch the Workers branch of `lib/db/index.ts` to
  `@neondatabase/serverless` (documented contingency; interactive
  transactions are preserved).
- `vitest` integration suites truncate orders in the configured database.
  Never point `DATABASE_URL` at production when running tests.

---

## 9. Release checklist

- [ ] `npm run format:check && npm run lint && npm run typecheck && npm test`
- [ ] `npm run build`
- [ ] `npm run build:cf`
- [ ] `npx wrangler deploy --dry-run`
- [ ] `npm run deploy`
- [ ] §5 verification, including realtime and the 00:30 report
- [ ] one-week parallel run before retiring any old process
