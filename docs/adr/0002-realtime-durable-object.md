# ADR 0002 — Durable Object for realtime order fan-out

- **Status:** accepted (2026-10-28)
- **Context:** v1 used an in-process `EventEmitter` + SSE. On Workers, each
  isolate has its own memory, so a write in isolate A does not reach a stream
  in isolate B. `placement: smart` makes that worse. The real production
  transport was the 5-second poll.
- **Decision:** one `OrderFeed` Durable Object with hibernatable WebSockets.
  The custom worker intercepts `/api/realtime` before Next.js and forwards
  the upgrade to the DO. Writes POST `/broadcast` after commit.
- **Why:** a single globally-addressed object is the only correct fan-out
  primitive across isolates; hibernation keeps the cost near zero for a
  low-traffic shop.
- **Consequences:** WebSocket auth uses a 2-minute HMAC token minted by an
  authenticated Next route (the DO has no DB access). The client keeps an
  8-second polling fallback, used only while the socket is down.
