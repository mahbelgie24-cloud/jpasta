import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { hmacSha256Hex } from "@/lib/domain/hash";
import { requireSecret } from "./env";
import { verifyPin } from "./pin";

/**
 * PIN hashing for the Workers runtime.
 *
 * Workers Free rejects WebCrypto PBKDF2 above 100k iterations, and the app
 * deliberately uses 210k. Hashing instead runs bcrypt (cost 12) inside
 * Postgres via pgcrypto. The input is a peppered HMAC of the PIN, so the raw
 * PIN never leaves the Worker and a DB-only leak still needs AUTH_PEPPER.
 *
 * Format: "bcrypt:$2a$12$..." — the legacy pbkdf2:/scrypt: verifiers remain
 * in ./pin.ts for local tests and pre-v2 rows.
 */

const PREFIX = "bcrypt:";
const BCRYPT_COST = 12;

async function pepperedPin(pin: string): Promise<string> {
  const pepper = await requireSecret("AUTH_PEPPER", 32);
  // Domain-separated from pinLookup's HMAC(pin, pepper).
  return hmacSha256Hex(`bcrypt:${pin}`, pepper);
}

export async function hashPinStored(pin: string): Promise<string> {
  const input = await pepperedPin(pin);
  const result = await db.execute<{ hash: string }>(
    sql`select crypt(${input}, gen_salt('bf', ${BCRYPT_COST})) as hash`,
  );
  const hash = result.rows[0]?.hash;
  if (!hash) throw new Error("bcrypt hashing failed — is pgcrypto installed?");
  return `${PREFIX}${hash}`;
}

export async function verifyPinStored(
  pin: string,
  stored: string,
): Promise<boolean> {
  if (!stored.startsWith(PREFIX)) return verifyPin(pin, stored);
  const hash = stored.slice(PREFIX.length);
  const input = await pepperedPin(pin);
  const result = await db.execute<{ ok: boolean }>(
    sql`select crypt(${input}, ${hash}) = ${hash} as ok`,
  );
  return Boolean(result.rows[0]?.ok);
}
