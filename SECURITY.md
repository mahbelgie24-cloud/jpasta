# Security Policy — JPasta

This is a single-shop ordering system that stores customer contact data. We
take reports seriously and will acknowledge them quickly.

## Reporting a vulnerability

Please **do not open a public issue**. Contact the owner privately:

- WhatsApp: https://wa.me/970566064976
- Include: affected URL/route, reproduction steps, impact, and any proof of
  concept. Never include real customer data in a report.

If the report affects a live deployment, the owner will coordinate a fix and
a disclosure window. We aim to acknowledge within 72 hours.

## Supported versions

Only the currently deployed revision on `main` is supported. There is no
long-term-support branch for this single-shop deployment.

## Scope

In scope: the storefront, owner console, server actions, API routes, R2 media
serving, realtime WebSocket handshake, CSV exports, and the deploy
configuration in this repository.

Out of scope: third-party services (Cloudflare, Neon), social engineering,
and denial-of-service testing against the production shop.

## What we already do

- Server-side authorization in every restricted action/page (never UI-only).
- Integer money in minor units; prices recomputed server-side.
- Payload-bound idempotency and conditional, audited status transitions.
- Opaque sessions hashed at rest; PBKDF2 PINs; DB + Workers login throttles.
- AES-256-GCM field encryption for customer PII in production (fail-closed).
- Nonce CSP + SRI, HSTS, COOP/CORP, no-store on authenticated exports.
- Owner-only, PII-free-by-default CSV exports with formula-injection guards.
- Parameterized SQL, zod validation, magic-byte upload checks, SSRF allowlist
  for Web Push endpoints.

The full implementation and ASVS 5.0 L2 mapping live in
[`docs/SECURITY.md`](./docs/SECURITY.md). Operational procedures are in
[`docs/DEPLOY.md`](./docs/DEPLOY.md).
