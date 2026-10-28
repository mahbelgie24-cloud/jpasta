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
  const ext = ALLOWED[file.type];
  if (!ext) {
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

  const key = `products/${crypto.randomUUID()}.${ext}`;
  try {
    await bucket.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    return { ok: true, key };
  } catch {
    return { ok: false, error: "تعذر رفع الصورة — حاول مرة أخرى." };
  }
}
