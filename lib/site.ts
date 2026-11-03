/**
 * Site-wide constants — the real business profile (spec §1).
 * Change the shop's identity here, not in components.
 */
export const SITE = {
  name: "JPasta",
  nameAr: "جي باستا",
  secondaryLine: "Fresh Pasta & Chicken",
  tagline: "Fresh pasta, cooked to order. With a lot of sauce and love.",
  taglineAr: "باستا طازة تُطبخ عند الطلب — وصلصة بيتية تُحضّر طازجة كل يوم.",
  description:
    "JPasta في قلقيلية — باستا طازة تُطبخ عند الطلب بصلصات بيتية تُحضّر طازجة كل يوم ودجاج طازج. اطلب أونلاين أو عبر واتساب، استلام أو توصيل.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  phoneDisplay: "0566064976",
  phoneIntl: "+970566064976",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "970566064976",
  addressAr: "بجانب مدرسة أبو علي اياد — قلقيلية",
  cityAr: "قلقيلية",
  // Arabic-Indic digits + "حتى" — keeps the two time spans in logical RTL
  // order (Latin digits get bidi-reordered and would swap PM/AM visually).
  hoursLabel: "يومياً ١:٠٠ ظهراً حتى ١:٠٠ بعد منتصف الليل",
  hoursSchema: "Mo-Su 13:00-01:00",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=JPasta+Qalqilya",
} as const;
