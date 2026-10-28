# ADR 0001 — Stay on OpenNext for the v2 rebuild

- **Status:** accepted (2026-10-28)
- **Context:** Cloudflare now positions `vinext` as a default Next.js runtime.
  JPasta already builds and deploys through `@opennextjs/cloudflare`, and the
  production recipe (R2 incremental cache, DO queue, D1 tag cache, custom
  worker for Durable Objects) is documented and verified.
- **Decision:** keep OpenNext for v2. Re-evaluate `vinext` in a time-boxed
  spike after the first production week.
- **Why:** the rebuild's risk budget is spent on data correctness and the
  design system, not on a runtime migration. OpenNext supports every feature
  JPasta needs today, and the custom-worker path is proven.
- **Consequences:** the deploy bundle includes the OpenNext adapter. A future
  migration must re-verify DO exports, the cache stack and the custom worker.
