import { defineConfig } from "drizzle-kit";
import { readFileSync } from "node:fs";

// Minimal .env.local parser (no dotenv dependency) — drizzle-kit only.
function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      const key = m?.[1];
      const value = m?.[2];
      if (key && value !== undefined && !process.env[key])
        process.env[key] = value.trim();
    }
  } catch {
    // .env.local absent (CI sets DATABASE_URL itself)
  }
}
loadEnvLocal();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required (set it in .env.local or the environment)",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
