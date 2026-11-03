import { requireStaff } from "@/lib/server/session";
import { requireSecret } from "@/lib/server/env";
import { signRealtimeToken } from "@/lib/domain/realtime-token";

export const dynamic = "force-dynamic";

/**
 * Mint a 2-minute WebSocket token for the current console session.
 * The token is verified by the custom worker / Durable Object with
 * WebCrypto only — no database access on the upgrade path.
 *
 * A missing or short REALTIME_SECRET fails closed with 503: a 1-character
 * secret would let anyone forge an owner-role token.
 */
export async function GET() {
  let user;
  try {
    user = await requireStaff();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }

  let secret: string;
  try {
    secret = await requireSecret("REALTIME_SECRET", 32);
  } catch {
    return Response.json(
      { ok: false, error: "realtime-disabled" },
      { status: 503 },
    );
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
