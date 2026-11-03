import { beforeAll, describe, expect, it } from "vitest";
import {
  createVapidAuthorization,
  fromBase64Url,
  isAllowedPushEndpoint,
  toBase64Url,
  type VapidKeys,
} from "@/lib/domain/vapid";

/**
 * A VAPID header is only useful if the push service can verify it. This
 * test signs a real P-256 key pair and verifies the JWT signature with
 * WebCrypto — the same primitive the browser/push service uses.
 */
describe("VAPID authorization", () => {
  let keys: VapidKeys;
  let publicJwk: JsonWebKey;

  beforeAll(async () => {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const privateKeyJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
    keys = {
      privateKeyJwk,
      publicKey: toBase64Url(new Uint8Array(raw)),
      subject: "https://jpasta.ps",
    };
  });

  it("produces a verifiable ES256 JWT with the endpoint origin as aud", async () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc123";
    const authorization = await createVapidAuthorization(endpoint, keys);
    expect(authorization.startsWith("vapid t=")).toBe(true);
    expect(authorization).toContain(`, k=${keys.publicKey}`);

    const jwt = authorization.slice("vapid t=".length).split(", k=")[0];
    expect(jwt).toBeTruthy();
    if (!jwt) throw new Error("missing VAPID JWT");
    const [header, payload, signature] = jwt.split(".");
    if (!header || !payload || !signature) {
      throw new Error("malformed VAPID JWT");
    }

    const claims = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload)),
    ) as { aud: string; exp: number; sub: string };
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("https://jpasta.ps");
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const verifyKey = await crypto.subtle.importKey(
      "jwk",
      publicJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      verifyKey,
      fromBase64Url(signature),
      new TextEncoder().encode(`${header}.${payload}`),
    );
    expect(valid).toBe(true);
  });

  it("base64url round-trips binary data", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(65));
    expect([...fromBase64Url(toBase64Url(bytes))]).toEqual([...bytes]);
  });
});

describe("push endpoint allowlist", () => {
  it("accepts known push services over HTTPS", () => {
    expect(
      isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"),
    ).toBe(true);
    expect(
      isAllowedPushEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/abc",
      ),
    ).toBe(true);
    expect(
      isAllowedPushEndpoint(
        "https://wns2-par02p.notify.windows.com/w/?token=x",
      ),
    ).toBe(true);
  });

  it("rejects http, arbitrary hosts, and malformed URLs", () => {
    expect(
      isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc"),
    ).toBe(false);
    expect(isAllowedPushEndpoint("https://evil.example/push")).toBe(false);
    expect(
      isAllowedPushEndpoint("https://fcm.googleapis.com.evil.example/push"),
    ).toBe(false);
    expect(isAllowedPushEndpoint("not a url")).toBe(false);
  });
});
