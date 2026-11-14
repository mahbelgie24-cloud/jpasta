import { headers } from "next/headers";
import { requireStaff } from "@/lib/server/session";
import { requireSecret } from "@/lib/server/env";
import { verifyOrderAccessToken } from "@/lib/server/orders";
import { signRealtimeToken } from "@/lib/domain/realtime-token";
import { logEvent } from "@/lib/server/log";

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
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
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
    let binding:
      { limit(key: string): Promise<{ success: boolean }> } | undefined;
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      binding = (
        getCloudflareContext().env as {
          READ_LIMIT?: { limit(key: string): Promise<{ success: boolean }> };
        }
      ).READ_LIMIT;
    } catch {
      // Node runtime (local dev/tests) — no edge binding by design.
    }
    if (binding === undefined) {
      // A missing binding inside Workers silently removes the ceiling —
      // make it visible instead of failing open unnoticed.
      if (
        typeof navigator !== "undefined" &&
        /Cloudflare-Workers/i.test(navigator.userAgent)
      ) {
        logEvent("warn", "ratelimit.binding_missing", {
          message: "READ_LIMIT",
        });
      }
    } else if (!(await binding.limit(`mint:${await clientIp()}`)).success) {
      return Response.json(
        { ok: false, error: "rate-limited" },
        { status: 429 },
      );
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
