import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { hmacSha256Hex } from "@/lib/domain/hash";
import { getServerEnv } from "./env";

/**
 * PIN credential primitives (spec §8.5).
 *
 * v2 uses PBKDF2-HMAC-SHA256 via WebCrypto: fully supported on Workers and
 * Node, and fast enough for a 6-digit PIN when combined with the login
 * throttle. Legacy v1 hashes ("scrypt:…") are still verified so existing
 * users can sign in; they are upgraded on the next PIN reset/provision.
 *
 * Format: "pbkdf2:<iterations>:<saltHex>:<hashHex>"
 *         "scrypt:<N>:<saltHex>:<hashHex>" (legacy)
 */

const PBKDF2_ITERATIONS = 210_000;
const KEYLEN = 32;

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    KEYLEN * 8,
  );
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt.toString("hex")}:${toHex(
    new Uint8Array(bits),
  )}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  const scheme = parts[0];

  if (scheme === "pbkdf2") {
    const iterations = Number.parseInt(parts[1] ?? "0", 10);
    const salt = Buffer.from(parts[2] ?? "", "hex");
    const expected = Buffer.from(parts[3] ?? "", "hex");
    if (
      !Number.isFinite(iterations) ||
      iterations < 1000 ||
      salt.length === 0 ||
      expected.length !== KEYLEN
    ) {
      return false;
    }
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(pin),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      key,
      KEYLEN * 8,
    );
    return timingSafeEqual(Buffer.from(new Uint8Array(bits)), expected);
  }

  if (scheme === "scrypt") {
    // Legacy v1 hash. scryptSync is available on Node; on runtimes without
    // it we fail closed (the owner is re-provisioned to PBKDF2 by the seed).
    const cost = Number.parseInt(parts[1] ?? "0", 10);
    const salt = Buffer.from(parts[2] ?? "", "hex");
    const expected = Buffer.from(parts[3] ?? "", "hex");
    if (!Number.isFinite(cost) || salt.length === 0 || expected.length !== 64) {
      return false;
    }
    try {
      const actual = scryptSync(pin, salt, 64, { N: cost });
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * O(1) login lookup key: HMAC-SHA256(pin, AUTH_PEPPER).
 *
 * The unique index on users.pin_lookup makes PIN uniqueness a database
 * guarantee (no O(users) scan at login), and the pepper means the stored
 * value cannot be rainbow-tabled back to a 6-digit PIN.
 */
export async function pinLookup(pin: string): Promise<string> {
  const env = await getServerEnv();
  const pepper = env.AUTH_PEPPER;
  if (!pepper) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_PEPPER is not configured");
    }
    // Local dev / tests only — never reaches production.
    return hmacSha256Hex(pin, "jpasta-dev-pepper");
  }
  return hmacSha256Hex(pin, pepper);
}

export function isLegacyLookup(value: string): boolean {
  return value.startsWith("legacy:");
}

/** Session tokens are stored hashed; a DB leak cannot mint sessions. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
