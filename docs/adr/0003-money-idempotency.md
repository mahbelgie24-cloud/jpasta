# ADR 0003 — Money, idempotency and audit invariants

- **Status:** accepted (2026-10-28)
- **Decision:**
  1. All money is an integer in minor units (agorot) at every layer.
  2. The client sends product/option keys only; the server recomputes every
     price from the database.
  3. Every order write carries an idempotency key that is UNIQUE **and**
     bound to a hash of the normalized payload.
  4. The delivery fee comes from the customer's selected zone, never from
     the cheapest zone and never from the client.
  5. Status transitions are conditional on the expected current status and
     are recorded in `order_status_history`.
  6. Every price/stock change is audited.
- **Why:** a single-shop cash business cannot reconcile its drawer if any of
  these drift. The database CHECK constraints make the invariants fail loudly
  rather than silently corrupt data.
- **Consequences:** retries are safe, duplicates are impossible, and every
  order is reconstructable.
