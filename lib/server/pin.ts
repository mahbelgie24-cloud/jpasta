import {
  hmacSha256Hex,
  sha256Hex,
  timingSafeEqualText,
} from "@/lib/domain/hash";
import { getServerEnv } from "./env";

/**
 * PIN credential primitives (spec §8.5).
 *
 * Everything on the hot path is WebCrypto-only so the same code runs on the
 * Workers runtime and Node without relying on Node built-ins:
 *
 *   hashPin     PBKDF2-HMAC-SHA256, 210k iterations, per-user random salt
 *   verifyPin   constant-time hex comparison (no Buffer)
 *   hashToken   SHA-256 of the opaque session cookie
 *   newSession 32 random bytes, base64url (crypto.getRandomValues)
 *
 * Format: "pbkdf2:<iterations>:<saltHex>:<hashHex>"
 *         "scrypt:<N>:<saltHex>:<hashHex>" (legacy, Node-only upgrade path)
 *
 * The legacy scrypt verifier is imported lazily: workerd does not implement
 * `scryptSync`, and a top-level named import of a missing export can fail at
 * module instantiation. On Workers the dynamic import is caught and the
 * legacy branch fails closed; the owner is re-provisioned to PBKDF2 by the
 * seed (`npm run db:seed -- --provision`).
 */

const PBKDF2_ITERATIONS = 210_000;
const KEYLEN = 32;
const SALT_BYTES = 16;

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
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
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(
    new Uint8Array(bits),
  )}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  const scheme = parts[0];

  if (scheme === "pbkdf2") {
    const iterations = Number.parseInt(parts[1] ?? "0", 10);
    const salt = fromHex(parts[2] ?? "");
    const expectedHex = parts[3] ?? "";
    if (
      !Number.isFinite(iterations) ||
      iterations < 1000 ||
      // A tampered/legacy row with a billion iterations would turn login
      // into a CPU denial of service. 2M is far above the current 210k.
      iterations > 2_000_000 ||
      !salt ||
      !fromHex(expectedHex) ||
      expectedHex.length !== KEYLEN * 2
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
    return timingSafeEqualText(toHex(new Uint8Array(bits)), expectedHex);
  }

  if (scheme === "scrypt") {
    // Legacy v1 hash — Node only. Import lazily so the Workers bundle never
    // evaluates a missing named export at instantiation time.
    const cost = Number.parseInt(parts[1] ?? "0", 10);
    const salt = fromHex(parts[2] ?? "");
    const expectedHex = parts[3] ?? "";
    if (
      !Number.isFinite(cost) ||
      cost < 1024 ||
      // Same reasoning as the PBKDF2 cap: a tampered legacy row must not
      // turn login into an unbounded memory/CPU allocation (CWE-400).
      cost > 1_048_576 ||
      !salt ||
      !fromHex(expectedHex) ||
      expectedHex.length !== 128
    ) {
      return false;
    }
    try {
      const { scryptSync } = await import("node:crypto");
      const actual = scryptSync(pin, salt, 64, { N: cost });
      return timingSafeEqualText(toHex(new Uint8Array(actual)), expectedHex);
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
  if (process.env.NODE_ENV === "production" && pepper.length < 32) {
    // A short pepper is a forgeable lookup key: pin_lookup is readable in
    // the database, so the pepper is the only thing protecting the mapping.
    throw new Error("AUTH_PEPPER must be at least 32 characters in production");
  }
  return hmacSha256Hex(pin, pepper);
}

export function isLegacyLookup(value: string): boolean {
  return value.startsWith("legacy:");
}

/** Session tokens are stored hashed; a DB leak cannot mint sessions. */
export async function hashToken(token: string): Promise<string> {
  return sha256Hex(token);
}

export function newSessionToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}
