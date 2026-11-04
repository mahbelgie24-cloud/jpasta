import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions, users } from "@/db/schema";
import { getServerEnv } from "./env";
import { logEvent } from "./log";
import { createVapidAuthorization, type VapidKeys } from "@/lib/domain/vapid";

/**
 * Web Push sender. Empty pushes only: the service worker fetches the
 * pending count and renders the notification, so no customer PII ever
 * travels through a push service. VAPID is optional — a deployment without
 * keys simply has no push transport.
 */

let cachedKeys: VapidKeys | null | undefined;

export async function getVapidKeys(): Promise<VapidKeys | null> {
  if (cachedKeys !== undefined) return cachedKeys;
  const env = await getServerEnv();
  const privateRaw = env.VAPID_PRIVATE_KEY?.trim();
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  if (!privateRaw || !publicKey) {
    cachedKeys = null;
    return cachedKeys;
  }
  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(privateRaw) as JsonWebKey;
  } catch {
    logEvent("error", "push.vapid_private_invalid");
    cachedKeys = null;
    return cachedKeys;
  }
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d || !jwk.x || !jwk.y) {
    logEvent("error", "push.vapid_private_invalid_shape");
    cachedKeys = null;
    return cachedKeys;
  }
  cachedKeys = {
    privateKeyJwk: jwk,
    publicKey,
    subject: env.VAPID_SUBJECT?.trim() || "https://jpasta.ps",
  };
  return cachedKeys;
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendEmptyPush(
  row: SubscriptionRow,
  keys: VapidKeys,
): Promise<void> {
  const authorization = await createVapidAuthorization(row.endpoint, keys);
  const response = await fetch(row.endpoint, {
    method: "POST",
    headers: {
      authorization,
      ttl: "120",
      urgency: "high",
    },
  });

  if (response.status === 404 || response.status === 410) {
    // The browser dropped the subscription — prune it instead of retrying.
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, row.endpoint));
    return;
  }
  if (!response.ok) {
    logEvent("warn", "push.send_failed", {
      status: response.status,
      host: new URL(row.endpoint).host,
    });
  }
}

export async function sendNewOrderPush(): Promise<void> {
  const keys = await getVapidKeys();
  if (!keys) return;

  const rows = await db
    .select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .innerJoin(users, eq(users.id, pushSubscriptions.userId))
    .where(eq(users.isActive, true))
    .limit(50);

  if (rows.length === 0) return;

  const results = await Promise.allSettled(
    rows.map((row) => sendEmptyPush(row, keys)),
  );
  const rejected = results.filter((r) => r.status === "rejected").length;
  if (rejected > 0) {
    logEvent("warn", "push.batch_partial", {
      total: rows.length,
      rejected,
    });
  }
}

/**
 * Called after a committed order. On Workers it schedules the network fan
 * out with `waitUntil`, so the customer's response is never held up by a
 * push service; on Node it runs inline (dev/test never has VAPID keys).
 */
export async function notifyNewOrderPush(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  const keys = await getVapidKeys();
  if (!keys) return;

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext().ctx as
      { waitUntil?: (promise: Promise<unknown>) => void } | undefined;
    const task = sendNewOrderPush();
    if (ctx?.waitUntil) {
      ctx.waitUntil(task);
      return;
    }
    await task;
  } catch {
    await sendNewOrderPush().catch((err) => {
      logEvent("warn", "push.notify_failed", {
        message: err instanceof Error ? err.message : "unknown",
      });
    });
  }
}
