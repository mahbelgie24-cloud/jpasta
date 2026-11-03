"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bike,
  ChefHat,
  Clock,
  HandPlatter,
  Loader2,
  LogOut,
  PackageCheck,
  Phone,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Price } from "@/components/ui/price";
import { formatTimeAr, timeAgoAr } from "@/lib/format";
import { loadSoundPreference, setSoundPreference } from "@/lib/alert";
import { useOrdersFeed } from "@/hooks/use-orders-feed";
import { advanceOrder, consoleLogout } from "@/app/actions/console";

/**
 * Live orders board — SSE push (~0ms after commit) with a 5s polling
 * fallback (Phase 2 DoD: ticket latency < 2s). New orders chime.
 */

const COLUMNS = [
  {
    key: "received",
    label: "وصل للتو",
    icon: Clock,
    next: "preparing",
    nextLabel: "ابدأ التحضير",
  },
  {
    key: "preparing",
    label: "جارٍ التحضير",
    icon: ChefHat,
    next: "ready",
    nextLabel: "جاهز",
  },
  {
    key: "ready",
    label: "جاهز للتسليم",
    icon: PackageCheck,
    next: "completed",
    nextLabel: "تم التسليم ✓",
  },
] as const;

export function ConsoleBoard({ ownerName }: { ownerName: string }) {
  const router = useRouter();
  const { orders, connection, lastUpdated, refresh } = useOrdersFeed({
    alertOnNew: true,
  });
  const connectionLabel =
    connection === "live"
      ? "مباشر"
      : connection === "polling"
        ? "تحديث دوري"
        : connection === "offline"
          ? "غير متصل"
          : "جارٍ الاتصال…";
  const [armedCancel, setArmedCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sound, setSound] = useState<boolean | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function move(
    orderId: string,
    next: "preparing" | "ready" | "completed" | "cancelled",
    reason?: string,
  ) {
    const current = orders?.find((o) => o.id === orderId);
    if (!current) return;
    if (next === "cancelled" && (reason?.trim().length ?? 0) < 2) {
      setActionError("سبب الإلغاء مطلوب.");
      return;
    }
    setBusyId(orderId);
    setActionError(null);
    try {
      // The expected status makes the update conditional: a second device
      // that already advanced the order gets a conflict, not a resurrection.
      const result = await advanceOrder(
        orderId,
        next,
        current.status,
        reason?.trim(),
      );
      if (!result.ok) setActionError(result.error ?? "تعذر تحديث الطلب.");
      await refresh();
    } catch {
      setActionError("تعذر تحديث الطلب — تحقق من الاتصال.");
    } finally {
      setBusyId(null);
      setArmedCancel(null);
      setCancelReason("");
    }
  }

  async function doLogout() {
    await consoleLogout();
    router.push("/console/login");
    router.refresh();
  }

  const toggleSound = () => {
    const enabled = !(sound ?? loadSoundPreference());
    setSoundPreference(enabled);
    setSound(enabled);
  };
  const soundEnabled = sound ?? loadSoundPreference();

  const byStatus = (key: string) =>
    (orders ?? []).filter((o) => o.status === key);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 pb-10 sm:px-6">
      {/* header */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-10" />
          <div>
            <p className="font-display-ar text-lg font-semibold text-basil-800">
              لوحة الطلبات
            </p>
            <p className="text-xs text-ink-soft">مرحباً {ownerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              connection === "live"
                ? "bg-basil-100 text-basil-800"
                : connection === "offline"
                  ? "bg-terracotta/10 text-terracotta"
                  : "bg-bronze/15 text-bronze"
            }`}
            aria-live="polite"
            title={
              lastUpdated
                ? `آخر تحديث ${new Date(lastUpdated).toLocaleTimeString("ar-PS")}`
                : undefined
            }
          >
            {connection === "live" ? (
              <Wifi className="size-3.5" aria-hidden />
            ) : (
              <WifiOff className="size-3.5" aria-hidden />
            )}
            {connectionLabel}
          </span>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled ? "كتم صوت التنبيه" : "تشغيل صوت التنبيه"}
            aria-pressed={soundEnabled}
            className="flex size-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-200 hover:text-ink"
          >
            {soundEnabled ? (
              <Volume2 className="size-5" aria-hidden />
            ) : (
              <VolumeX className="size-5" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={doLogout}
            aria-label="تسجيل الخروج"
            className="flex size-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-200 hover:text-terracotta"
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        </div>
      </header>
      {actionError && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-terracotta/25 bg-terracotta/10 px-4 py-3 text-sm font-bold text-terracotta"
        >
          {actionError}
        </p>
      )}

      {/* board */}
      {orders === null ? (
        <div className="flex items-center justify-center gap-2 py-24 text-ink-soft">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          جارٍ تحميل الطلبات…
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = byStatus(col.key);
            const Icon = col.icon;
            return (
              <section
                key={col.key}
                aria-label={col.label}
                className="rounded-card bg-cream-50 p-3 shadow-card"
              >
                <h2 className="flex items-center gap-2 px-2 py-2 text-sm font-bold text-ink">
                  <Icon className="size-4 text-basil-700" aria-hidden />
                  {col.label}
                  <span className="ms-auto flex size-6 items-center justify-center rounded-full bg-basil-700 text-xs font-bold text-cream-50 tabular-nums">
                    {list.length}
                  </span>
                </h2>
                <div className="mt-2 space-y-3">
                  {list.length === 0 && (
                    <p className="rounded-xl border border-dashed border-cream-300 py-8 text-center text-sm text-ink-soft">
                      لا يوجد طلبات
                    </p>
                  )}
                  {list.map((o) => (
                    <article
                      key={o.id}
                      className="rounded-xl border border-cream-200 bg-cream-100 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/console/orders/${o.id}`}
                          className="font-display text-xl font-bold text-basil-800 hover:text-basil-600"
                          dir="ltr"
                        >
                          {o.orderNumber}
                        </Link>
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                            {o.channel === "delivery" ? (
                              <>
                                <Bike className="size-3" aria-hidden /> توصيل
                              </>
                            ) : (
                              <>
                                <HandPlatter className="size-3" aria-hidden />{" "}
                                استلام
                              </>
                            )}
                          </span>
                          <span className="text-[11px] text-ink-soft">
                            {timeAgoAr(o.createdAt)} ·{" "}
                            {formatTimeAr(o.createdAt)}
                          </span>
                        </div>
                      </div>

                      <ul className="mt-2.5 space-y-1.5 border-y border-cream-200 py-2.5">
                        {o.items.map((it, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-bold text-ink">
                              {it.nameAr}{" "}
                              <span className="text-ink-soft">
                                × {it.quantity}
                              </span>
                            </span>
                            {it.detailAr && (
                              <span className="block text-xs text-ink-soft">
                                {it.detailAr}
                              </span>
                            )}
                            {it.note && (
                              <span className="block text-xs font-bold text-bronze">
                                ✎ {it.note}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-2.5 space-y-1 text-xs text-ink-soft">
                        <p className="font-bold text-ink">{o.customerName}</p>
                        <a
                          href={`tel:${o.customerPhone}`}
                          dir="ltr"
                          className="inline-flex items-center gap-1 font-bold text-basil-700 tabular-nums"
                        >
                          <Phone className="size-3" aria-hidden />
                          {o.customerPhone}
                        </a>
                        {o.address && <p>📍 {o.address}</p>}
                        {o.customerNote && (
                          <p className="font-bold text-bronze">
                            ✎ {o.customerNote}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Price
                          minor={o.totalMinor}
                          className="font-bold text-ink"
                        />
                        <div className="flex gap-2">
                          {o.status !== "ready" && (
                            <button
                              type="button"
                              onClick={() => {
                                const sameRow = armedCancel === o.id;
                                setArmedCancel(sameRow ? null : o.id);
                                setCancelReason("");
                                setActionError(null);
                              }}
                              disabled={busyId === o.id}
                              className={
                                armedCancel === o.id
                                  ? "inline-flex min-h-11 items-center gap-1 rounded-full bg-terracotta px-3.5 text-xs font-bold text-cream-50"
                                  : "inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-bold text-ink-soft hover:bg-terracotta/10 hover:text-terracotta"
                              }
                            >
                              إلغاء
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => move(o.id, col.next)}
                            disabled={busyId === o.id}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-basil-700 px-4 text-sm font-bold text-cream-50 shadow-card transition-colors hover:bg-basil-600 disabled:opacity-50"
                          >
                            {busyId === o.id ? (
                              <Loader2
                                className="size-4 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              col.nextLabel
                            )}
                          </button>
                        </div>
                      </div>

                      {armedCancel === o.id && (
                        <div className="mt-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-3">
                          <label
                            htmlFor={`cancel-reason-${o.id}`}
                            className="text-xs font-bold text-ink"
                          >
                            سبب الإلغاء (مطلوب)
                          </label>
                          <input
                            id={`cancel-reason-${o.id}`}
                            type="text"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            maxLength={140}
                            autoFocus
                            placeholder="مثال: الزبون غيّر رأيه"
                            className="mt-1.5 min-h-11 w-full rounded-md border border-cream-300 bg-cream-50 px-3 text-sm outline-none focus:border-basil-500"
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              disabled={
                                busyId === o.id ||
                                cancelReason.trim().length < 2
                              }
                              onClick={() =>
                                void move(o.id, "cancelled", cancelReason)
                              }
                              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-terracotta px-4 text-sm font-bold text-cream-50 disabled:opacity-50"
                            >
                              <X className="size-4" aria-hidden />
                              تأكيد الإلغاء
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setArmedCancel(null);
                                setCancelReason("");
                              }}
                              className="inline-flex min-h-11 items-center justify-center rounded-full border border-cream-300 px-4 text-sm font-bold text-ink-soft"
                            >
                              تراجع
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
