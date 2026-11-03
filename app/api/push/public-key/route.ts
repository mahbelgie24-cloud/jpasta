import { requireStaff } from "@/lib/server/session";
import { getVapidKeys } from "@/lib/server/push";

export const dynamic = "force-dynamic";

/** The VAPID public key the browser subscribes with (staff-only surface). */
export async function GET() {
  try {
    await requireStaff();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }

  const keys = await getVapidKeys();
  if (!keys) {
    return Response.json(
      { ok: false, error: "push-disabled" },
      { status: 503 },
    );
  }
  return Response.json(
    { ok: true, key: keys.publicKey },
    { headers: { "cache-control": "no-store" } },
  );
}
