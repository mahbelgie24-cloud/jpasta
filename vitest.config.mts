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
  // unit tests run without a DB; integration tests skip themselves
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
