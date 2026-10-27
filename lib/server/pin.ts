import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";

/**
 * PIN credential primitives (spec §8.5). Dependency-free (node:crypto) so
 * the seed script and the login action share the exact same format.
 * Format: "scrypt:<N>:<saltHex>:<hashHex>" — scrypt is memory-hard, the
 * per-user salt kills rainbow tables, and comparison is constant-time.
 */

const KEYLEN = 64;
const COST = 16384; // scrypt N

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEYLEN, { N: COST });
  return `scrypt:${COST}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number.parseInt(parts[1] ?? "0", 10);
  const salt = Buffer.from(parts[2] ?? "", "hex");
  const expected = Buffer.from(parts[3] ?? "", "hex");
  if (!Number.isFinite(cost) || salt.length === 0 || expected.length !== KEYLEN)
    return false;
  const actual = scryptSync(pin, salt, KEYLEN, { N: cost });
  return timingSafeEqual(actual, expected);
}

/** Session tokens are stored hashed; a DB leak cannot mint sessions. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
