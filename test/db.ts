/**
 * Integration tests are destructive: they TRUNCATE orders, inventory moves
 * and recipes. They may only ever run against a disposable local database.
 *
 * Resolution order:
 *   1. TEST_DATABASE_URL (explicit, CI)
 *   2. DATABASE_URL (local .env.local)
 *
 * A non-loopback host is a hard error, never a silent skip. In CI a missing
 * URL is also a hard error — a green suite must never mean "no DB coverage".
 */

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function testDatabaseUrl(): string | null {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    if (process.env.CI) {
      throw new Error(
        "CI requires TEST_DATABASE_URL: destructive integration tests must not be skipped",
      );
    }
    return null;
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("TEST_DATABASE_URL/DATABASE_URL is not a valid URL");
  }

  if (!LOOPBACK.has(host)) {
    throw new Error(
      `Refusing destructive integration tests against non-loopback host "${host}". ` +
        "Set TEST_DATABASE_URL to a disposable local database.",
    );
  }
  return url;
}

export const DB_READY: boolean = Boolean(testDatabaseUrl());
