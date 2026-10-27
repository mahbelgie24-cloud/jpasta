"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { addMinor, multiplyMinor, sumMinor, type Minor } from "@/lib/pricing";
import { placeStorefrontOrder } from "@/app/actions/orders";

/**
 * Manual order entry (Phase 3) — phone/walk-in orders through the SAME
 * server pipeline as the storefront: server-recomputed prices, idempotent.
 * Sized for one-hand phone use; sizes default to regular, extras optional.
 */

export interface ManualProduct {
  id: string;
  nameAr: string;
  basePriceMinor: number;
  categoryNameAr: string;
  sizeOptions: Array<{ key: string; nameAr: string; deltaMinor: number }>;
  extras: Array<{ key: string; nameAr: string; deltaMinor: number }>;
}

interface Line {
  key: string;
  product: ManualProduct;
  quantity: number;
  sizeKey: string;
  extraKeys: Set<string>;
  note: string;
}

function unitPrice(line: Line): Minor {
  const size = line.product.sizeOptions.find((s) => s.key === line.sizeKey);
  let unit = addMinor(line.product.basePriceMinor, size?.deltaMinor ?? 0);
  for (const key of line.extraKeys) {
    const extra = line.product.extras.find((x) => x.key === key);
    if (extra) unit = addMinor(unit, extra.deltaMinor);
  }
  return unit;
}

export function ManualEntry({
  products,
  ownerName,
}: {
  products: ManualProduct[];
  ownerName: string;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [orderType, setOrderType] = useState<"takeaway" | "delivery">(
    "takeaway",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<{
    orderNumber: string;
    orderId: string;
    accessToken: string;
  } | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.trim();
    return products.filter((p) => p.nameAr.includes(q));
  }, [products, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ManualProduct[]>();
    for (const p of filtered) {
      const list = map.get(p.categoryNameAr) ?? [];
      list.push(p);
      map.set(p.categoryNameAr, list);
    }
    return [...map.entries()];
  }, [filtered]);

  function addLine(product: ManualProduct) {
    setLines((prev) => {
      const existing = prev.find(
        (l) =>
          l.product.id === product.id &&
          l.sizeKey === (product.sizeOptions[0]?.key ?? "regular") &&
          l.extraKeys.size === 0 &&
          !l.note,
      );
      if (existing) {
        return prev.map((l) =>
          l === existing ? { ...l, quantity: Math.min(50, l.quantity + 1) } : l,
        );
      }
      return [
        ...prev,
        {
          key: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          product,
          quantity: 1,
          sizeKey: product.sizeOptions[0]?.key ?? "regular",
          extraKeys: new Set<string>(),
          note: "",
        },
      ];
    });
  }

  const subtotal = sumMinor(
    lines.map((l) => multiplyMinor(unitPrice(l), l.quantity)),
  );

  async function submit() {
    if (lines.length === 0) return setError("أضف صنفاً واحداً على الأقل.");
    if (name.trim().length < 2) return setError("اسم الزبون مطلوب.");
    if (phone.replace(/\D/g, "").length < 9)
      return setError("رقم هاتف الزبون مطلوب.");
    if (orderType === "delivery" && address.trim().length < 5)
      return setError("عنوان التوصيل مطلوب.");
    setError(null);
    setBusy(true);
    try {
      const result = await placeStorefrontOrder({
        idempotencyKey: crypto.randomUUID(),
        source: "console",
        channel: orderType,
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          address: orderType === "delivery" ? address.trim() : "",
        },
        note: note.trim() || undefined,
        lines: lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          note: l.note.trim() || undefined,
          selections: [
            { groupKey: "size", optionKey: l.sizeKey },
            ...[...l.extraKeys].map((k) => ({
              groupKey: "extras",
              optionKey: k,
            })),
          ],
        })),
      });
      if (result.ok) {
        setPlaced({
          orderNumber: result.order.orderNumber,
          orderId: result.order.id,
          accessToken: result.order.accessToken,
        });
        setLines([]);
        setNote("");
      } else {
        setError(result.error);
      }
    } catch {
      setError("تعذر الإرسال — تحقق من الاتصال.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-md border border-cream-300 bg-cream-50 px-4 text-sm outline-none transition-colors placeholder:text-ink-soft/50 focus:border-basil-500";

  if (placed) {
    return (
      <div className="py-8 text-center">
        <CheckCircle2 className="mx-auto size-14 text-basil-600" aria-hidden />
        <h2 className="mt-4 type-title">
          طلب {placed.orderNumber} دخل الطابور
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          يظهر الآن على لوحة الطلبات والمطبخ.
        </p>
        <div className="mx-auto mt-6 flex max-w-xs flex-col gap-3">
          <Link
            href={`/order/status/${placed.orderId}?t=${placed.accessToken}`}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-basil-700 font-bold text-cream-50"
          >
            صفحة حالة الزبون
          </Link>
          <Button variant="secondary" onClick={() => setPlaced(null)}>
            طلب جديد
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* product picker */}
      <div className="rounded-card bg-cream-50 p-4 shadow-card">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن صنف…"
          aria-label="ابحث عن صنف"
          className={inputClass}
        />
        <div className="mt-3 max-h-72 space-y-4 overflow-y-auto pe-1">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <p className="text-xs font-bold text-ink-soft">{category}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addLine(p)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-cream-300 bg-cream-100 px-3 text-xs font-bold text-ink transition-colors hover:border-basil-400"
                  >
                    <Plus className="size-3 text-basil-700" aria-hidden />
                    {p.nameAr}
                    <span dir="ltr" className="text-ink-soft tabular-nums">
                      {p.basePriceMinor / 100}₪
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* lines */}
      {lines.length > 0 && (
        <ul className="space-y-3">
          {lines.map((l) => {
            const unit = unitPrice(l);
            return (
              <li
                key={l.key}
                className="rounded-card border border-cream-200 bg-cream-50 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-ink">{l.product.nameAr}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => prev.filter((x) => x !== l))
                    }
                    aria-label={`حذف ${l.product.nameAr}`}
                    className="flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-terracotta/10 hover:text-terracotta"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                {l.product.sizeOptions.length > 1 && (
                  <div
                    className="mt-2 flex flex-wrap gap-1.5"
                    role="radiogroup"
                    aria-label="الحجم"
                  >
                    {l.product.sizeOptions.map((s) => {
                      const active = l.sizeKey === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x === l ? { ...x, sizeKey: s.key } : x,
                              ),
                            )
                          }
                          className={
                            active
                              ? "inline-flex min-h-9 items-center rounded-full border-2 border-basil-700 bg-basil-50 px-3 text-xs font-bold text-basil-800"
                              : "inline-flex min-h-9 items-center rounded-full border border-cream-300 bg-cream-100 px-3 text-xs font-bold text-ink-soft"
                          }
                        >
                          {s.nameAr}
                        </button>
                      );
                    })}
                  </div>
                )}
                {l.product.extras.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {l.product.extras.map((x) => {
                      const active = l.extraKeys.has(x.key);
                      return (
                        <button
                          key={x.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setLines((prev) =>
                              prev.map((row) => {
                                if (row !== l) return row;
                                const next = new Set(row.extraKeys);
                                if (next.has(x.key)) next.delete(x.key);
                                else next.add(x.key);
                                return { ...row, extraKeys: next };
                              }),
                            )
                          }
                          className={
                            active
                              ? "inline-flex min-h-9 items-center rounded-full border-2 border-basil-700 bg-basil-50 px-3 text-xs font-bold text-basil-800"
                              : "inline-flex min-h-9 items-center rounded-full border border-cream-300 bg-cream-100 px-3 text-xs font-bold text-ink-soft"
                          }
                        >
                          {x.nameAr}
                        </button>
                      );
                    })}
                  </div>
                )}
                <input
                  type="text"
                  value={l.note}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x) =>
                        x === l ? { ...x, note: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="ملاحظة سطر (اختياري)"
                  aria-label={`ملاحظة ${l.product.nameAr}`}
                  className={`mt-2 min-h-10 w-full rounded-md border border-cream-200 bg-cream-100 px-3 text-xs outline-none focus:border-basil-400`}
                  maxLength={140}
                />
                <div className="mt-2.5 flex items-center justify-between">
                  <div
                    className="inline-flex items-center gap-1 rounded-full border border-cream-300 p-1"
                    role="group"
                    aria-label={`كمية ${l.product.nameAr}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x === l
                              ? { ...x, quantity: Math.max(1, x.quantity - 1) }
                              : x,
                          ),
                        )
                      }
                      aria-label="إنقاص"
                      className="flex size-9 items-center justify-center rounded-full hover:bg-cream-200"
                    >
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span className="min-w-7 text-center font-bold tabular-nums">
                      {l.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x === l
                              ? { ...x, quantity: Math.min(50, x.quantity + 1) }
                              : x,
                          ),
                        )
                      }
                      aria-label="زيادة"
                      className="flex size-9 items-center justify-center rounded-full hover:bg-cream-200"
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>
                  <Price
                    minor={multiplyMinor(unit, l.quantity)}
                    className="font-bold text-ink"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* customer + submit */}
      {lines.length > 0 && (
        <div className="space-y-3 rounded-card bg-cream-50 p-4 shadow-card">
          <div
            className="grid grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="نوع الطلب"
          >
            {(
              [
                { id: "takeaway", label: "استلام" },
                { id: "delivery", label: "توصيل" },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={orderType === o.id}
                onClick={() => setOrderType(o.id)}
                className={
                  orderType === o.id
                    ? "flex min-h-11 items-center justify-center rounded-md border-2 border-basil-700 bg-basil-50 text-sm font-bold text-basil-800"
                    : "flex min-h-11 items-center justify-center rounded-md border border-cream-300 bg-cream-100 text-sm font-bold text-ink-soft"
                }
              >
                {o.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم الزبون"
            aria-label="اسم الزبون"
            className={inputClass}
            maxLength={60}
          />
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="هاتف الزبون"
            aria-label="هاتف الزبون"
            className={inputClass}
            maxLength={15}
          />
          {orderType === "delivery" && (
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="عنوان التوصيل"
              aria-label="عنوان التوصيل"
              className={inputClass}
              maxLength={140}
            />
          )}
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظات عامة (اختياري)"
            aria-label="ملاحظات عامة"
            className={inputClass}
            maxLength={200}
          />

          <div className="flex items-center justify-between border-t border-cream-200 pt-3 font-bold">
            <span>الإجمالي (رسوم التوصيل يضيفها الخادم)</span>
            <Price minor={subtotal} className="text-lg text-basil-800" />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md bg-terracotta/10 px-4 py-3 text-sm font-bold text-terracotta"
            >
              {error}
            </p>
          )}
          <Button size="lg" className="w-full" onClick={submit} disabled={busy}>
            {busy ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="size-5" aria-hidden />
            )}
            {busy ? "جارٍ الإرسال…" : "أدخل الطلب للطابور"}
          </Button>
        </div>
      )}

      <p className="text-center text-xs text-ink-soft">
        مرحباً {ownerName} — الطلبات اليدوية تمر بنفس خط أنابيب الأسعار المحمي.
      </p>
      <Link
        href="/console"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-basil-700"
      >
        <ArrowRight className="size-4" aria-hidden />
        رجوع للوحة
      </Link>
    </div>
  );
}
