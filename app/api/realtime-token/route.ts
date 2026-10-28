import { requireStaff } from "@/lib/server/session";
import { getServerEnv } from "@/lib/server/env";
import { signRealtimeToken } from "@/lib/domain/realtime-token";

export const dynamic = "force-dynamic";

/**
 * Mint a 2-minute WebSocket token for the current console session.
 * The token is verified by the custom worker / Durable Object with
 * WebCrypto only — no database access on the upgrade path.
 */
export async function GET() {
  try {
    const user = await requireStaff();
    const env = await getServerEnv();
    if (!env.REALTIME_SECRET) {
      return Response.json(
        { ok: false, error: "realtime-disabled" },
        { status: 503 },
      );
    }
    const token = await signRealtimeToken(
      { sub: user.id, role: user.role },
      env.REALTIME_SECRET,
    );
    return Response.json(
      { ok: true, token },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return new Response("unauthorized", { status: 401 });
  }
}
