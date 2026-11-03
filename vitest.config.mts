import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Minimal .env.local loader (no dotenv dependency)
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    const key = m?.[1];
    const value = m?.[2];
    if (key && value !== undefined && !process.env[key])
      process.env[key] = value.trim();
  }
} catch {
  // .env.local is optional outside CI.
}

// Destructive integration suites (TRUNCATE orders …) must never run against
// a real database. TEST_DATABASE_URL wins; otherwise the local DATABASE_URL
// must be loopback. In CI a missing URL is a hard failure, not a skip.
const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
if (testUrl) {
  const host = new URL(testUrl).hostname;
  if (!LOOPBACK.has(host)) {
    throw new Error(
      `Refusing destructive tests against non-loopback host "${host}". ` +
        "Set TEST_DATABASE_URL to a disposable local database.",
    );
  }
  process.env.DATABASE_URL = testUrl;
} else if (process.env.CI) {
  throw new Error(
    "CI requires TEST_DATABASE_URL — integration tests must not be skipped",
  );
}

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    // The integration suites share one seeded database and TRUNCATE orders
    // in beforeAll — parallel files would truncate each other mid-run.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
      "@": root,
    },
  },
});
