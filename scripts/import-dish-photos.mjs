#!/usr/bin/env node
/**
 * Import the curated dish photography.
 *
 * Source:  menu/<Arabic dish name>.png   (high-resolution originals, git-ignored)
 * Output:  public/media/products/<slug>.webp
 *          lib/dish-photos.generated.ts   (dimensions, placeholder colour, LQIP)
 *
 * The outputs are committed, so a deploy never depends on this script. Re-run
 * `npm run photos` after replacing a source image; the manifest is regenerated
 * deterministically and the seed attaches the new key to the product.
 *
 * Encoding contract (docs/menu-photo-prompts.md):
 *   - 4:3, 1600×1200, sRGB
 *   - WebP quality 84, metadata stripped
 *   - under 500 KB (typical output is 150–300 KB)
 *   - a 24 px inline LQIP for next/image `placeholder="blur"`
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const SOURCE_DIR = "menu";
const OUTPUT_DIR = "public/media/products";
const MANIFEST_FILE = "lib/dish-photos.generated.ts";

const TARGET_WIDTH = 1600;
const TARGET_HEIGHT = 1200;
const MAX_OUTPUT_BYTES = 500 * 1024;

/**
 * Arabic source filename → stable product slug (lib/menu-data.ts). The
 * mapping is explicit on purpose: four filenames differ from the seeded
 * Arabic name (Alfredo hamza, Stroganoff spelling, «سلطة تبولة»).
 */
const PHOTOS = {
  "باستا ليمون.png": "lemon-pasta",
  "بيني الفريدو.png": "penne-alfredo",
  "بيني بيستو.png": "penne-pesto",
  "سترجنانوف باستا.png": "stroganoff-pasta",
  "سلطة تبولة.png": "tabbouleh",
  "سموكد باستا.png": "smoked-pasta",
  "فيتوتشيني الفريدو.png": "fettuccine-alfredo",
  "فيتوتشيني بيستو.png": "fettuccine-pesto",
  "فيتوتشيني مع فطر.png": "fettuccine-mushroom",
  "كرانشي تشيز باستا.png": "crunchy-cheese-pasta",
  "موزاريلا باستا.png": "mozzarella-pasta",
  "ناجتس الدجاج.png": "chicken-nuggets",
};

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function assertSources() {
  let files;
  try {
    files = readdirSync(SOURCE_DIR).filter((file) =>
      /\.(png|jpe?g|webp)$/i.test(file),
    );
  } catch {
    fail(`Source directory "${SOURCE_DIR}/" is missing.`);
  }

  const mapped = new Set(Object.keys(PHOTOS));
  const missing = [...mapped].filter((file) => !files.includes(file));
  const unmapped = files.filter((file) => !mapped.has(file));
  if (missing.length > 0) {
    fail(`Mapped source files are missing:\n  ${missing.join("\n  ")}`);
  }
  if (unmapped.length > 0) {
    fail(
      `Unmapped source files in "${SOURCE_DIR}/":\n  ${unmapped.join("\n  ")}\n` +
        "Add each one to PHOTOS with its product slug.",
    );
  }
}

/**
 * Soft neutral sampled from the edges: the photos share a cream-linen table
 * and warm props, so this is the least surprising colour behind the LQIP.
 */
async function edgeColor(buffer) {
  const { width, height } = await sharp(buffer).metadata();
  const patch = Math.max(8, Math.round(Math.min(width, height) * 0.08));
  const corners = [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ];
  let red = 0;
  let green = 0;
  let blue = 0;
  for (const [left, top] of corners) {
    const { data } = await sharp(buffer)
      .extract({ left, top, width: patch, height: patch })
      .resize(1, 1, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    red += data[0];
    green += data[1];
    blue += data[2];
  }
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel / corners.length).toString(16))
    .map((hex) => hex.padStart(2, "0"))
    .join("")}`;
}

async function processPhoto(file, slug) {
  const source = join(SOURCE_DIR, file);
  const output = join(OUTPUT_DIR, `${slug}.webp`);

  const buffer = await sharp(source)
    .rotate()
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: "cover",
      position: "centre",
      kernel: "lanczos3",
    })
    .toColourspace("srgb")
    .webp({ quality: 84, effort: 6, smartSubsample: true })
    .toBuffer();

  const bytes = buffer.byteLength;
  if (bytes > MAX_OUTPUT_BYTES) {
    fail(
      `${slug}.webp is ${(bytes / 1024).toFixed(0)} KB — over the ` +
        `${MAX_OUTPUT_BYTES / 1024} KB budget. Lower quality or resolution.`,
    );
  }

  writeFileSync(output, buffer);

  const { width, height } = await sharp(buffer).metadata();
  const color = await edgeColor(buffer);
  const blur = await sharp(buffer)
    .resize(24, 18, { fit: "cover", position: "centre" })
    .webp({ quality: 30, effort: 4 })
    .toBuffer();
  const blurDataURL = `data:image/webp;base64,${blur.toString("base64")}`;

  return { source, output, width, height, bytes, color, blurDataURL };
}

function manifest(entries) {
  const bySlug = new Map(
    entries
      .map((entry) => [entry.slug, entry])
      .sort(([a], [b]) => a.localeCompare(b)),
  );

  const serialise = (entry, indent, objectKey) => {
    const pad = " ".repeat(indent);
    return [
      `${pad}"${objectKey}": {`,
      `${pad}  key: "media/products/${entry.slug}.webp",`,
      `${pad}  width: ${entry.width},`,
      `${pad}  height: ${entry.height},`,
      `${pad}  color: "${entry.color}",`,
      `${pad}  blurDataURL:`,
      `${pad}    "${entry.blurDataURL}",`,
      `${pad}},`,
    ].join("\n");
  };

  const bySlugBody = [...bySlug.values()]
    .map((entry) => serialise(entry, 2, entry.slug))
    .join("\n");
  const byKeyBody = [...bySlug.values()]
    .map((entry) => serialise(entry, 2, `media/products/${entry.slug}.webp`))
    .join("\n");

  return `// AUTO-GENERATED by scripts/import-dish-photos.mjs — do not edit by hand.
// Run \`npm run photos\` after replacing a source image in menu/.

/** A bundled catalog photo. Keys are public paths under /media/products/. */
export interface DishPhotoMeta {
  key: string;
  width: number;
  height: number;
  /** Warm edge tone used behind the blur placeholder while decoding. */
  color: string;
  /** Inline 24×18 WebP — small enough to ship with the JS payload. */
  blurDataURL: string;
}

/** slug → photo metadata (menu-data attaches these to the placeholder catalog). */
export const DISH_PHOTOS: Record<string, DishPhotoMeta> = {
${bySlugBody}
};

/** media key → photo metadata (the DB catalog re-attaches the LQIP by key). */
export const DISH_PHOTOS_BY_KEY: Record<string, DishPhotoMeta> = {
${byKeyBody}
};
`;
}

async function main() {
  assertSources();
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const entries = [];
  for (const [file, slug] of Object.entries(PHOTOS)) {
    const result = await processPhoto(file, slug);
    entries.push({ slug, ...result });
    console.log(
      `✓ ${file} → ${result.output}  ` +
        `${result.width}×${result.height}  ${(result.bytes / 1024).toFixed(0)} KB  ${result.color}`,
    );
  }

  writeFileSync(MANIFEST_FILE, manifest(entries));
  console.log(
    `\n✓ ${entries.length} photos imported; ${MANIFEST_FILE} refreshed.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
