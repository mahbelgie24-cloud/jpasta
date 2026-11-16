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
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Price } from "@/components/ui/price";
import { RadioCardGroup } from "@/components/ui/radio-group";
import { SelectField } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { TextField } from "@/components/ui/field";
import { useCart } from "@/components/menu/cart-context";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/domain/payment";
import { addMinor, formatPrice, ZERO, type Minor } from "@/lib/pricing";
import { buildOrderMessage, whatsappUrl } from "@/lib/whatsapp";
import { SITE } from "@/lib/site";
import { enqueueOrder, pendingCount } from "@/lib/offline/queue";
import {
  fetchCartQuote,
  fetchDeliveryZones,
  placeStorefrontOrder,
} from "@/app/actions/orders";
import { nextIdempotencyScope, type IdempotencyScope } from "@/lib/idempotency";

/**
 * Cart drawer — lines, delivery/pickup, customer info, and the Phase 1
 * first-party order submit (server recomputes every price; the client
 * idempotency key makes a retried submit return the same order).
 * WhatsApp stays as a secondary handoff (spec §7).
 */

type OrderType = "delivery" | "pickup";

/** Validation is per-field; cart-level problems surface as formError. */
interface FieldErrors {
  name?: string;
  phone?: string;
  address?: string;
  zone?: string;
}

export function CartDrawer({
  open,
  onClose,
  paymentMethods,
  minOrderMinor = 0,
  deliveryEtaMinutes = 25,
}: {
  open: boolean;
  onClose: () => void;
  /** Owner-configured accepted methods (settings); defaults to cash. */
  paymentMethods?: PaymentMethod[];
  /** Owner-configured minimum subtotal in agorot (0 = no minimum). */
  minOrderMinor?: number;
  /** Owner-configured delivery estimate, shown next to the zone. */
  deliveryEtaMinutes?: number;
}) {
  const cart = useCart();
  const methods: PaymentMethod[] =
    paymentMethods && paymentMethods.length > 0 ? paymentMethods : ["cash"];
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  // Cash-on-delivery cannot pay for a pickup. Deriving the effective method
  // (instead of syncing state in an effect) means switching to pickup can
  // never leave an invisible, disabled method selected.
  const availableMethods =
    orderType === "delivery"
      ? methods
      : methods.filter((method) => method !== "cash_on_delivery");
  const effectivePaymentMethod: PaymentMethod = availableMethods.includes(
    paymentMethod,
  )
    ? paymentMethod
    : (availableMethods[0] ?? "cash");
  const noPaymentMethod = availableMethods.length === 0;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
  const [priceNotice, setPriceNotice] = useState<string | null>(null);

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
  const confirmationRef = useRef<HTMLHeadingElement | null>(null);
  const linesRef = useRef(cart.lines);
  const repriceRef = useRef(cart.reprice);

  // Keep the quote effect dependency-free without writing refs during render.
  useEffect(() => {
    linesRef.current = cart.lines;
    repriceRef.current = cart.reprice;
  }, [cart.lines, cart.reprice]);

  // The form is replaced by a confirmation; move focus there so a keyboard
  // or screen-reader user is not dropped on <body>.
  useEffect(() => {
    if (placed || offlineQueued !== null) confirmationRef.current?.focus();
  }, [placed, offlineQueued]);

  // A cart can outlive an owner price change. Re-price it server-side when
  // the drawer opens and correct the displayed lines before submit.
  useEffect(() => {
    if (!open || placed || offlineQueued !== null) return;
    const current = linesRef.current;
    if (current.length === 0) return;
    let alive = true;
    void fetchCartQuote(
      current.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        note: l.note || undefined,
        selections: l.selections,
      })),
    )
      .then((result) => {
        if (!alive) return;
        if (!result.ok) {
          setPriceNotice(result.error);
          return;
        }
        const updates = current.flatMap((line, index) => {
          const quote = result.lines[index];
          if (!quote) return [];
          return [
            {
              key: line.key,
              nameAr: quote.nameAr,
              detailAr: quote.detailAr ?? "",
              unitPriceMinor: quote.unitPriceMinor,
              lineTotalMinor: quote.lineTotalMinor,
              available: quote.available,
            },
          ];
        });
        const changed = updates.some((update, index) => {
          const line = current[index];
          return (
            !line ||
            update.unitPriceMinor !== line.unitPriceMinor ||
            update.lineTotalMinor !== line.lineTotalMinor ||
            update.nameAr !== line.nameAr
          );
        });
        const unavailableCount = updates.filter((u) => !u.available).length;
        if (changed || unavailableCount > 0) {
          repriceRef.current(updates);
          setPriceNotice(
            unavailableCount > 0
              ? "بعض الأصناف لم تعد متاحة — احذفها للمتابعة."
              : "تحدّثت الأسعار — راجع المجموع قبل الإرسال.",
          );
        } else {
          setPriceNotice(null);
        }
      })
      .catch(() => {
        // Keep the stored estimate; the server re-verifies at submit.
      });
    return () => {
      alive = false;
    };
  }, [open, placed, offlineQueued]);

  const selectedZone = zones?.find((z) => z.id === zoneId) ?? null;
  const regionsReady = Boolean(zones && zones.length > 0);
  const deliveryFee: Minor =
    orderType === "delivery" ? (selectedZone?.feeMinor ?? ZERO) : ZERO;
  const total = addMinor(cart.subtotal, deliveryFee);
  const remainingToMinimum = Math.max(0, minOrderMinor - cart.subtotal);
  const belowMinimum = remainingToMinimum > 0;
  const hasUnavailable = cart.lines.some((l) => l.unavailable);

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
    setFormError(null);
    onClose();
  }

  async function submit() {
    const digits = phone.replace(/\D/g, "");
    if (cart.lines.length === 0) {
      setFormError("السلة فاضية — أضف طبقاً أولاً.");
      return;
    }
    if (cart.lines.some((l) => l.unavailable)) {
      setFormError("بعض الأصناف لم تعد متاحة — احذفها وأعد المحاولة.");
      return;
    }
    if (noPaymentMethod) {
      setFormError("لا توجد طريقة دفع متاحة لهذا النوع من الطلبات حالياً.");
      return;
    }
    const next: FieldErrors = {};
    if (name.trim().length < 2) {
      next.name = "اكتب اسمك حتى نعرف لمن الطلب.";
    }
    if (digits.length < 9) {
      next.phone = "رقم الهاتف غير صحيح — تأكد منه حتى نقدر نتواصل.";
    }
    if (orderType === "delivery" && address.trim().length < 5) {
      next.address = "اكتب العنوان بالتفصيل حتى يوصلك الطلب بسرعة.";
    }
    if (orderType === "delivery" && !zoneId) {
      next.zone = zonesError ?? "اختر منطقة التوصيل حتى نعرف رسم التوصيل.";
    }
    if (Object.values(next).some(Boolean)) {
      setFieldErrors(next);
      // Move focus to the first invalid field so keyboard and screen-reader
      // users land where the fix is needed instead of hunting for the error.
      const focusOrder: Array<[keyof FieldErrors, string]> = [
        ["name", "cust-name"],
        ["phone", "cust-phone"],
        ["address", "cust-address"],
        ["zone", "cust-zone"],
      ];
      const firstInvalid = focusOrder.find(([key]) => next[key]);
      if (firstInvalid) document.getElementById(firstInvalid[1])?.focus();
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setBusy(true);
    const payload = {
      channel:
        orderType === "delivery"
          ? ("delivery" as const)
          : ("takeaway" as const),
      ...(orderType === "delivery" ? { zoneId } : {}),
      paymentMethod: effectivePaymentMethod,
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
        setFormError(result.error);
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

  /** Sets the value and clears that field's validation message. */
  function fieldSetter<T>(
    set: (value: T) => void,
    key: keyof FieldErrors,
  ): (value: T) => void {
    return (value) => {
      set(value);
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    };
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={placed ? "تم استلام طلبك" : "سلتك"}
    >
      {offlineQueued !== null && !placed ? (
        <div className="py-6 text-center" role="status" aria-live="polite">
          <CloudUpload className="mx-auto size-14 text-warning" aria-hidden />
          <h3 ref={confirmationRef} tabIndex={-1} className="mt-4 type-title">
            طلبك محفوظ وسيتولى الإرسال
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
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
        <div className="py-6 text-center" role="status" aria-live="polite">
          <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden />
          <h3 ref={confirmationRef} tabIndex={-1} className="mt-4 type-title">
            طلبك رقم {placed.orderNumber} وصلنا
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
            المحل بدأ يشوف طلبك الآن — تابع حالته لحظة بلحظة، وبنبلغك لما يكون
            جاهز.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/order/status/${placed.orderId}?t=${placed.accessToken}`}
              className={buttonStyles("primary", "md", "min-h-12 w-full")}
            >
              تابع حالة طلبك
            </Link>
            <Button variant="secondary" onClick={handleClose}>
              طلب جديد
            </Button>
          </div>
        </div>
      ) : cart.lines.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="سلتك فاضية"
          body="تصفّح القائمة وأضف ما يشتهيه قلبك"
          action={
            <Button variant="secondary" onClick={handleClose}>
              تصفّح القائمة
            </Button>
          }
        />
      ) : (
        <form
          className="space-y-6"
          noValidate
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
                className="rounded-xl border border-border-soft bg-surface-raised p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-text-primary">{l.nameAr}</p>
                    {l.detailAr && (
                      <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                        {l.detailAr}
                      </p>
                    )}
                    {l.note && (
                      <p className="mt-1 text-xs text-warning">
                        ملاحظة: {l.note}
                      </p>
                    )}
                    {l.unavailable && (
                      <span className="mt-1.5 inline-flex rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">
                        غير متاح الآن
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => cart.remove(l.key)}
                    aria-label={`حذف ${l.nameAr} من السلة`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger"
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
                    className="font-bold text-text-primary"
                  />
                </div>
              </li>
            ))}
          </ul>

          {/* order type */}
          <RadioCardGroup<OrderType>
            label="طريقة الاستلام"
            name="order-type"
            value={orderType}
            onChange={setOrderType}
            columns={2}
            options={[
              { value: "delivery", label: "توصيل", icon: Bike },
              { value: "pickup", label: "استلام من المحل", icon: HandPlatter },
            ]}
          />

          {orderType === "delivery" && (
            <SelectField
              id="cust-zone"
              label="منطقة التوصيل"
              required
              value={zoneId}
              onChange={(e) => {
                setZoneId(e.target.value);
                setFieldErrors((current) => ({ ...current, zone: undefined }));
              }}
              disabled={!zones || zones.length === 0}
              error={fieldErrors.zone ?? zonesError}
              hint={
                regionsReady && !zonesError && deliveryEtaMinutes > 0
                  ? `التوصيل خلال ~${deliveryEtaMinutes} دقيقة داخل قلقيلية.`
                  : undefined
              }
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
            </SelectField>
          )}

          {/* payment — the owner configures the accepted methods */}
          {availableMethods.length > 1 ? (
            <RadioCardGroup<PaymentMethod>
              label="طريقة الدفع"
              name="payment-method"
              value={effectivePaymentMethod}
              onChange={setPaymentMethod}
              columns={3}
              options={availableMethods.map((method) => ({
                value: method,
                label: PAYMENT_METHOD_LABELS[method],
              }))}
            />
          ) : null}

          {/* customer info */}
          <div className="space-y-3">
            <TextField
              id="cust-name"
              label="الاسم"
              required
              value={name}
              onChange={(e) => fieldSetter(setName, "name")(e.target.value)}
              placeholder="اسمك الكريم"
              autoComplete="name"
              maxLength={60}
              error={fieldErrors.name}
            />
            <TextField
              id="cust-phone"
              label="رقم الهاتف"
              type="tel"
              inputMode="tel"
              dir="rtl"
              required
              value={phone}
              onChange={(e) => fieldSetter(setPhone, "phone")(e.target.value)}
              placeholder="05XXXXXXXX"
              autoComplete="tel"
              maxLength={15}
              error={fieldErrors.phone}
            />
            {orderType === "delivery" && (
              <TextField
                id="cust-address"
                label="العنوان"
                required
                value={address}
                onChange={(e) =>
                  fieldSetter(setAddress, "address")(e.target.value)
                }
                placeholder="الحي، الشارع، أقرب علامة مميزة"
                maxLength={140}
                error={fieldErrors.address}
              />
            )}
            <TextField
              id="cust-note"
              label="ملاحظات عامة"
              optional
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: الاتصال قبل الوصول"
              maxLength={140}
            />
          </div>

          {/* summary — server recomputes; this is the display estimate */}
          <dl className="space-y-1.5 rounded-xl bg-surface-raised p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-secondary">المجموع</dt>
              <dd>
                <Price minor={cart.subtotal} />
              </dd>
            </div>
            {orderType === "delivery" && (
              <div className="flex justify-between">
                <dt className="text-text-secondary">التوصيل</dt>
                <dd>
                  <Price minor={deliveryFee} />
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border-soft pt-2 text-base font-bold">
              <dt>الإجمالي</dt>
              <dd>
                <Price minor={total} className="text-brand-strong" />
              </dd>
            </div>
          </dl>

          {priceNotice && (
            <p
              role="status"
              className="rounded-md bg-warning/10 px-3 py-2 text-xs font-bold text-text-primary"
            >
              {priceNotice}
            </p>
          )}

          {belowMinimum && (
            <p
              role="status"
              className="rounded-md bg-warning/10 px-3 py-2 text-xs font-bold text-text-primary"
            >
              باقي <Price minor={remainingToMinimum} /> للوصول للحد الأدنى (
              <Price minor={minOrderMinor} />
              ).
            </p>
          )}

          {formError && (
            <p
              role="alert"
              className="rounded-md bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
            >
              {formError}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={
              busy ||
              belowMinimum ||
              hasUnavailable ||
              noPaymentMethod ||
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
                    paymentMethodAr:
                      PAYMENT_METHOD_LABELS[effectivePaymentMethod],
                  },
                );
                window.open(
                  whatsappUrl(SITE.whatsapp, message),
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand underline decoration-brand-soft underline-offset-4 hover:text-brand-strong"
            >
              <MessageCircle className="size-4" aria-hidden />
              أو أرسل الطلب عبر واتساب
            </button>
          </div>
          <p className="text-center text-xs text-text-secondary">
            {availableMethods.length > 1
              ? "الدفع عند الاستلام — بدون أي رسوم إضافية."
              : availableMethods[0]
                ? `${PAYMENT_METHOD_LABELS[availableMethods[0]]} — بدون أي رسوم إضافية.`
                : "لا توجد طريقة دفع متاحة لهذا النوع من الطلبات."}
          </p>
        </form>
      )}
    </Sheet>
  );
}
