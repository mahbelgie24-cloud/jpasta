#!/usr/bin/env node
/**
 * Generate a VAPID P-256 key pair for Web Push.
 *
 *   npm run vapid
 *
 * Copy the three lines into `.env.local` and the production secrets. The
 * private key is a JWK JSON string; never commit it. Rotating the pair
 * invalidates every existing browser subscription (users must re-enable).
 */
const pair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const rawPublic = await crypto.subtle.exportKey("raw", pair.publicKey);
const publicKey = Buffer.from(rawPublic).toString("base64url");

console.log(`VAPID_PRIVATE_KEY=${JSON.stringify(privateJwk)}`);
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log("VAPID_SUBJECT=https://jpasta.ps");
console.log("");
console.log(
  "Set these with `wrangler secret put` (private) and the public var (public).",
);
