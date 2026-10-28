# JPasta v2 — Security & ASVS 5.0 L2 Mapping

> Scope: storefront, owner console, server actions, database, R2 media,
> realtime WebSocket, deploy pipeline. Last reviewed: 2026-10-28.

## 1. Threat model (short)

| Asset            | Threat                                 | Control                                                                       |
| ---------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| Orders / revenue | forged prices, duplicate sales, replay | server recompute, idempotency + payload hash, DB CHECK                        |
| Console          | credential brute force, session theft  | scrypt + HMAC lookup, DB throttle, `__Host-` HttpOnly cookie, session version |
| Reports/settings | privilege escalation                   | owner guard in every action/page, awaited                                     |
| Customer PII     | over-collection / injection            | zod validation, parameterized SQL, minimal fields                             |
| Realtime         | unauthorized subscription              | short-lived HMAC token verified by the DO                                     |
| Media            | malicious upload                       | owner-only, MIME + 8 MB limit, R2 key allowlist                               |
| Supply chain     | tampered scripts                       | nonce CSP + SRI, pinned deps, no third-party scripts                          |

## 2. ASVS 5.0 L2 mapping (implementation)

| ASVS area               | Control in JPasta                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| V1 Encoding / injection | Drizzle parameterized SQL; React escaping; no `dangerouslySetInnerHTML` except typed JSON-LD                                   |
| V2 Validation           | zod at every action boundary; DB CHECK constraints; UUID validation                                                            |
| V3 Session              | opaque 32-byte tokens, sha256 at rest, 7-day absolute, 12-hour idle, `__Host-` cookie, version invalidation                    |
| V4 Access control       | `requireOwner`/`requireStaff` in every restricted action and page; tested matrix                                               |
| V5 File handling        | owner-only upload, MIME allowlist, 8 MB cap, generated R2 key                                                                  |
| V6 Authentication       | 6-digit PIN, PBKDF2-HMAC-SHA256 210k (WebCrypto; legacy scrypt verified), HMAC lookup, progressive lockout, Workers rate limit |
| V7 Error/logging        | generic user errors, structured JSON events without PII/secrets                                                                |
| V8 Data protection      | TLS/HSTS, no secrets in client bundles, PII minimal, DB backups encrypted at rest by provider                                  |
| V9 Communication        | HTTPS only, HSTS preload, same-origin CSP, COOP/CORP                                                                           |
| V10 Malicious code      | SRI on scripts, nonce CSP, no eval, dependency lockfile                                                                        |
| V11 Business logic      | idempotency, conditional transitions, zone-bound fees, stock floor                                                             |
| V12 Files/resources     | R2, no local filesystem, size limits                                                                                           |
| V13 API                 | server actions + route handlers, origin checks, rate limits, no CORS widening                                                  |
| V14 Config              | security headers, CSP, no powered-by, observability, secrets via Wrangler                                                      |

## 3. Headers

- CSP: per-request nonce + `strict-dynamic` on dynamic routes; static tier
  with SRI. `base-uri 'none'`, `frame-ancestors 'none'`,
  `connect-src 'self' wss://<host>`, `worker-src 'self' blob:`.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` locked down, COOP/CORP same-origin,
  `X-Permitted-Cross-Domain-Policies: none`, prod HSTS.

## 4. Operational rules

- Secrets only via `wrangler secret put`; never in `wrangler.jsonc` or git.
- `scripts/check-env.mjs` blocks deploys with placeholders/localhost/missing
  secrets.
- Migrations run from a trusted machine against Neon; `seed --force` is
  blocked in production.
- Backups: Neon PITR + nightly logical dump; restore rehearsal required.
- Rotate `AUTH_PEPPER` only with a PIN re-provisioning plan (it changes every
  lookup).
- Rotate `REALTIME_SECRET` freely (tokens live 2 minutes).

## 5. Known gaps (tracked)

- No MFA/WebAuthn (PIN-only is a deliberate business constraint).
- No field-level encryption for phone/address at rest (provider encryption
  only); revisit if regulation requires it.
- No WAF custom rules/turnstile on order intake yet; the rate limit +
  idempotency + server validation are the current controls.
- No Sentry/APM; structured Workers logs + `/api/health` are the current
  observability.
- ASVS mapping is implementation-level, not a third-party audit.

## 6. Security review checklist

- [ ] Every new server action uses a guard and zod.
- [ ] Every new money/stock path preserves integer arithmetic and audit rows.
- [ ] Every new page under `/console` has a server-side role gate.
- [ ] No secret or PII in client components or logs.
- [ ] CSP still passes `__tests__/security-headers.test.ts`.
- [ ] New upload paths validate MIME + size.
