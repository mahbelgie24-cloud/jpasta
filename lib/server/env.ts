import "server-only";

/**
 * Server environment resolution.
 *
 * On Cloudflare Workers the authoritative values are bindings/secrets from
 * getCloudflareContext().env. On Node (dev, tests, scripts) they come from
 * process.env. Reading both keeps one code path across runtimes.
 */
export type ServerEnv = Record<string, string | undefined> & {
  AUTH_PEPPER?: string;
  REALTIME_SECRET?: string;
  PII_ENCRYPTION_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_SUBJECT?: string;
  CRON_SECRET?: string;
  DATABASE_URL?: string;
  JPASTA_OWNER_PIN?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

export async function getServerEnv(): Promise<ServerEnv> {
  let cfEnv: Record<string, unknown> = {};
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    cfEnv = getCloudflareContext().env as unknown as Record<string, unknown>;
  } catch {
    // Node runtime — no Cloudflare context.
  }
  const merged: Record<string, string | undefined> = {
    ...process.env,
  };
  for (const [key, value] of Object.entries(cfEnv)) {
    if (typeof value === "string") merged[key] = value;
  }
  return merged as ServerEnv;
}

export async function requireSecret(
  name: keyof ServerEnv,
  minLength = 16,
): Promise<string> {
  const env = await getServerEnv();
  const value = env[name];
  if (!value || value.length < minLength) {
    throw new Error(
      `Missing or too-short secret ${String(name)} (min ${minLength}) — set it with \`wrangler secret put\` or in .env.local`,
    );
  }
  return value;
}
