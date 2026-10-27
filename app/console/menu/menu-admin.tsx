"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Price } from "@/components/ui/price";
import { formatPrice, toMinorUnits } from "@/lib/pricing";
import {
  fetchAdminProducts,
  setProductAvailability,
  setProductPrice,
  type AdminProduct,
} from "@/app/actions/menu-admin";

/**
 * Menu manager v1 — availability toggles + price edits. Every price change
 * writes an audited price_changes row server-side (old → new, who, when).
 */

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
    setBusyId(row.id);
    await setProductAvailability(row.id, !row.isAvailable);
    setBusyId(null);
    await load();
  }

  async function savePrice(row: AdminProduct) {
    const raw = drafts[row.id]?.trim() ?? "";
    const minor = toMinorUnits(raw);
    setBusyId(row.id);
    const res = await setProductPrice(row.id, minor);
    setBusyId(null);
    setNotice(
      res.ok
        ? `✓ حُفظ سعر ${row.nameAr} (مسجّل في سجل التدقيق)`
        : (res.error ?? "تعذر الحفظ"),
    );
    if (res.ok) await load();
  }

  const inputClass =
    "min-h-11 w-full rounded-md border border-cream-300 bg-cream-50 px-3 text-sm outline-none transition-colors focus:border-basil-500";

  return (
    <div className="mt-4 space-y-3">
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md bg-basil-100 px-4 py-3 text-sm font-bold text-basil-800"
        >
          {notice}
        </p>
      )}

      {rows === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-ink-soft">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          جارٍ التحميل…
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="rounded-card border border-cream-200 bg-cream-50 p-4 shadow-card"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{row.nameAr}</p>
                <p className="text-xs text-ink-soft">{row.categoryNameAr}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={row.isAvailable}
                aria-label={`${row.isAvailable ? "إخفاء" : "إظهار"} ${row.nameAr}`}
                disabled={busyId === row.id}
                onClick={() => void toggle(row)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                  row.isAvailable ? "bg-basil-600" : "bg-cream-400"
                }`}
              >
                <span
                  className={`absolute top-1 size-6 rounded-full bg-cream-50 shadow transition-all ${
                    row.isAvailable ? "start-7" : "start-1"
                  }`}
                />
              </button>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <div className="w-32">
                <label
                  htmlFor={`price-${row.id}`}
                  className="text-xs font-bold text-ink-soft"
                >
                  السعر (₪)
                </label>
                <input
                  id={`price-${row.id}`}
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={drafts[row.id] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [row.id]: e.target.value }))
                  }
                  className={`mt-1 ${inputClass} font-bold tabular-nums`}
                  maxLength={8}
                />
              </div>
              <button
                type="button"
                onClick={() => void savePrice(row)}
                disabled={busyId === row.id}
                className="inline-flex min-h-11 items-center rounded-full bg-basil-700 px-4 text-sm font-bold text-cream-50 disabled:opacity-50"
              >
                {busyId === row.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "حفظ"
                )}
              </button>
              <div className="ms-auto text-xs text-ink-soft">
                الحالي:{" "}
                <Price
                  minor={row.basePriceMinor}
                  className="font-bold text-ink"
                />
              </div>
            </div>
            {!row.isAvailable && (
              <p className="mt-2 text-xs font-bold text-bronze">
                مخفي عن الزبائن الآن — يظهر فور إعادة التفعيل.
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
