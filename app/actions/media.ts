"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireOwner } from "@/lib/server/session";
import { userMessageOf } from "@/lib/server/guard";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Magic-byte sniffing. `File.type` is client-supplied and trivially spoofed;
 * a stored HTML/SVG payload labelled image/jpeg would still be served from
 * our own origin. Only real raster signatures are accepted, and the stored
 * Content-Type is the sniffed one — never the browser's claim.
 */
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (ascii(4, 8) === "ftyp") {
    const brands = ascii(8, Math.min(bytes.length, 40));
    if (brands.includes("avif") || brands.includes("avis")) {
      return "image/avif";
    }
  }
  return null;
}

/**
 * Upload a dish photo to R2. Owner-only, MIME- and size-validated.
 * The key is returned so the menu editor can attach it to a product.
 */
export async function uploadProductImage(
  formData: FormData,
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  try {
    await requireOwner();
  } catch (err) {
    return { ok: false, error: userMessageOf(err) };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "اختر صورة أولاً." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "حجم الصورة يجب أن يكون أقل من 8 ميغابايت." };
  }
  if (!ALLOWED[file.type]) {
    return {
      ok: false,
      error: "الصيغة غير مدعومة — استخدم JPG أو PNG أو WebP.",
    };
  }

  let bucket: R2Bucket | undefined;
  try {
    bucket = getCloudflareContext().env.MEDIA as R2Bucket | undefined;
  } catch {
    bucket = undefined;
  }
  if (!bucket) {
    return {
      ok: false,
      error: "تخزين الصور (R2) غير مهيأ على هذه البيئة.",
    };
  }

  const buffer = await file.arrayBuffer();
  const sniffed = sniffImageType(new Uint8Array(buffer));
  if (!sniffed) {
    return {
      ok: false,
      error: "الملف ليس صورة صالحة (JPG/PNG/WebP/AVIF).",
    };
  }
  const ext = ALLOWED[sniffed];
  if (!ext) {
    return { ok: false, error: "الصيغة غير مدعومة." };
  }
  if (file.type !== sniffed) {
    // Declared type and actual bytes disagree — refuse rather than guess.
    return { ok: false, error: "نوع الملف لا يطابق محتواه." };
  }

  const key = `products/${crypto.randomUUID()}.${ext}`;
  try {
    await bucket.put(key, buffer, {
      httpMetadata: { contentType: sniffed },
    });
    return { ok: true, key };
  } catch {
    return { ok: false, error: "تعذر رفع الصورة — حاول مرة أخرى." };
  }
}
