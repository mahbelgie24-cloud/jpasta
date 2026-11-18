"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { anonymizeOrderPii } from "@/app/actions/settings";

/**
 * Owner-initiated DSAR (privacy request): anonymize one order's customer
 * PII by order number. Irreversible by design — hence the explicit
 * confirmation checkbox before the submit button enables.
 */
export function PrivacyTools() {
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function submit() {
    setBusy(true);
    setNotice(null);
    try {
      const result = await anonymizeOrderPii(orderNumber);
      setNotice(
        result.ok
          ? { ok: true, text: "✓ حُجبت بيانات الزبون لهذا الطلب نهائياً" }
          : { ok: false, text: result.error ?? "تعذر التنفيذ" },
      );
      if (result.ok) {
        setOrderNumber("");
        setConfirmed(false);
      }
    } catch {
      // A network failure must not leave the spinner stuck forever.
      setNotice({ ok: false, text: "تعذر الاتصال — أعد المحاولة" });
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-md border border-line bg-surface px-4 text-sm outline-none transition-colors focus:border-action";

  return (
    <section className="mt-5 rounded-card border border-border-soft bg-surface-raised p-4">
      <h2 className="font-bold text-text-primary">الخصوصية — طلب حذف بيانات</h2>
      <p className="mt-1 text-sm leading-relaxed text-text-secondary">
        حجب اسم الزبون وهاتفه وعنوانه وملاحظته في طلب محدد فوراً (طلب حق
        البيانات). رقم الطلب والمبالغ وسجل الحالة يبقى كما هو، والإجراء غير قابل
        للتراجع.
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div>
          <label
            htmlFor="dsar-order"
            className="text-sm font-bold text-text-primary"
          >
            رقم الطلب
          </label>
          <input
            id="dsar-order"
            type="text"
            dir="ltr"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            className={`mt-1.5 ${inputClass} font-bold tabular-nums`}
            placeholder="JP-261118-001"
            maxLength={20}
            required
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-sm font-bold text-text-primary">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-basil-700"
          />
          أؤكد حجب بيانات هذا الطلب نهائياً
        </label>

        <button
          type="submit"
          disabled={busy || !confirmed || orderNumber.trim().length === 0}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-action px-8 text-sm font-bold text-action-text shadow-card transition-colors hover:bg-action-hover disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          حجب البيانات
        </button>

        {notice && (
          <p
            role="status"
            className={
              notice.ok
                ? "rounded-md bg-brand-subtle px-4 py-3 text-sm font-bold text-brand-strong"
                : "rounded-md bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
            }
          >
            {notice.text}
          </p>
        )}
      </form>
    </section>
  );
}
