"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import {
  addMinor,
  formatPrice,
  multiplyMinor,
  sumMinor,
  type Minor,
} from "@/lib/pricing";
import { fetchDeliveryZones, placeConsoleOrder } from "@/app/actions/orders";
import { arabicIncludes } from "@/lib/arabic";
import { nextIdempotencyScope, type IdempotencyScope } from "@/lib/idempotency";

/**
 * Manual order entry (Phase 3) — phone/walk-in orders through the SAME
 * server pipeline as the storefront: server-recomputed prices, idempotent.
 * Sized for one-hand phone use; required groups must be chosen before submit.
 */

export interface ManualOption {
  key: string;
  nameAr: string;
  deltaMinor: number;
}

export interface ManualGroup {
  key: string;
  nameAr: string;
  type: "single" | "multi";
  required: boolean;
  maxSelections?: number;
  options: ManualOption[];
}

export interface ManualProduct {
  id: string;
  nameAr: string;
  basePriceMinor: number;
  categoryNameAr: string;
  groups: ManualGroup[];
}

interface LineSelection {
  groupKey: string;
  optionKey: string;
}

interface Line {
  key: string;
  product: ManualProduct;
  quantity: number;
  selections: LineSelection[];
  note: string;
}

function findGroup(product: ManualProduct, groupKey: string) {
  return product.groups.find((group) => group.key === groupKey);
}

function unitPrice(line: Line): Minor {
  let unit = line.product.basePriceMinor;
  for (const selection of line.selections) {
    const group = findGroup(line.product, selection.groupKey);
    const option = group?.options.find((o) => o.key === selection.optionKey);
    if (option) unit = addMinor(unit, option.deltaMinor);
  }
  return unit;
}

/** Optional single groups keep their first option, like the storefront sheet. */
function defaultSelections(product: ManualProduct): LineSelection[] {
  const selections: LineSelection[] = [];
  for (const group of product.groups) {
    if (group.type === "single" && !group.required) {
      const first = group.options[0];
      if (first) {
        selections.push({ groupKey: group.key, optionKey: first.key });
      }
    }
  }
  return selections;
}

function selectionSignature(selections: LineSelection[]): string {
  return selections
    .map((s) => `${s.groupKey}=${s.optionKey}`)
    .sort()
    .join("|");
}

function missingRequiredGroups(
  product: ManualProduct,
  selections: LineSelection[],
): ManualGroup[] {
  return product.groups.filter((group) => {
    if (!group.required) return false;
    return !selections.some((s) => s.groupKey === group.key);
  });
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
  const [zones, setZones] = useState<Array<{
    id: string;
    nameAr: string;
    feeMinor: number;
  }> | null>(null);
  const [zoneId, setZoneId] = useState("");
  // A retried submit must reuse its key; editing the order must not reuse it
  // with a different payload (the server binds the key to the payload hash).
  const idempotency = useRef<IdempotencyScope | null>(null);
  const placedHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (placed) placedHeadingRef.current?.focus();
  }, [placed]);

  useEffect(() => {
    let alive = true;
    fetchDeliveryZones()
      .then((list) => {
        if (!alive) return;
        setZones(list);
        setZoneId((current) => current || list[0]?.id || "");
      })
      .catch(() => {
        if (alive) setZones([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.trim();
    return products.filter(
      (p) => arabicIncludes(p.nameAr, q) || arabicIncludes(p.categoryNameAr, q),
    );
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
      const initial = defaultSelections(product);
      const signature = selectionSignature(initial);
      const existing = prev.find(
        (l) =>
          l.product.id === product.id &&
          selectionSignature(l.selections) === signature &&
          !l.note,
      );
      if (existing) {
        return prev.map((l) =>
          l.key === existing.key
            ? { ...l, quantity: Math.min(20, l.quantity + 1) }
            : l,
        );
      }
      return [
        ...prev,
        {
          key: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          product,
          quantity: 1,
          selections: initial,
          note: "",
        },
      ];
    });
  }

  function selectSingle(line: Line, group: ManualGroup, optionKey: string) {
    setLines((prev) =>
      prev.map((row) => {
        if (row.key !== line.key) return row;
        const others = row.selections.filter((s) => s.groupKey !== group.key);
        return {
          ...row,
          selections: [...others, { groupKey: group.key, optionKey }],
        };
      }),
    );
  }

  function toggleMulti(line: Line, group: ManualGroup, optionKey: string) {
    setLines((prev) =>
      prev.map((row) => {
        if (row.key !== line.key) return row;
        const active = row.selections.some(
          (s) => s.groupKey === group.key && s.optionKey === optionKey,
        );
        if (active) {
          return {
            ...row,
            selections: row.selections.filter(
              (s) => !(s.groupKey === group.key && s.optionKey === optionKey),
            ),
          };
        }
        const count = row.selections.filter(
          (s) => s.groupKey === group.key,
        ).length;
        if (group.maxSelections !== undefined && count >= group.maxSelections) {
          return row;
        }
        return {
          ...row,
          selections: [...row.selections, { groupKey: group.key, optionKey }],
        };
      }),
    );
  }

  const subtotal = sumMinor(
    lines.map((l) => multiplyMinor(unitPrice(l), l.quantity)),
  );
  const selectedZone = zones?.find((z) => z.id === zoneId) ?? null;
  const deliveryFee: Minor =
    orderType === "delivery" ? (selectedZone?.feeMinor ?? 0) : 0;
  const total = addMinor(subtotal, deliveryFee);

  async function submit() {
    if (lines.length === 0) return setError("أضف صنفاً واحداً على الأقل.");
    if (name.trim().length < 2) return setError("اسم الزبون مطلوب.");
    if (phone.replace(/\D/g, "").length < 9)
      return setError("رقم هاتف الزبون مطلوب.");
    if (orderType === "delivery" && address.trim().length < 5)
      return setError("عنوان التوصيل مطلوب.");
    if (orderType === "delivery" && !zoneId)
      return setError("اختر منطقة التوصيل.");
    const incomplete = lines.flatMap((line) =>
      missingRequiredGroups(line.product, line.selections).map(
        (group) => `«${group.nameAr}» في «${line.product.nameAr}»`,
      ),
    );
    if (incomplete.length > 0) {
      return setError(`أكمل الاختيار المطلوب: ${incomplete[0]}.`);
    }
    if (orderType === "delivery" && (!zones || zones.length === 0)) {
      return setError(
        "لا توجد مناطق توصيل متاحة الآن — اختر الاستلام أو حاول لاحقاً.",
      );
    }
    setError(null);
    setBusy(true);
    try {
      const payload = {
        channel: orderType,
        ...(orderType === "delivery" ? { zoneId } : {}),
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
          selections: l.selections,
        })),
      };
      const scope = nextIdempotencyScope(
        idempotency.current,
        JSON.stringify(payload),
      );
      idempotency.current = scope;
      const result = await placeConsoleOrder({
        idempotencyKey: scope.key,
        ...payload,
      });
      if (result.ok) {
        idempotency.current = null;
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
      <div className="py-8 text-center" role="status" aria-live="polite">
        <CheckCircle2 className="mx-auto size-14 text-basil-600" aria-hidden />
        <h2 ref={placedHeadingRef} tabIndex={-1} className="mt-4 type-title">
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
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-cream-300 bg-cream-100 px-3 text-xs font-bold text-ink transition-colors hover:border-basil-400"
                  >
                    <Plus className="size-3 text-basil-700" aria-hidden />
                    {p.nameAr}
                    <Price minor={p.basePriceMinor} className="text-ink-soft" />
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
                    className="flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-terracotta/10 hover:text-terracotta"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                {l.product.groups.map((group) => {
                  const chosen = l.selections.filter(
                    (s) => s.groupKey === group.key,
                  );
                  const unanswered = group.required && chosen.length === 0;
                  const atMax =
                    group.type === "multi" &&
                    group.maxSelections !== undefined &&
                    chosen.length >= group.maxSelections;
                  return (
                    <div key={group.key} className="mt-2">
                      <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-ink-soft">
                        {group.nameAr}
                        {group.required && (
                          <span className="text-terracotta">مطلوب</span>
                        )}
                        {group.type === "multi" &&
                          group.maxSelections !== undefined &&
                          group.maxSelections > 1 && (
                            <span className="font-normal">
                              (حتى {group.maxSelections})
                            </span>
                          )}
                      </p>
                      <div
                        className="mt-1.5 flex flex-wrap gap-1.5"
                        role={group.type === "single" ? "radiogroup" : "group"}
                        aria-label={`${group.nameAr} — ${l.product.nameAr}`}
                      >
                        {group.options.map((option) => {
                          const active = chosen.some(
                            (s) => s.optionKey === option.key,
                          );
                          const disabled = atMax && !active;
                          return (
                            <button
                              key={option.key}
                              type="button"
                              role={
                                group.type === "single" ? "radio" : undefined
                              }
                              aria-checked={
                                group.type === "single" ? active : undefined
                              }
                              aria-pressed={
                                group.type === "multi" ? active : undefined
                              }
                              disabled={disabled}
                              onClick={() =>
                                group.type === "single"
                                  ? selectSingle(l, group, option.key)
                                  : toggleMulti(l, group, option.key)
                              }
                              className={
                                active
                                  ? "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-basil-700 bg-basil-50 px-3 text-xs font-bold text-basil-800 disabled:opacity-45"
                                  : "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-cream-300 bg-cream-100 px-3 text-xs font-bold text-ink-soft disabled:cursor-not-allowed disabled:opacity-45"
                              }
                            >
                              {option.nameAr}
                              {option.deltaMinor > 0 && (
                                <Price
                                  minor={option.deltaMinor}
                                  className="text-[11px]"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {unanswered && (
                        <p className="mt-1 text-[11px] font-bold text-terracotta">
                          اختر خياراً للمتابعة
                        </p>
                      )}
                    </div>
                  );
                })}
                <input
                  type="text"
                  value={l.note}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x) =>
                        x.key === l.key ? { ...x, note: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="ملاحظة سطر (اختياري)"
                  aria-label={`ملاحظة ${l.product.nameAr}`}
                  className={`mt-2 min-h-11 w-full rounded-md border border-cream-200 bg-cream-100 px-3 text-xs outline-none focus:border-basil-400`}
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
                            x.key === l.key
                              ? { ...x, quantity: Math.max(1, x.quantity - 1) }
                              : x,
                          ),
                        )
                      }
                      aria-label="إنقاص"
                      className="flex size-11 items-center justify-center rounded-full hover:bg-cream-200"
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
                            x.key === l.key
                              ? { ...x, quantity: Math.min(20, x.quantity + 1) }
                              : x,
                          ),
                        )
                      }
                      aria-label="زيادة"
                      className="flex size-11 items-center justify-center rounded-full hover:bg-cream-200"
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
            <>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="عنوان التوصيل"
                aria-label="عنوان التوصيل"
                className={inputClass}
                maxLength={140}
              />
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                aria-label="منطقة التوصيل"
                className={inputClass}
                disabled={!zones || zones.length === 0}
              >
                {!zones && <option value="">جارٍ تحميل المناطق…</option>}
                {zones && zones.length === 0 && (
                  <option value="">لا توجد مناطق توصيل</option>
                )}
                {zones?.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nameAr} — {formatPrice(z.feeMinor)} ₪
                  </option>
                ))}
              </select>
            </>
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

          <dl className="space-y-1 border-t border-cream-200 pt-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-soft">المجموع</dt>
              <dd>
                <Price minor={subtotal} />
              </dd>
            </div>
            {orderType === "delivery" && (
              <div className="flex items-center justify-between">
                <dt className="text-ink-soft">
                  التوصيل{selectedZone ? ` — ${selectedZone.nameAr}` : ""}
                </dt>
                <dd>
                  <Price minor={deliveryFee} />
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 font-bold">
              <dt>الإجمالي</dt>
              <dd>
                <Price minor={total} className="text-lg text-basil-800" />
              </dd>
            </div>
          </dl>

          {error && (
            <p
              role="alert"
              className="rounded-md bg-terracotta/10 px-4 py-3 text-sm font-bold text-terracotta"
            >
              {error}
            </p>
          )}
          <Button
            size="lg"
            className="w-full"
            onClick={submit}
            disabled={
              busy ||
              (orderType === "delivery" && (!zones || zones.length === 0))
            }
          >
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
    </div>
  );
}
