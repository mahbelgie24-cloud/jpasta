import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { requireStaff } from "@/lib/server/session";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/db/schema";
import { isAllowedPushEndpoint } from "@/lib/domain/vapid";

export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(600),
  keys: z.object({
    p256dh: z.string().min(16).max(300),
    auth: z.string().min(8).max(200),
  }),
});

export async function POST(request: Request) {
  let user;
  try {
    user = await requireStaff();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "invalid-subscription" },
      { status: 400 },
    );
  }
  // Never POST to an arbitrary host: only real browser push services.
  if (!isAllowedPushEndpoint(parsed.data.endpoint)) {
    return Response.json(
      { ok: false, error: "endpoint-not-allowed" },
      { status: 400 },
    );
  }

  await db
    .insert(pushSubscriptions)
    .values({
      userId: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: user.id,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
    });

  return Response.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireStaff();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
  } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    return Response.json({ ok: false }, { status: 400 });
  }

  // A staff member can only remove their own device.
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, user.id),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );

  return Response.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}
