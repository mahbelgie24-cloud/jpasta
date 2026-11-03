"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Price } from "@/components/ui/price";
import { tryToMinorUnits, formatPrice } from "@/lib/pricing";
import {
  addZone,
  fetchZones,
  setZoneActive,
  updateZoneFee,
} from "@/app/actions/settings";

interface Zone {
  id: string;
  nameAr: string;
  feeMinor: number;
  isActive: boolean;
}

export function ZonesEditor() {
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newFee, setNewFee] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await fetchZones();
      setZones(list);
      // Preserve unsaved edits in other rows while refreshing the list.
      setDrafts((current) => {
        const server = Object.fromEntries(
          list.map((z) => [z.id, formatPrice(z.feeMinor)]),
        );
        const kept = Object.fromEntries(
          Object.entries(current).filter(([id]) =>
            list.some((zone) => zone.id === id),
          ),
        );
        return { ...server, ...kept };
      });
    } catch {
      setNotice("تعذر تحميل المناطق — حدّث الصفحة.");
    }
  }, []);

  // initial load — canonical external-system effect
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function saveFee(zone: Zone) {
    const raw = drafts[zone.id]?.trim() ?? "";
    const feeMinor = tryToMinorUnits(raw);
    if (feeMinor === null) {
      setNotice("رسوم غير صحيحة — استخدم رقماً مثل 5.00");
      return;
    }
    setRowBusy(zone.id);
    const res = await updateZoneFee(zone.id, feeMinor);
    setRowBusy(null);
    setNotice(res.ok ? "✓ حُفظت الرسوم" : (res.error ?? "تعذر الحفظ"));
    if (res.ok) {
      setZones(
        (current) =>
          current?.map((z) => (z.id === zone.id ? { ...z, feeMinor } : z)) ??
          current,
      );
      setDrafts((current) => ({
        ...current,
        [zone.id]: formatPrice(feeMinor),
      }));
    }
  }

  async function toggle(zone: Zone) {
    const next = !zone.isActive;
    setRowBusy(zone.id);
    setZones(
      (current) =>
        current?.map((z) =>
          z.id === zone.id ? { ...z, isActive: next } : z,
        ) ?? current,
    );
    const res = await setZoneActive(zone.id, next);
    setRowBusy(null);
    if (!res.ok) {
      setZones(
        (current) =>
          current?.map((z) =>
            z.id === zone.id ? { ...z, isActive: zone.isActive } : z,
          ) ?? current,
      );
      setNotice(res.error ?? "تعذر التغيير");
    }
  }

  async function create() {
    const feeMinor = tryToMinorUnits(newFee.trim() || "5");
    if (feeMinor === null) {
      setNotice("رسوم غير صحيحة — استخدم رقماً مثل 5.00");
      return;
    }
    setRowBusy("new");
    const res = await addZone(newName.trim(), feeMinor);
    setRowBusy(null);
    if (res.ok) {
      setNewName("");
      setNewFee("");
      setNotice("✓ أُضيفت المنطقة");
      await load();
    } else {
      setNotice(res.error ?? "تعذر الإضافة");
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-md border border-cream-300 bg-cream-50 px-4 text-sm outline-none transition-colors focus:border-basil-500";

  return (
    <div className="mt-6 space-y-4">
      {zones === null ? (
        <div className="flex items-center justify-center gap-2 py-12 text-ink-soft">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          جارٍ التحميل…
        </div>
      ) : (
        zones.map((zone) => (
          <div
            key={zone.id}
            className="rounded-card border border-cream-200 bg-cream-50 p-5 shadow-card"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-ink">{zone.nameAr}</p>
                <p className="text-xs text-ink-soft">
                  {zone.isActive ? "نشطة — تُطبق على الطلبات" : "موقوفة"}
                </p>
              </div>
              {/* active toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={zone.isActive}
                aria-label={`${zone.isActive ? "إيقاف" : "تفعيل"} ${zone.nameAr}`}
                disabled={rowBusy === zone.id}
                onClick={() => void toggle(zone)}
                className={`relative h-11 w-16 shrink-0 rounded-full transition-colors ${
                  zone.isActive ? "bg-basil-600" : "bg-cream-400"
                }`}
              >
                <span
                  className={`absolute top-2 size-7 rounded-full bg-cream-50 shadow transition-all ${
                    zone.isActive ? "start-7" : "start-2"
                  }`}
                />
              </button>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <label
                  htmlFor={`fee-${zone.id}`}
                  className="text-xs font-bold text-ink-soft"
                >
                  رسوم التوصيل (₪)
                </label>
                <input
                  id={`fee-${zone.id}`}
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={drafts[zone.id] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [zone.id]: e.target.value }))
                  }
                  className={`mt-1 ${inputClass} font-bold tabular-nums`}
                  maxLength={8}
                />
              </div>
              <button
                type="button"
                onClick={() => void saveFee(zone)}
                disabled={rowBusy === zone.id}
                className="inline-flex min-h-12 items-center gap-1.5 rounded-full bg-basil-700 px-5 text-sm font-bold text-cream-50 disabled:opacity-50"
              >
                {rowBusy === zone.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "حفظ"
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              الحالية المطبقة:{" "}
              <Price minor={zone.feeMinor} className="font-bold text-ink" />
            </p>
          </div>
        ))
      )}

      {/* add zone */}
      <div className="rounded-card border border-dashed border-basil-300 bg-basil-50/50 p-5">
        <p className="font-bold text-ink">إضافة منطقة</p>
        <div className="mt-3 grid grid-cols-[1fr_120px_auto] items-end gap-2">
          <div>
            <label
              htmlFor="new-zone-name"
              className="text-xs font-bold text-ink-soft"
            >
              اسم المنطقة
            </label>
            <input
              id="new-zone-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="مثال: قرية كفر ثلث"
              maxLength={60}
            />
          </div>
          <div>
            <label
              htmlFor="new-zone-fee"
              className="text-xs font-bold text-ink-soft"
            >
              الرسوم (₪)
            </label>
            <input
              id="new-zone-fee"
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={newFee}
              onChange={(e) => setNewFee(e.target.value)}
              className={`mt-1 ${inputClass} font-bold tabular-nums`}
              placeholder="5.00"
              maxLength={8}
            />
          </div>
          <button
            type="button"
            onClick={() => void create()}
            disabled={rowBusy === "new" || newName.trim().length < 2}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-full bg-basil-800 px-5 text-sm font-bold text-cream-50 disabled:opacity-50"
          >
            {rowBusy === "new" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            إضافة
          </button>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md bg-basil-100 px-4 py-3 text-center text-sm font-bold text-basil-800"
        >
          {notice}
        </p>
      )}

      <p className="text-center text-xs text-ink-soft">
        النطاق الحالي: منطقة واحدة «قلقيلية — داخل المدينة». مناطق متعددة =
        أسعار لكل حي.
      </p>
    </div>
  );
}
