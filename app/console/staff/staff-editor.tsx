"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import {
  addStaff,
  fetchStaff,
  setStaffActive,
  type StaffRow,
} from "@/app/actions/staff";

/**
 * Staff editor (owner-only page). The PIN-uniqueness rule (spec §8.1) is
 * enforced server-side with the same verifyPin used at login.
 */

export function StaffEditor({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchStaff();
    if (res.ok) setRows(res.rows);
    else setError(res.error);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await addStaff(name.trim(), pin.trim());
    setBusy(false);
    if (res.ok) {
      setNotice(`✓ أُضيف ${name.trim()} — رمزه جاهز للدخول فوراً`);
      setName("");
      setPin("");
      await load();
    } else {
      setError(res.error ?? "تعذر الإضافة");
    }
  }

  async function toggle(row: StaffRow) {
    setBusy(true);
    const res = await setStaffActive(row.id, !row.isActive);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "تعذر التغيير");
    else setError(null);
    await load();
  }

  const inputClass =
    "min-h-12 w-full rounded-md border border-cream-300 bg-cream-50 px-4 text-sm outline-none transition-colors focus:border-basil-500";

  return (
    <div className="mt-6 space-y-4">
      {/* add form */}
      <div className="rounded-card border border-dashed border-basil-300 bg-basil-50/50 p-5">
        <p className="font-bold text-ink">إضافة موظف</p>
        <div className="mt-3 grid grid-cols-[1fr_130px_auto] items-end gap-2">
          <div>
            <label
              htmlFor="staff-name"
              className="text-xs font-bold text-ink-soft"
            >
              الاسم
            </label>
            <input
              id="staff-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="اسم الموظف"
              maxLength={60}
            />
          </div>
          <div>
            <label
              htmlFor="staff-pin"
              className="text-xs font-bold text-ink-soft"
            >
              رمز الدخول (6)
            </label>
            <input
              id="staff-pin"
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className={`mt-1 ${inputClass} font-bold tabular-nums`}
              placeholder="••••••"
              maxLength={6}
            />
          </div>
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy || name.trim().length < 2 || pin.length !== 6}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-full bg-basil-800 px-5 text-sm font-bold text-cream-50 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="size-4" aria-hidden />
            )}
            إضافة
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          الرمز فريد بين كل الموظفين النشطين — النظام يرفض أي تكرار تلقائياً.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-terracotta/10 px-4 py-3 text-sm font-bold text-terracotta"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md bg-basil-100 px-4 py-3 text-sm font-bold text-basil-800"
        >
          {notice}
        </p>
      )}

      {/* list */}
      {rows === null ? (
        <div className="flex items-center justify-center gap-2 py-10 text-ink-soft">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          جارٍ التحميل…
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-card border border-cream-200 bg-cream-50 p-4 shadow-card"
            >
              <div>
                <p className="font-bold text-ink">
                  {row.name}
                  {row.role === "owner" && (
                    <span className="ms-2 rounded-full bg-wheat-300 px-2 py-0.5 text-[10px] font-bold text-basil-950">
                      مالك
                    </span>
                  )}
                  {!row.isActive && (
                    <span className="ms-2 rounded-full bg-cream-300 px-2 py-0.5 text-[10px] font-bold text-ink-soft">
                      موقوف
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-soft">
                  {row.role === "owner"
                    ? "صلاحيات كاملة"
                    : "الطلبات والمطبخ فقط"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={row.isActive}
                aria-label={`${row.isActive ? "إيقاف" : "تفعيل"} ${row.name}`}
                disabled={busy || row.id === currentUserId}
                onClick={() => void toggle(row)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
                  row.isActive ? "bg-basil-600" : "bg-cream-400"
                }`}
              >
                <span
                  className={`absolute top-1 size-6 rounded-full bg-cream-50 shadow transition-all ${
                    row.isActive ? "start-7" : "start-1"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
