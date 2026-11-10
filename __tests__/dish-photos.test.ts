import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { DISH_PHOTOS, DISH_PHOTOS_BY_KEY } from "@/lib/dish-photos.generated";
import { PRODUCTS, productImageSrc } from "@/lib/menu-data";

/**
 * The bundled photography is part of the seeded catalog, so a missing or
 * malformed derivative is a broken menu image, not a cosmetic warning.
 * `npm run photos` owns these files; this suite keeps the manifest, the
 * filesystem and lib/menu-data in lockstep.
 */
const MAX_BYTES = 500 * 1024;

const photos = Object.entries(DISH_PHOTOS);

describe("bundled dish photography", () => {
  it("covers every catalog product with matching alt text", () => {
    expect(photos).toHaveLength(PRODUCTS.length);
    for (const product of PRODUCTS) {
      const photo = DISH_PHOTOS[product.slug];
      expect(photo, `missing photo for ${product.slug}`).toBeDefined();
      expect(product.image).toEqual({ ...photo, alt: product.nameAr });
    }
  });

  it("ships a real 4:3 WebP inside the size budget", async () => {
    for (const [slug, photo] of photos) {
      expect(photo.key, slug).toBe(`media/products/${slug}.webp`);
      const file = join("public", photo.key);
      expect(existsSync(file), `${file} is missing`).toBe(true);

      const meta = await sharp(file).metadata();
      expect(meta.format, file).toBe("webp");
      expect(meta.width, file).toBe(1600);
      expect(meta.height, file).toBe(1200);
      expect(statSync(file).size, file).toBeLessThanOrEqual(MAX_BYTES);

      expect(photo.color, slug).toMatch(/^#[0-9a-f]{6}$/);
      expect(photo.blurDataURL, slug).toMatch(/^data:image\/webp;base64,/);
    }
  });

  it("indexes every photo by its media key", () => {
    expect(Object.keys(DISH_PHOTOS_BY_KEY)).toHaveLength(photos.length);
    for (const [, photo] of photos) {
      expect(DISH_PHOTOS_BY_KEY[photo.key]).toEqual(photo);
    }
  });

  it("resolves bundled keys and R2 uploads to the right URL", () => {
    for (const product of PRODUCTS) {
      const image = product.image;
      expect(image).toBeDefined();
      if (!image) continue;
      expect(productImageSrc(image)).toBe(
        `/media/products/${product.slug}.webp`,
      );
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    const r2Path =
      "/api/media/products/2f4c1a7e-9d1c-4b5e-8a91-0d2c3b4a5e6f.webp";
    expect(
      productImageSrc({
        key: "products/2f4c1a7e-9d1c-4b5e-8a91-0d2c3b4a5e6f.webp",
        alt: "طبق",
        width: 1600,
        height: 1200,
      }),
    ).toBe(siteUrl ? `${siteUrl}${r2Path}` : r2Path);
  });
});
