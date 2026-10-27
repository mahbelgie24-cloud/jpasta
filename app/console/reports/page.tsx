import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Bike,
  HandPlatter,
  Receipt,
  TrendingUp,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Price } from "@/components/ui/price";
import { ConsoleNav } from "@/components/console/console-nav";
import { getSessionUser } from "@/lib/server/session";
import {
  getBestSellers,
  getDaySummary,
  getRecentDays,
  getZSummary,
  todayLocal,
} from "@/lib/server/reports";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "التقارير",
  robots: { index: false, follow: false },
};

function shiftDay(dateStr: string, delta: number): string {
  const parts = dateStr.split("-").map((n) => Number.parseInt(n, 10));
  const d = new Date(
    parts[0] ?? 1970,
    (parts[1] ?? 1) - 1,
    (parts[2] ?? 1) + delta,
  );
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAY_NAMES = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/console/login");
  if (user.role !== "owner") redirect("/console");

  const params = await searchParams;
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayLocal();

  const [summary, week, bestSellers, z] = await Promise.all([
    getDaySummary(date),
    getRecentDays(7, date),
    getBestSellers(date),
    getZSummary(date),
  ]);

  const maxRevenue = Math.max(...week.map((d) => d.revenueMinor), 1);
  const dayName = DAY_NAMES[new Date(`${date}T12:00:00`).getDay()] ?? "";

  return (
    <div className="min-h-dvh bg-cream-100">
      <div className="mx-auto max-w-3xl px-4 pt-5 pb-16 sm:px-6">
        <Link
          href="/console"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-basil-700 hover:text-basil-600"
        >
          <ArrowLeft className="size-4" aria-hidden />
          رجوع للوحة
        </Link>
        <h1 className="mt-4 type-section text-ink">التقارير</h1>
        <ConsoleNav role={user.role} />

        {/* date navigation */}
        <div className="mt-4 flex items-center justify-between gap-2 rounded-card bg-cream-50 p-3 shadow-card">
          <Link
            href={`/console/reports?date=${shiftDay(date, -1)}`}
            className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-basil-700 hover:bg-basil-50"
          >
            ← اليوم السابق
          </Link>
          <div className="text-center">
            <p className="font-bold text-ink">{dayName}</p>
            <p dir="ltr" className="text-sm text-ink-soft tabular-nums">
              {date}
            </p>
          </div>
          <Link
            href={`/console/reports?date=${shiftDay(date, 1)}`}
            aria-disabled={date >= todayLocal()}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold ${date >= todayLocal() ? "pointer-events-none text-ink-soft opacity-30" : "text-basil-700 hover:bg-basil-50"}`}
          >
            اليوم التالي →
          </Link>
        </div>

        {/* summary cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-card bg-cream-50 p-4 text-center shadow-card">
            <TrendingUp className="mx-auto size-5 text-basil-700" aria-hidden />
            <p className="mt-2 text-2xl font-extrabold text-ink tabular-nums">
              {summary.orderCount}
            </p>
            <p className="text-xs font-bold text-ink-soft">طلب</p>
          </div>
          <div className="rounded-card bg-cream-50 p-4 text-center shadow-card">
            <Banknote className="mx-auto size-5 text-basil-700" aria-hidden />
            <Price
              minor={summary.revenueMinor}
              className="mt-2 text-lg font-extrabold text-basil-800"
            />
            <p className="text-xs font-bold text-ink-soft">الإيراد</p>
          </div>
          <div className="rounded-card bg-cream-50 p-4 text-center shadow-card">
            <Bike className="mx-auto size-5 text-basil-700" aria-hidden />
            <p className="mt-2 text-2xl font-extrabold text-ink tabular-nums">
              {summary.deliveryCount}
            </p>
            <p className="text-xs font-bold text-ink-soft">توصيل</p>
          </div>
          <div className="rounded-card bg-cream-50 p-4 text-center shadow-card">
            <HandPlatter
              className="mx-auto size-5 text-basil-700"
              aria-hidden
            />
            <p className="mt-2 text-2xl font-extrabold text-ink tabular-nums">
              {summary.takeawayCount}
            </p>
            <p className="text-xs font-bold text-ink-soft">استلام</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Z summary */}
          <div className="rounded-card border border-basil-200 bg-basil-50 p-5">
            <h2 className="flex items-center gap-2 font-bold text-basil-800">
              <Receipt className="size-4" aria-hidden />
              جردة نهاية اليوم (Z)
            </h2>
            <p className="mt-3 text-3xl font-extrabold text-basil-800 tabular-nums">
              <Price minor={z.cashMinor} />
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              نقداً من {z.cashCount} طلب — قارنها مع عدّ الدرج يدوياً
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              منها رسوم توصيل:{" "}
              <Price minor={z.deliveryFeesMinor} className="font-bold" />
            </p>
          </div>

          {/* cancelled */}
          <div className="rounded-card border border-cream-200 bg-cream-50 p-5 shadow-card">
            <h2 className="flex items-center gap-2 font-bold text-ink">
              <XCircle className="size-4 text-terracotta" aria-hidden />
              الملغاة
            </h2>
            <p className="mt-3 text-3xl font-extrabold text-ink tabular-nums">
              {summary.cancelledCount}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              بقيمة{" "}
              <Price
                minor={summary.cancelledMinor}
                className="font-bold text-ink"
              />{" "}
              (خارج الإيراد)
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              متوسط الطلب:{" "}
              <Price minor={summary.avgOrderMinor} className="font-bold" />
            </p>
          </div>
        </div>

        {/* 7-day bars */}
        <div className="mt-4 rounded-card bg-cream-50 p-5 shadow-card">
          <h2 className="font-bold text-ink">آخر ٧ أيام</h2>
          <ul className="mt-4 space-y-2.5">
            {week.map((d) => (
              <li key={d.date} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs font-bold text-ink-soft">
                  {DAY_NAMES[new Date(`${d.date}T12:00:00`).getDay()]}
                </span>
                <div className="h-6 flex-1 overflow-hidden rounded-full bg-cream-200">
                  <div
                    className={`h-full rounded-full ${d.date === date ? "bg-basil-700" : "bg-basil-400"}`}
                    style={{
                      width: `${Math.round((d.revenueMinor / maxRevenue) * 100)}%`,
                    }}
                    role="img"
                    aria-label={`${d.date}: ${d.orderCount} طلب`}
                  />
                </div>
                <Price
                  minor={d.revenueMinor}
                  className="w-20 shrink-0 justify-end text-xs font-bold text-ink"
                />
              </li>
            ))}
          </ul>
        </div>

        {/* best sellers */}
        <div className="mt-4 rounded-card bg-cream-50 p-5 shadow-card">
          <h2 className="font-bold text-ink">الأكثر مبيعاً اليوم</h2>
          {bestSellers.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">
              لا مبيعات في هذا اليوم بعد.
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {bestSellers.map((b, i) => (
                <li key={b.nameAr} className="flex items-center gap-3 text-sm">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-basil-100 font-display font-bold text-basil-800">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-bold text-ink">{b.nameAr}</span>
                  <span className="text-ink-soft">× {b.qty}</span>
                  <Price
                    minor={b.revenueMinor}
                    className="font-bold text-ink"
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
