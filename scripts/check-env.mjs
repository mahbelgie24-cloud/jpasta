#!/usr/bin/env node
/**
 * Pre-deploy environment check (docs/DEPLOY.md). Fails loudly BEFORE a
 * Workers deploy instead of shipping a build with localhost, placeholder ids,
 * or missing secrets baked in. Never prints secret values.
 *
 * Used by `npm run deploy`; safe to run standalone any time.
 */
import { existsSync, readFileSync } from "node:fs";

const REQUIRED = [
  "DATABASE_URL",
  "JPASTA_OWNER_PIN",
  "AUTH_PEPPER",
  "REALTIME_SECRET",
  "PII_ENCRYPTION_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_WHATSAPP_NUMBER",
];

function loadDotEnvLocal() {
  const vars = {};
  if (!existsSync(".env.local")) return vars;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m?.[1] && m[2] !== undefined) vars[m[1]] = m[2].trim();
  }
  return vars;
}

const dotEnv = loadDotEnvLocal();
const get = (key) => process.env[key] || dotEnv[key];

const problems = [];

for (const key of REQUIRED) {
  if (!get(key))
    problems.push(`missing: ${key} (set it in .env.local or the shell)`);
}

const dbUrl = get("DATABASE_URL");
if (dbUrl && !/^postgres(ql)?:\/\//.test(dbUrl)) {
  problems.push(
    "DATABASE_URL must be a postgres:// or postgresql:// connection string",
  );
}

const ownerPin = get("JPASTA_OWNER_PIN");
if (ownerPin && !/^\d{6}$/.test(ownerPin)) {
  problems.push("JPASTA_OWNER_PIN must be exactly 6 digits");
}

for (const secret of [
  "AUTH_PEPPER",
  "REALTIME_SECRET",
  "CRON_SECRET",
  "BACKUP_ENCRYPTION_KEY",
]) {
  const value = get(secret);
  if (value && value.length < 32) {
    problems.push(`${secret} must be at least 32 characters`);
  }
}

// Customer name/phone/address are encrypted at rest with this key. A
// production deploy without it would silently store plaintext PII, so it is
// a hard requirement (spec §13).
const piiKey = get("PII_ENCRYPTION_KEY");
if (piiKey && !/^[0-9a-fA-F]{64}$/.test(piiKey)) {
  problems.push(
    "PII_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)",
  );
}

// NEXT_PUBLIC_* values are inlined into client bundles at BUILD time — a
// localhost site URL would ship to production inside the JS and metadata.
// Web Push is optional, but a half-configured pair is a silent no-op.
const vapidPrivate = get("VAPID_PRIVATE_KEY");
const vapidPublic = get("VAPID_PUBLIC_KEY");
if (Boolean(vapidPrivate) !== Boolean(vapidPublic)) {
  problems.push(
    "VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY must be set together (or both omitted)",
  );
}
if (vapidPublic && !/^[A-Za-z0-9_-]{87}$/.test(vapidPublic)) {
  problems.push(
    "VAPID_PUBLIC_KEY must be a base64url P-256 public key (87 characters)",
  );
}
const vapidSubject = get("VAPID_SUBJECT");
if (vapidSubject && !/^(https:\/\/|mailto:)/.test(vapidSubject)) {
  problems.push("VAPID_SUBJECT must be an https:// or mailto: URI");
}

const siteUrl = get("NEXT_PUBLIC_SITE_URL");
if (siteUrl && /localhost|127\.0\.0\.1/.test(siteUrl)) {
  problems.push(
    "NEXT_PUBLIC_SITE_URL still points at localhost — export the production URL before deploying",
  );
}

const whatsapp = get("NEXT_PUBLIC_WHATSAPP_NUMBER");
if (whatsapp && !/^\d{10,15}$/.test(whatsapp)) {
  problems.push(
    "NEXT_PUBLIC_WHATSAPP_NUMBER must be digits only (international, no +)",
  );
}

if (!existsSync("wrangler.jsonc")) {
  problems.push("wrangler.jsonc not found — run from the repo root");
} else {
  const raw = readFileSync("wrangler.jsonc", "utf8");
  if (raw.includes("REPLACE_WITH_")) {
    const placeholders = [
      "REPLACE_WITH_REAL_HYPERDRIVE_ID",
      "REPLACE_WITH_REAL_D1_ID",
    ].filter((p) => raw.includes(p));
    problems.push(
      `wrangler.jsonc still has placeholder ids: ${placeholders.join(", ")} — create the resources first (docs/DEPLOY.md §2)`,
    );
  }
  if (!raw.includes('"main": "worker.ts"')) {
    problems.push(
      "wrangler.jsonc main must point at the custom worker.ts entry (Durable Objects)",
    );
  }
  if (!raw.includes('"class_name": "OrderFeed"')) {
    problems.push("wrangler.jsonc is missing the ORDER_FEED Durable Object");
  }
  if (!raw.includes("NEXT_TAG_CACHE_D1")) {
    problems.push("wrangler.jsonc is missing the D1 tag cache binding");
  }
}

if (problems.length > 0) {
  console.error("✗ deploy environment check failed:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log("✓ deploy environment check passed (values verified, not printed)");
