import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Service-worker regression guards.
 *
 * The media branch used to sit after the authenticated-API early return, so
 * `/api/media/*` was never intercepted and dish photos vanished offline.
 * A static assertion is enough here: the ordering of the two guards is the
 * contract, and a future refactor must not silently reintroduce the skip.
 */
const sw = readFileSync(
  fileURLToPath(new URL("../public/sw.js", import.meta.url)),
  "utf8",
);

describe("service worker caching rules", () => {
  it("handles public media before skipping /api traffic", () => {
    const media = sw.indexOf('url.pathname.startsWith("/api/media/")');
    const apiSkip = sw.indexOf('url.pathname.startsWith("/api/")');
    expect(media).toBeGreaterThan(-1);
    expect(apiSkip).toBeGreaterThan(-1);
    expect(media).toBeLessThan(apiSkip);
  });

  it("never replaces the offline shell with an error navigation", () => {
    expect(sw).toMatch(
      /if \(response\.ok\) \{\s*const copy = response\.clone\(\);/,
    );
  });

  it("never caches authenticated console or order pages", () => {
    expect(sw).toContain('url.pathname.startsWith("/console")');
    expect(sw).toContain('url.pathname.startsWith("/order/")');
  });
});
