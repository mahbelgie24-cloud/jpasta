#!/usr/bin/env node
/**
 * Generate the PWA/app icon set from the single source of truth (app/icon.svg).
 * Run with `npm run icons` after changing the mark.
 */
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

mkdirSync("public/icons", { recursive: true });
const svg = readFileSync("app/icon.svg");

await sharp(svg).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(svg).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(svg)
  .resize(180, 180)
  .png()
  .toFile("public/icons/apple-touch-icon.png");

// Maskable: 80% safe area on a solid brand background.
const inner = await sharp(svg).resize(410, 410).png().toBuffer();
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: "#0C2419",
  },
})
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/icons/icon-maskable-512.png");

console.log("✓ icons generated in public/icons");
