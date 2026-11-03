import { defineConfig, devices } from "@playwright/test";

/**
 * E2E / a11y / visual gates (HANDOFF §11.1, spec §18.5).
 *
 * The suite drives the production build served by `next start` on port 3220
 * (never 3000 — project runbook). Journeys run against the local Postgres
 * (Docker on :54330), the same disposable database the integration suites
 * use — never point DATABASE_URL at a real environment.
 */
const PORT = 3220;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // The E2E server is one `next start` with a 5-client Postgres pool and a
  // 210k-iteration PBKDF2 on every login. Three workers leaves headroom for
  // the archive/detail reads that now run alongside the board journeys; four
  // occasionally flaked the board assertions on a loaded host.
  workers: 3,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next start -p 3220",
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
