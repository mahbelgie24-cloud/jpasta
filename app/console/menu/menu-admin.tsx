"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Switch } from "@/components/ui/switch";
import { TextField } from "@/components/ui/field";
import { formatPrice, tryToMinorUnits } from "@/lib/pricing";
import {
  fetchAdminProducts,
  setProductAvailability,
  setProductImage,
  setProductPrice,
  type AdminProduct,
} from "@/app/actions/menu-admin";
import { uploadProductImage } from "@/app/actions/media";

/**
 * Menu manager v1 — availability toggles + price edits. Every price change
 * writes an audited price_changes row server-side (old → new, who, when).
 */

/** Read the real pixel size before the upload so the DB never guesses 4:3. */
async function readImageSize(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

export function MenuAdmin() {
  const [rows, setRows] = useState<AdminProduct[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetchAdminProducts();
    if (res.ok) {
      setRows(res.rows);
      setDrafts(
        Object.fromEntries(
          res.rows.map((r) => [r.id, formatPrice(r.basePriceMinor)]),
        ),
      );
    } else {
      setNotice(res.error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    void load();
  }, [load]);

  async function toggle(row: AdminProduct) {
    const next = !row.isAvailable;
    setBusyId(row.id);
    // Optimistic: the switch responds immediately, then reconciles.
    setRows(
      (current) =>
        current?.map((r) =>
          r.id === row.id ? { ...r, isAvailable: next } : r,
        ) ?? current,
    );
    const res = await setProductAvailability(row.id, next);
    setBusyId(null);
    if (!res.ok) {
      setRows(
        (current) =>
          current?.map((r) =>
            r.id === row.id ? { ...r, isAvailable: row.isAvailable } : r,
          ) ?? current,
      );
      setNotice(res.error ?? "تعذر تحديث التوفر.");
    }
  }

  async function savePrice(row: AdminProduct) {
    const raw = drafts[row.id]?.trim() ?? "";
    const minor = tryToMinorUnits(raw);
    if (minor === null) {
      setNotice(`سعر ${row.nameAr} غير صحيح — استخدم رقماً مثل 24.00`);
      return;
    }
    setBusyId(row.id);
    const res = await setProductPrice(row.id, minor);
    setBusyId(null);
    setNotice(
      res.ok
        ? `✓ حُفظ سعر ${row.nameAr} (مسجّل في سجل التدقيق)`
        : (res.error ?? "تعذر الحفظ"),
    );
    if (res.ok) {
      // Update only this row — reloading the list would wipe unsaved drafts
      // in every other row (v1 defect).
      setRows(
        (current) =>
          current?.map((r) =>
            r.id === row.id ? { ...r, basePriceMinor: minor } : r,
          ) ?? current,
      );
      setDrafts((current) => ({ ...current, [row.id]: formatPrice(minor) }));
    }
  }

  async function uploadImage(row: AdminProduct, file: File) {
    setBusyId(row.id);
    const size = await readImageSize(file);
    const form = new FormData();
    form.set("file", file);
    const uploaded = await uploadProductImage(form);
    if (!uploaded.ok) {
      setBusyId(null);
      setNotice(uploaded.error);
      return;
    }
    const res = await setProductImage(row.id, {
      key: uploaded.key,
      alt: row.nameAr,
      ...(size ?? {}),
    });
    setBusyId(null);
    setNotice(
      res.ok ? `✓ حُفظت صورة ${row.nameAr}` : (res.error ?? "تعذر حفظ الصورة"),
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md bg-brand-subtle px-4 py-3 text-sm font-bold text-brand-strong"
        >
          {notice}
        </p>
      )}

      {rows === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-secondary">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          جارٍ التحميل…
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="rounded-card border border-border-soft bg-surface p-4 shadow-card"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-text-primary">
                  {row.nameAr}
                </p>
                <p className="text-xs text-text-secondary">
                  {row.categoryNameAr}
                </p>
              </div>
              <Switch
                checked={row.isAvailable}
                onCheckedChange={() => void toggle(row)}
                label={row.nameAr}
                disabled={busyId === row.id}
              />
            </div>
            <div className="mt-3 flex items-end gap-2">
              <div className="w-32">
                <TextField
                  id={`price-${row.id}`}
                  label="السعر (₪)"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={drafts[row.id] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [row.id]: e.target.value }))
                  }
                  className="min-h-11 px-3 font-bold tabular-nums"
                  maxLength={8}
                />
              </div>
              <Button
                onClick={() => void savePrice(row)}
                disabled={busyId === row.id}
                className="min-h-11 px-4"
              >
                {busyId === row.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "حفظ"
                )}
              </Button>
              <div className="ms-auto pb-1 text-xs text-text-secondary">
                الحالي:{" "}
                <Price
                  minor={row.basePriceMinor}
                  className="font-bold text-text-primary"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 border-t border-border-soft pt-3">
              <label
                htmlFor={`image-${row.id}`}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-xs font-bold text-text-secondary transition-colors hover:border-brand-soft hover:text-text-primary"
              >
                رفع صورة الطبق
              </label>
              <input
                id={`image-${row.id}`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                disabled={busyId === row.id}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(row, file);
                  event.target.value = "";
                }}
              />
              <span className="text-[11px] text-text-secondary">
                JPG / PNG / WebP — حتى 8MB
              </span>
            </div>
            {!row.isAvailable && (
              <p className="mt-2 text-xs font-bold text-warning">
                مخفي عن الزبائن الآن — يظهر فور إعادة التفعيل.
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
