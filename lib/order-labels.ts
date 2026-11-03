/** Shared Arabic labels for order surfaces (console archive, detail, receipt). */

export type OrderStatusKey =
  "received" | "preparing" | "ready" | "completed" | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatusKey, string> = {
  received: "وصل للتو",
  preparing: "قيد التحضير",
  ready: "جاهز للتسليم",
  completed: "تم التسليم",
  cancelled: "ملغى",
};

export const ORDER_STATUS_OPTIONS: Array<{
  value: OrderStatusKey | "all";
  label: string;
}> = [
  { value: "all", label: "كل الحالات" },
  { value: "received", label: "وصل للتو" },
  { value: "preparing", label: "قيد التحضير" },
  { value: "ready", label: "جاهز للتسليم" },
  { value: "completed", label: "تم التسليم" },
  { value: "cancelled", label: "ملغى" },
];

export const CHANNEL_LABELS: Record<string, string> = {
  takeaway: "استلام",
  delivery: "توصيل",
  dine_in: "داخل المحل",
};

export const SOURCE_LABELS: Record<string, string> = {
  storefront: "الموقع",
  console: "الكونسول",
  whatsapp: "واتساب",
};
