#!/usr/bin/env node
/**
 * Generate the favicon, Apple touch icon, PWA icons and the OG raster from
 * the single source of truth in `public/brand/`:
 *
 *   logo.svg       full roundel (wordmark + secondary line)
 *   logo-mark.svg  compact badge (no secondary line)
 *   logo-mono.svg  single-colour line art for print
 *
 * Run with `npm run icons` after changing the mark. The generated files are
 * committed so deploys never depend on this script running.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const BRAND = "public/brand";
const ICONS = "public/icons";
const APP = "app";
const BRAND_DEEP = "#0C2419";

mkdirSync(ICONS, { recursive: true });

const full = readFileSync(`${BRAND}/logo.svg`);
const mark = readFileSync(`${BRAND}/logo-mark.svg`);
const mono = readFileSync(`${BRAND}/logo-mono.svg`);

const render = (svg, size) => sharp(svg).resize(size, size).png().toBuffer();

/**
 * Opaque icon: the supplied badge is circular, so a padded centre keeps the
 * whole roundel inside the platform mask. `pct` is the badge diameter as a
 * share of the canvas; 0.78 stays inside the 80% maskable safe zone.
 */
async function opaqueIcon(svg, size, pct, background = BRAND_DEEP) {
  const inner = Math.round(size * pct);
  const badge = await render(svg, inner);
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: badge, gravity: "center" }])
    .png()
    .toBuffer();
}

/** ICO container with PNG-compressed entries (supported by every browser). */
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

// Browser tab: SVG first, ICO fallback for older user agents.
writeFileSync(`${APP}/icon.svg`, mark);
writeFileSync(
  `${APP}/favicon.ico`,
  encodeIco(
    await Promise.all(
      [16, 32, 48].map(async (size) => ({
        size,
        data: await render(mark, size),
      })),
    ),
  ),
);

// Apple: opaque 180px, full roundel on the deep brand surface.
await sharp(await opaqueIcon(full, 180, 0.86)).toFile(
  `${ICONS}/apple-touch-icon.png`,
);

// PWA "any" icons: opaque, 86% badge.
await sharp(await opaqueIcon(full, 192, 0.86)).toFile(`${ICONS}/icon-192.png`);
await sharp(await opaqueIcon(full, 512, 0.86)).toFile(`${ICONS}/icon-512.png`);

// PWA maskable: 78% keeps the roundel inside the 80% safe circle.
await sharp(await opaqueIcon(full, 192, 0.78)).toFile(
  `${ICONS}/icon-maskable-192.png`,
);
await sharp(await opaqueIcon(full, 512, 0.78)).toFile(
  `${ICONS}/icon-maskable-512.png`,
);

// Android themed icons: single-colour line art on transparency.
const monoWhite = Buffer.from(
  mono.toString("utf8").replaceAll("#143725", "#FFFFFF"),
);
const monoBadge = await render(monoWhite, 400);
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: monoBadge, gravity: "center" }])
  .png()
  .toFile(`${ICONS}/icon-monochrome-512.png`);

// Social/OG raster: transparent full roundel, 512px.
await sharp(full).resize(512, 512).png().toFile(`${BRAND}/logo-512.png`);

console.log(
  "✓ icons generated in app/ and public/icons; logo-512.png refreshed",
);
