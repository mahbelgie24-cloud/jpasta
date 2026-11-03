import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * PII_ENCRYPTION_KEY is a production requirement, not an opt-in. A deploy
 * without it must refuse to write customer fields rather than store them in
 * cleartext. Local/dev may keep the key-gated passthrough.
 */
describe("PII key enforcement", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("refuses to encrypt without a key in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    vi.resetModules();

    const { encryptPii, decryptPii, PII_UNAVAILABLE } = await import(
      "@/lib/server/pii"
    );

    await expect(encryptPii("0599000000")).rejects.toThrow(
      /PII_ENCRYPTION_KEY/,
    );
    expect(await decryptPii("enc:v1:aaaa:bbbb")).toBe(PII_UNAVAILABLE);
  });

  it("keeps the key-gated passthrough in local/dev", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    vi.resetModules();

    const { encryptPii } = await import("@/lib/server/pii");
    expect(await encryptPii("0599000000")).toBe("0599000000");
  });
});
