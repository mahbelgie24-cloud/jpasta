import { inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/db/schema";
import { requireStaff } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/**
 * Tiny count endpoint used by the service worker when a push arrives with
 * no payload. Session-gated; returns only a number, never order data.
 */
export async function GET() {
  try {
    await requireStaff();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(inArray(orders.status, ["received", "preparing"]));

  return Response.json(
    { count: row?.count ?? 0 },
    { headers: { "cache-control": "no-store" } },
  );
}
