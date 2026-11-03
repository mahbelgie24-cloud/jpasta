"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bike,
  CheckCircle2,
  CloudUpload,
  HandPlatter,
  Loader2,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { useCart } from "@/components/menu/cart-context";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/domain/payment";
import { addMinor, formatPrice, ZERO, type Minor } from "@/lib/pricing";
import { buildOrderMessage, whatsappUrl } from "@/lib/whatsapp";
import { SITE } from "@/lib/site";
import { enqueueOrder, pendingCount } from "@/lib/offline/queue";
import { fetchDeliveryZones, placeStorefrontOrder } from "@/app/actions/orders";
import { nextIdempotencyScope, type IdempotencyScope } from "@/lib/idempotency";

/**
 * Cart drawer — lines, delivery/pickup, customer info, and the Phase 1
 * first-party order submit (server recomputes every price; the client
 * idempotency key makes a retried submit return the same order).
 * WhatsApp stays as a secondary handoff (spec §7).
 */

type OrderType = "delivery" | "pickup";

export function CartDrawer({
  open,
  onClose,
  paymentMethods,
}: {
  open: boolean;
  onClose: () => void;
  /** Owner-configured accepted methods (settings); defaults to cash. */
  paymentMethods?: PaymentMethod[];
}) {
  const cart = useCart();
  const methods: PaymentMethod[] =
    paymentMethods && paymentMethods.length > 0 ? paymentMethods : ["cash"];
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offlineQueued, setOfflineQueued] = useState<number | null>(null);
  const [placed, setPlaced] = useState<{
    orderNumber: string;
    orderId: string;
    accessToken: string;
  } | null>(null);
  const [zones, setZones] = useState<Array<{
    id: string;
    nameAr: string;
    feeMinor: number;
  }> | null>(null);
  const [zoneId, setZoneId] = useState("");
  const [zonesError, setZonesError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchDeliveryZones()
      .then((list) => {
        if (!alive) return;
        setZones(list);
        setZoneId((current) => current || list[0]?.id || "");
        setZonesError(null);
      })
      .catch(() => {
        if (alive) setZonesError("تعذر تحميل مناطق التوصيل — حدّث الصفحة.");
      });
    return () => {
      alive = false;
    };
  }, []);
  // A retried submit must reuse its key; an edited cart must not reuse it
  // with a different payload (the server binds the key to payload_hash).
  const idempotency = useRef<IdempotencyScope | null>(null);

  const selectedZone = zones?.find((z) => z.id === zoneId) ?? null;
  const deliveryFee: Minor =
    orderType === "delivery" ? (selectedZone?.feeMinor ?? ZERO) : ZERO;
  const total = addMinor(cart.subtotal, deliveryFee);

  function resetCustomer() {
    setName("");
    setPhone("");
    setAddress("");
    setNote("");
  }

  function handleClose() {
    if (placed) {
      cart.clear();
      setPlaced(null);
      resetCustomer();
    }
    // A queued offline payload carries its own key; the next cart is a new
    // idempotency scope either way.
    idempotency.current = null;
    // A queued-offline order must never pin the drawer to its confirmation
    // screen on every subsequent open (v1 defect).
    setOfflineQueued(null);
    setError(null);
    onClose();
  }

  async function submit() {
    const digits = phone.replace(/\D/g, "");
    if (cart.lines.length === 0) {
      setError("السلة فاضية — أضف طبقاً أولاً.");
      return;
    }
    if (name.trim().length < 2) {
      setError("اكتب اسمك حتى نعرف لمن الطلب.");
      return;
    }
    if (digits.length < 9) {
      setError("رقم الهاتف غير صحيح — تأكد منه حتى نقدر نتواصل.");
      return;
    }
    if (orderType === "delivery" && address.trim().length < 5) {
      setError("اكتب العنوان بالتفصيل حتى يوصلك الطلب بسرعة.");
      return;
    }
    if (orderType === "delivery" && !zoneId) {
      setError(zonesError ?? "اختر منطقة التوصيل حتى نعرف رسم التوصيل.");
      return;
    }
    setError(null);
    setBusy(true);
    const payload = {
      channel:
        orderType === "delivery"
          ? ("delivery" as const)
          : ("takeaway" as const),
      ...(orderType === "delivery" ? { zoneId } : {}),
      paymentMethod: methods.includes(paymentMethod)
        ? paymentMethod
        : methods[0],
      customer: {
        name: name.trim(),
        phone: phone.trim(),
        address: orderType === "delivery" ? address.trim() : "",
      },
      note: note.trim() || undefined,
      lines: cart.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        note: l.note,
        selections: l.selections,
      })),
    };
    const scope = nextIdempotencyScope(
      idempotency.current,
      JSON.stringify(payload),
    );
    idempotency.current = scope;
    const request = { ...payload, idempotencyKey: scope.key };
    try {
      const result = await placeStorefrontOrder(request);
      if (result.ok) {
        idempotency.current = null;
        setPlaced({
          orderNumber: result.order.orderNumber,
          orderId: result.order.id,
          accessToken: result.order.accessToken,
        });
        // Don't retain customer PII in memory after a successful submit.
        resetCustomer();
      } else {
        setError(result.error);
      }
    } catch {
      // network failure — queue the payload; the replay carries the SAME
      // idempotencyKey, so syncing later can never duplicate the sale
      // (lib/offline/queue.ts — spec §13 NFR).
      await enqueueOrder(request);
      const count = await pendingCount();
      setOfflineQueued(count);
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-md border border-cream-300 bg-cream-50 px-4 text-sm outline-none transition-colors placeholder:text-ink-soft/50 focus:border-basil-500";

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={placed ? "تم استلام طلبك" : "سلتك"}
    >
      {offlineQueued !== null && !placed ? (
        <div className="py-6 text-center">
          <CloudUpload className="mx-auto size-14 text-bronze" aria-hidden />
          <h3 className="mt-4 type-title">طلبك محفوظ وسيتولى الإرسال</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            الشبكة منقطعة الآن — عند عودة الاتصال يُرسل طلبك تلقائياً وبنفس
            الرقم، بدون تكرار
            {offlineQueued > 1 ? ` (${offlineQueued} طلبات بالانتظار)` : ""}.
          </p>
          <div className="mt-6">
            <Button variant="secondary" onClick={handleClose}>
              تمام
            </Button>
          </div>
        </div>
      ) : placed ? (
        <div className="py-6 text-center">
          <CheckCircle2
            className="mx-auto size-14 text-basil-600"
            aria-hidden
          />
          <h3 className="mt-4 type-title">
            طلبك رقم {placed.orderNumber} وصلنا
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            المحل بدأ يشوف طلبك الآن — تابع حالته لحظة بلحظة، وبنبلغك لما يكون
            جاهز.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/order/status/${placed.orderId}?t=${placed.accessToken}`}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-basil-700 px-6 font-bold text-cream-50 shadow-card transition-colors hover:bg-basil-600"
            >
              تابع حالة طلبك
            </Link>
            <Button variant="secondary" onClick={handleClose}>
              طلب جديد
            </Button>
          </div>
        </div>
      ) : cart.lines.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-lg font-bold text-ink">سلتك فاضية</p>
          <p className="mt-2 text-sm text-ink-soft">
            تصفّح القائمة وأضف ما يشتهيه قلبك 🍝
          </p>
          <div className="mt-6">
            <Button variant="secondary" onClick={handleClose}>
              تصفّح القائمة
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {/* lines */}
          <ul className="space-y-3">
            {cart.lines.map((l) => (
              <li
                key={l.key}
                className="rounded-xl border border-cream-200 bg-cream-100 p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{l.nameAr}</p>
                    {l.detailAr && (
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                        {l.detailAr}
                      </p>
                    )}
                    {l.note && (
                      <p className="mt-1 text-xs text-bronze">
                        ملاحظة: {l.note}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => cart.remove(l.key)}
                    aria-label={`حذف ${l.nameAr} من السلة`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-terracotta/10 hover:text-terracotta"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <Stepper
                    value={l.quantity}
                    onChange={(q) => cart.setQty(l.key, q)}
                    label={`كمية ${l.nameAr}`}
                  />
                  <Price
                    minor={l.lineTotalMinor}
                    className="font-bold text-ink"
                  />
                </div>
              </li>
            ))}
          </ul>

          {/* order type */}
          <fieldset>
            <legend className="text-sm font-bold text-ink">
              طريقة الاستلام
            </legend>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {(
                [
                  { id: "delivery", label: "توصيل", icon: Bike },
                  { id: "pickup", label: "استلام من المحل", icon: HandPlatter },
                ] as const
              ).map((opt) => {
                const active = orderType === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={
                      active
                        ? "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-basil-700 bg-basil-50 text-sm font-bold text-basil-800 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-basil-600"
                        : "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-cream-300 bg-cream-100 text-sm font-bold text-ink-soft transition-colors hover:border-basil-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-basil-600"
                    }
                  >
                    <input
                      type="radio"
                      name="order-type"
                      value={opt.id}
                      checked={active}
                      onChange={() => setOrderType(opt.id)}
                      className="sr-only"
                    />
                    <opt.icon className="size-4" aria-hidden />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {orderType === "delivery" && (
            <div>
              <label htmlFor="cust-zone" className="text-sm font-bold text-ink">
                منطقة التوصيل <span className="text-terracotta">*</span>
              </label>
              <select
                id="cust-zone"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className={`mt-1.5 ${inputClass}`}
                disabled={!zones || zones.length === 0}
              >
                {!zones && <option value="">جارٍ تحميل المناطق…</option>}
                {zones && zones.length === 0 && (
                  <option value="">لا توجد مناطق توصيل متاحة</option>
                )}
                {zones?.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nameAr} — {formatPrice(z.feeMinor)} ₪
                  </option>
                ))}
              </select>
              {zonesError && (
                <p className="mt-1.5 text-xs font-bold text-terracotta">
                  {zonesError}
                </p>
              )}
            </div>
          )}

          {/* payment — the owner configures the accepted methods */}
          {methods.length > 1 ? (
            <fieldset>
              <legend className="text-sm font-bold text-ink">
                طريقة الدفع
              </legend>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                {methods.map((method) => {
                  const active = paymentMethod === method;
                  return (
                    <label
                      key={method}
                      className={
                        active
                          ? "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-basil-700 bg-basil-50 px-2 text-center text-xs font-bold text-basil-800 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-basil-600"
                          : "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-cream-300 bg-cream-100 px-2 text-center text-xs font-bold text-ink-soft transition-colors hover:border-basil-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-basil-600"
                      }
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        value={method}
                        checked={active}
                        onChange={() => setPaymentMethod(method)}
                        className="sr-only"
                      />
                      {PAYMENT_METHOD_LABELS[method]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {/* customer info */}
          <div className="space-y-3">
            <div>
              <label htmlFor="cust-name" className="text-sm font-bold text-ink">
                الاسم <span className="text-terracotta">*</span>
              </label>
              <input
                id="cust-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`mt-1.5 ${inputClass}`}
                placeholder="اسمك الكريم"
                autoComplete="name"
                maxLength={60}
              />
            </div>
            <div>
              <label
                htmlFor="cust-phone"
                className="text-sm font-bold text-ink"
              >
                رقم الهاتف <span className="text-terracotta">*</span>
              </label>
              <input
                id="cust-phone"
                type="tel"
                inputMode="tel"
                dir="rtl"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`mt-1.5 ${inputClass}`}
                placeholder="05XXXXXXXX"
                autoComplete="tel"
                maxLength={15}
              />
            </div>
            {orderType === "delivery" && (
              <div>
                <label
                  htmlFor="cust-address"
                  className="text-sm font-bold text-ink"
                >
                  العنوان <span className="text-terracotta">*</span>
                </label>
                <input
                  id="cust-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={`mt-1.5 ${inputClass}`}
                  placeholder="الحي، الشارع، أقرب علامة مميزة"
                  maxLength={140}
                />
              </div>
            )}
            <div>
              <label htmlFor="cust-note" className="text-sm font-bold text-ink">
                ملاحظات عامة{" "}
                <span className="font-normal text-ink-soft">(اختياري)</span>
              </label>
              <input
                id="cust-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`mt-1.5 ${inputClass}`}
                placeholder="مثال: الاتصال قبل الوصول"
                maxLength={140}
              />
            </div>
          </div>

          {/* summary — server recomputes; this is the display estimate */}
          <dl className="space-y-1.5 rounded-xl bg-cream-100 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">المجموع</dt>
              <dd>
                <Price minor={cart.subtotal} />
              </dd>
            </div>
            {orderType === "delivery" && (
              <div className="flex justify-between">
                <dt className="text-ink-soft">التوصيل</dt>
                <dd>
                  <Price minor={deliveryFee} />
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-cream-300 pt-2 text-base font-bold">
              <dt>الإجمالي</dt>
              <dd>
                <Price minor={total} className="text-basil-800" />
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
            type="submit"
            size="lg"
            className="w-full"
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
            {busy ? "جارٍ الإرسال…" : "إرسال الطلب"}
            {!busy && <Price minor={total} />}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                const message = buildOrderMessage(
                  cart.lines.map((l) => ({
                    nameAr: l.nameAr,
                    detailAr: [l.detailAr, l.note ? `ملاحظة: ${l.note}` : null]
                      .filter(Boolean)
                      .join(" — "),
                    quantity: l.quantity,
                    lineTotalMinor: l.lineTotalMinor,
                  })),
                  deliveryFee,
                  {
                    name: name.trim() || "زبون",
                    phone: phone.trim() || "—",
                    orderTypeAr:
                      orderType === "delivery" ? "توصيل" : "استلام من المحل",
                    address: address.trim() || undefined,
                    note: note.trim() || undefined,
                  },
                );
                window.open(
                  whatsappUrl(SITE.whatsapp, message),
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-basil-700 underline decoration-basil-300 underline-offset-4 hover:text-basil-600"
            >
              <MessageCircle className="size-4" aria-hidden />
              أو أرسل الطلب عبر واتساب
            </button>
          </div>
          <p className="text-center text-xs text-ink-soft">
            {methods.length > 1
              ? "الدفع عند الاستلام — بدون أي رسوم إضافية."
              : "الدفع نقداً عند الاستلام — بدون أي رسوم إضافية."}
          </p>
        </form>
      )}
    </Sheet>
  );
}
