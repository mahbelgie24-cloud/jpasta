import { headers } from "next/headers";
import { requireStaff } from "@/lib/server/session";
import { requireSecret } from "@/lib/server/env";
import { verifyOrderAccessToken } from "@/lib/server/orders";
import { signRealtimeToken } from "@/lib/domain/realtime-token";
import { checkRateLimit, classKey } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Mint a 2-minute WebSocket token, verified by the custom worker / Durable
 * Object with WebCrypto only — no database access on the upgrade path.
 *
 * Two modes:
 *  - staff (no query): the console session mints an owner/staff token.
 *  - customer (?orderId=&t=): the order's access token is the capability;
 *    the pair is verified against the DB and the token is scoped to that
 *    one order. The socket only ever receives a dataless "orders-changed"
 *    tickle — customer data never crosses the wire.
 *
 * A missing or short REALTIME_SECRET fails closed with 503: a 1-character
 * secret would let anyone forge an owner-role token.
 */

async function clientIp(): Promise<string> {
  const h = await headers();
  // cf-connecting-ip only — same rule as the actions; x-forwarded-for's
  // first hop is client-controlled and would make the mint: key forgeable.
  return h.get("cf-connecting-ip") ?? "unknown";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId") ?? "";
  const orderToken = url.searchParams.get("t") ?? "";
  const customerMode = orderId !== "" || orderToken !== "";

  let secret: string;
  try {
    secret = await requireSecret("REALTIME_SECRET", 32);
  } catch {
    return Response.json(
      { ok: false, error: "realtime-disabled" },
      { status: 503 },
    );
  }

  if (customerMode) {
    // Per-IP ceiling with its own key class: sharing the raw-IP bucket with
    // the 4s status polls would let ~16 concurrent pages behind one CGNAT
    // exhaust the quota and 429 each other's mints.
    const limited = await checkRateLimit(
      "READ_LIMIT",
      classKey("mint", await clientIp()),
      "rate-limited",
    );
    if (limited) {
      return Response.json({ ok: false, error: limited }, { status: 429 });
    }
    const valid = await verifyOrderAccessToken(orderId, orderToken);
    if (!valid) {
      return Response.json({ ok: false, error: "invalid" }, { status: 404 });
    }
    try {
      const token = await signRealtimeToken(
        { sub: "customer", role: "customer", oid: orderId },
        secret,
      );
      return Response.json(
        { ok: true, token },
        { headers: { "cache-control": "no-store" } },
      );
    } catch {
      return Response.json(
        { ok: false, error: "realtime-token-failed" },
        { status: 500 },
      );
    }
  }

  let user;
  try {
    user = await requireStaff();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const token = await signRealtimeToken(
      { sub: user.id, role: user.role },
      secret,
    );
    return Response.json(
      { ok: true, token },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, error: "realtime-token-failed" },
      { status: 500 },
    );
  }
}
