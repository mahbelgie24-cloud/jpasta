"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { tryToMinorUnits, formatPrice } from "@/lib/pricing";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/domain/payment";
import type { ShopSettings } from "@/lib/server/settings";
import { updateShopSettings } from "@/app/actions/settings";

/**
 * Owner-controlled shop behaviour (spec §8.2): hours, minimum order, payment
 * methods and the ordering flag — saved to the settings table and live on
 * the storefront without a deploy. Money entry goes through toMinorUnits
 * (lib/pricing is the only conversion boundary).
 */

export function ShopSettingsEditor({ initial }: { initial: ShopSettings }) {
  const [shopName, setShopName] = useState(initial.shopName);
  const [shopPhone, setShopPhone] = useState(initial.shopPhone);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [opensAt, setOpensAt] = useState(initial.opensAt);
  const [closesAt, setClosesAt] = useState(initial.closesAt);
  const [minOrder, setMinOrder] = useState(() =>
    formatPrice(initial.minOrderMinor),
  );
  const [deliveryEta, setDeliveryEta] = useState(
    String(initial.deliveryEtaMinutes),
  );
  const [methods, setMethods] = useState<PaymentMethod[]>(
    initial.paymentMethods,
  );
  const [orderingEnabled, setOrderingEnabled] = useState(
    initial.orderingEnabled,
  );
  const [hoursLabel, setHoursLabel] = useState(initial.hoursLabel);
  const [receiptFooter, setReceiptFooter] = useState(initial.receiptFooter);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function toggleMethod(method: PaymentMethod) {
    setMethods((current) =>
      current.includes(method)
        ? current.filter((m) => m !== method)
        : [
            ...PAYMENT_METHODS.filter(
              (m) => current.includes(m) || m === method,
            ),
          ],
    );
  }

  async function save() {
    const minOrderMinor = tryToMinorUnits(minOrder);
    if (minOrderMinor === null) {
      setNotice("الحد الأدنى غير صحيح — استخدم رقماً مثل 15.00 أو 0");
      return;
    }
    setBusy(true);
    setNotice(null);
    const result = await updateShopSettings({
      shopName,
      shopPhone,
      whatsapp,
      opensAt,
      closesAt,
      minOrderMinor,
      deliveryEtaMinutes: Number.parseInt(deliveryEta, 10) || 1,
      paymentMethods: methods,
      orderingEnabled,
      hoursLabel,
      receiptFooter,
    });
    setBusy(false);
    setNotice(
      result.ok
        ? "✓ حُفظت الإعدادات وانطبقت فوراً"
        : (result.error ?? "تعذر الحفظ"),
    );
  }

  const inputClass =
    "min-h-12 w-full rounded-md border border-cream-300 bg-cream-50 px-4 text-sm outline-none transition-colors focus:border-basil-500";

  return (
    <section className="mt-10 rounded-card border border-cream-200 bg-cream-50 p-5 shadow-card">
      <h2 className="type-title text-ink">إعدادات المحل</h2>
      <p className="mt-1 text-sm text-ink-soft">
        تنطبق فوراً على المتجر والطلب — بدون إعادة نشر.
      </p>

      <form
        className="mt-5 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="cfg-name" className="text-sm font-bold text-ink">
              اسم المحل <span className="text-terracotta">*</span>
            </label>
            <input
              id="cfg-name"
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
              maxLength={60}
              required
            />
          </div>
          <div>
            <label htmlFor="cfg-phone" className="text-sm font-bold text-ink">
              هاتف المحل <span className="text-terracotta">*</span>
            </label>
            <input
              id="cfg-phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
              maxLength={20}
              required
            />
          </div>
          <div>
            <label
              htmlFor="cfg-whatsapp"
              className="text-sm font-bold text-ink"
            >
              واتساب (دولي بدون +)
            </label>
            <input
              id="cfg-whatsapp"
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={whatsapp}
              onChange={(e) =>
                setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 15))
              }
              className={`mt-1.5 ${inputClass} font-bold tabular-nums`}
              maxLength={15}
              placeholder="970566064976"
            />
          </div>
          <p className="text-xs leading-relaxed text-ink-soft sm:col-span-3">
            يظهر الاسم والهاتف وواتساب فوراً في الواجهات والإيصال؛ بيانات
            SEO/JSON-LD الثابتة تُحدَّث مع النشر التالي.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cfg-opens" className="text-sm font-bold text-ink">
              الافتتاح <span className="text-terracotta">*</span>
            </label>
            <input
              id="cfg-opens"
              type="time"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
              required
            />
          </div>
          <div>
            <label htmlFor="cfg-closes" className="text-sm font-bold text-ink">
              الإغلاق <span className="text-terracotta">*</span>
            </label>
            <input
              id="cfg-closes"
              type="time"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
              required
            />
          </div>
          <div>
            <label htmlFor="cfg-min" className="text-sm font-bold text-ink">
              الحد الأدنى للطلب (₪)
            </label>
            <input
              id="cfg-min"
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="cfg-eta" className="text-sm font-bold text-ink">
              مدة التوصيل المتوقعة (دقيقة)
            </label>
            <input
              id="cfg-eta"
              type="number"
              min={1}
              max={240}
              value={deliveryEta}
              onChange={(e) => setDeliveryEta(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="cfg-hours-label"
            className="text-sm font-bold text-ink"
          >
            نص الساعات المعروض
          </label>
          <input
            id="cfg-hours-label"
            type="text"
            value={hoursLabel}
            onChange={(e) => setHoursLabel(e.target.value)}
            className={`mt-1.5 ${inputClass}`}
            maxLength={80}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-bold text-ink">طرق الدفع</legend>
          <div className="mt-2 space-y-2">
            {PAYMENT_METHODS.map((method) => (
              <label
                key={method}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-bold text-ink"
              >
                <input
                  type="checkbox"
                  checked={methods.includes(method)}
                  onChange={() => toggleMethod(method)}
                  className="size-5 accent-basil-700"
                />
                {PAYMENT_METHOD_LABELS[method]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-bold text-ink">
          <input
            type="checkbox"
            checked={orderingEnabled}
            onChange={(e) => setOrderingEnabled(e.target.checked)}
            className="size-5 accent-basil-700"
          />
          الطلب المباشر من القائمة مفعّل
        </label>

        <div>
          <label htmlFor="cfg-footer" className="text-sm font-bold text-ink">
            تذييل الإيصال
          </label>
          <input
            id="cfg-footer"
            type="text"
            value={receiptFooter}
            onChange={(e) => setReceiptFooter(e.target.value)}
            className={`mt-1.5 ${inputClass}`}
            maxLength={160}
          />
        </div>

        {notice && (
          <p
            role="status"
            className="rounded-md bg-basil-50 px-4 py-3 text-sm font-bold text-basil-800"
          >
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-basil-700 px-8 text-sm font-bold text-cream-50 shadow-card transition-colors hover:bg-basil-600 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          حفظ الإعدادات
        </button>
      </form>
    </section>
  );
}
