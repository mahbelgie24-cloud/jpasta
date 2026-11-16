import { describe, expect, it } from "vitest";
import { resolveDbConnectionString } from "@/lib/db";

/**
 * The build phase must never read the dev proxy's local Hyperdrive binding
 * (machine-local test database — ghost catalog ids in production prerenders),
 * and the runtime must keep preferring the real binding.
 */
describe("resolveDbConnectionString", () => {
  it("build phase ignores the Hyperdrive binding entirely", () => {
    expect(
      resolveDbConnectionString(
        "phase-production-build",
        "postgres://local/test",
        "postgres://neon/prod",
      ),
    ).toBe("postgres://neon/prod");
    // Even when the deploy shell has no DATABASE_URL, the local URL must
    // never leak into a build.
    expect(
      resolveDbConnectionString(
        "phase-production-build",
        "postgres://local/test",
        undefined,
      ),
    ).toBeUndefined();
  });

  it("runtime prefers the (real) Hyperdrive binding", () => {
    expect(
      resolveDbConnectionString(
        undefined,
        "postgres://neon/prod",
        "postgres://neon/fallback",
      ),
    ).toBe("postgres://neon/prod");
  });

  it("runtime falls back to DATABASE_URL without a binding (Node scripts)", () => {
    expect(
      resolveDbConnectionString(
        undefined,
        undefined,
        "postgres://neon/fallback",
      ),
    ).toBe("postgres://neon/fallback");
    expect(
      resolveDbConnectionString(undefined, undefined, undefined),
    ).toBeUndefined();
  });

  it("keeps Hyperdrive priority for every non-build phase", () => {
    // `next start` (local E2E) and `next dev` both load the dev proxy with a
    // loopback Hyperdrive binding on purpose — only the build phase is special.
    for (const phase of ["phase-production-server", "phase-development", ""]) {
      expect(
        resolveDbConnectionString(
          phase,
          "postgres://local/test",
          "postgres://neon/prod",
        ),
      ).toBe("postgres://local/test");
    }
    // Unknown phase strings must not accidentally switch to build mode.
    expect(
      resolveDbConnectionString(
        "phase-production-buil",
        "postgres://local/test",
        "postgres://neon/prod",
      ),
    ).toBe("postgres://local/test");
  });
});
