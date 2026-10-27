/**
 * WhatsApp order handoff (Phase 0 order path — spec §7).
 * The cart builds a structured Arabic order message; the guest completes
 * the order in WhatsApp. Phase 1 adds first-party capture on top.
 */
import { formatPrice, sumMinor, type Minor } from "@/lib/pricing";

export interface OrderLine {
  nameAr: string;
  detailAr?: string;
  quantity: number;
  lineTotalMinor: Minor;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  orderTypeAr: string; // "توصيل" | "استلام من المحل"
  address?: string;
  note?: string;
}

export function whatsappUrl(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function buildOrderMessage(
  lines: OrderLine[],
  deliveryFeeMinor: Minor,
  customer: CustomerInfo,
): string {
  const subtotal = sumMinor(lines.map((l) => l.lineTotalMinor));
  const total = subtotal + deliveryFeeMinor;

  const linesText = lines
    .map(
      (l, i) =>
        `${i + 1}) ${l.nameAr}${l.detailAr ? ` — ${l.detailAr}` : ""} × ${l.quantity} = ${formatPrice(l.lineTotalMinor)} ₪`,
    )
    .join("\n");

  const parts = [
    "🍝 *طلب جديد من JPasta*",
    "",
    linesText,
    "",
    customer.orderTypeAr === "توصيل"
      ? `التوصيل: ${formatPrice(deliveryFeeMinor)} ₪`
      : null,
    `*الإجمالي: ${formatPrice(total)} ₪*`,
    "",
    `الاسم: ${customer.name}`,
    `الهاتف: ${customer.phone}`,
    customer.orderTypeAr === "توصيل" && customer.address
      ? `العنوان: ${customer.address}`
      : null,
    customer.note ? `ملاحظات: ${customer.note}` : null,
    "",
    `طريقة الدفع: نقداً عند الاستلام`,
  ].filter((v): v is string => v !== null);

  return parts.join("\n");
}
