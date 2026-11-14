import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { requireStaff } from "@/lib/server/session";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/db/schema";
import { isAllowedPushEndpoint } from "@/lib/domain/vapid";
import { logEvent } from "@/lib/server/log";

export const dynamic = "force-dynamic";

/** Own key class on the shared READ_LIMIT binding (see realtime-token). */
async function limitPerClass(key: string): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const binding = (
      getCloudflareContext().env as {
        READ_LIMIT?: { limit(key: string): Promise<{ success: boolean }> };
      }
    ).READ_LIMIT;
    if (!binding) {
      // A missing binding inside Workers silently removes the ceiling —
      // visible in observability instead of failing open unnoticed.
      if (
        typeof navigator !== "undefined" &&
        /Cloudflare-Workers/i.test(navigator.userAgent)
      ) {
        logEvent("warn", "ratelimit.binding_missing", {
          message: "READ_LIMIT",
        });
      }
      return false;
    }
    const { success } = await binding.limit(key);
    return !success;
  } catch {
    return false;
  }
}

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

  // Authenticated but still rate-limited: the endpoint writes a DB row on
  // every hit, so a scripted session must not turn it into unbounded writes.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const limited = await limitPerClass(`push:${ip}`);
  if (limited) {
    return Response.json({ ok: false, error: "rate-limited" }, { status: 429 });
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

  // Same ceiling as POST — SECURITY.md documents both endpoints limited.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (await limitPerClass(`push:${ip}`)) {
    return Response.json({ ok: false, error: "rate-limited" }, { status: 429 });
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
