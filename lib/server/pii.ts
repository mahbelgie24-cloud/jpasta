import "server-only";
import { getServerEnv } from "./env";
import { logEvent } from "./log";

/**
 * Field-level PII encryption (spec §13): customer name, phone, address and
 * note are encrypted at rest with AES-256-GCM when PII_ENCRYPTION_KEY is
 * configured. Key-gated by design so local/dev and the first deploy keep
 * working before the secret exists, and legacy rows stay readable forever.
 *
 * Storage format: "enc:v1:<iv-b64url>:<ct-b64url>" — the version prefix lets
 * a future cipher/key rotation migrate row by row. Anything without the
 * prefix is treated as legacy plaintext and returned untouched.
 *
 * AES-GCM is WebCrypto-native, so the same code runs on Workers and Node.
 * Each value gets a fresh 12-byte IV; GCM's auth tag makes tampering fail
 * the decrypt instead of returning attacker-crafted bytes.
 */

const PREFIX = "enc:v1:";

/**
 * Visible placeholder when ciphertext cannot be read (missing/rotated key,
 * malformed envelope, auth-tag failure). Returning "" silently would make a
 * key incident look like a customer who never gave a name.
 */
export const PII_UNAVAILABLE = "[تعذر فك التشفير]";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

let cachedKey: CryptoKey | null | undefined;

async function piiKey(): Promise<CryptoKey | null> {
  if (cachedKey !== undefined) return cachedKey;
  const env = await getServerEnv();
  const raw = env.PII_ENCRYPTION_KEY?.trim();
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }
  const bytes = hexToBytes(raw);
  if (!bytes || bytes.length !== 32) {
    // Fail LOUD on a misconfigured key at first use, then disable — a
    // half-valid key must never silently encrypt with garbage.
    logEvent("error", "pii.key_invalid", { length: bytes?.length ?? 0 });
    cachedKey = null;
    return cachedKey;
  }
  cachedKey = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  return cachedKey;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toB64Url(bytes: Uint8Array<ArrayBuffer>): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(value: string): Uint8Array<ArrayBuffer> | null {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const bin = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Encrypt a PII value. Local/dev may passthrough when no key is configured;
 * production MUST fail closed — a deploy without PII_ENCRYPTION_KEY would
 * otherwise store customer names, phones and addresses in cleartext.
 */
export async function encryptPii(plain: string): Promise<string> {
  if (!plain) return plain;
  const key = await piiKey();
  if (!key) {
    if (isProduction()) {
      throw new Error(
        "PII_ENCRYPTION_KEY is required in production — refusing to store plaintext PII",
      );
    }
    return plain;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain) as Uint8Array<ArrayBuffer>,
  );
  return `${PREFIX}${toB64Url(iv)}:${toB64Url(new Uint8Array(ct))}`;
}

/** Decrypt a stored value; legacy plaintext passes through untouched. */
export async function decryptPii(stored: string | null): Promise<string> {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored;
  const key = await piiKey();
  if (!key) {
    // Ciphertext without a key cannot be displayed — say so instead of
    // leaking hex soup into the UI or pretending the field was empty.
    logEvent("error", "pii.decrypt_no_key");
    return PII_UNAVAILABLE;
  }
  const [ivPart = "", ctPart = ""] = stored.slice(PREFIX.length).split(":");
  const iv = fromB64Url(ivPart);
  const ct = fromB64Url(ctPart);
  if (!iv || !ct) {
    logEvent("error", "pii.decrypt_malformed");
    return PII_UNAVAILABLE;
  }
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(plain);
  } catch {
    // Auth failure = tampered or wrong key. Never surface ciphertext as data.
    logEvent("error", "pii.decrypt_failed");
    return PII_UNAVAILABLE;
  }
}

/** Test helper — a value is ciphertext when it carries our version prefix. */
export function isEncryptedPii(stored: string): boolean {
  return stored.startsWith(PREFIX);
}
