/**
 * Payment methods (spec §1/§7): cash, card terminal, cash on delivery —
 * no online gateway. Shared by the server settings layer and the client
 * checkout UI; plain domain module, no server-only boundary.
 */

export type PaymentMethod = "cash" | "card_terminal" | "cash_on_delivery";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "cash_on_delivery",
  "card_terminal",
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "نقداً عند الاستلام",
  cash_on_delivery: "نقداً عند التوصيل",
  card_terminal: "بطاقة عند الاستلام",
};
