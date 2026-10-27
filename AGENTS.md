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

## Money representation

All money is an **integer in minor units (agorot)**. `lib/pricing.ts` is the
single conversion/formatting boundary. `parseFloat` on money is lint-banned.
No raw JS float ever touches a price. Prices render only via
`components/ui/price.tsx`.

## Order writes and idempotency

Every code path that creates or modifies an order (from Phase 1 on) **must**
generate and pass an `idempotencyKey` (spec §9). A retried request or offline
replay must never duplicate a sale.

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
bindings (DO, R2, KV) are added in Phase 1+ and configured in `wrangler.jsonc`,
never hardcoded.

## When the spec doesn't answer a question

Look for the closest section in `docs/technical-spec.md`. If it is silent,
prefer the simpler single-shop pattern with the lowest operational overhead.
