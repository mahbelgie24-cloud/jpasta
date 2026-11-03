/**
 * Arabic search normalisation.
 *
 * Users type "اسباجتي" for "إسباجتي", or omit diacritics. Search must be
 * forgiving: strip harakat, unify alef/ya/ta-marbuta forms, collapse spaces.
 */
export function normalizeArabic(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئ]/g, "ء")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function arabicIncludes(haystack: string, needle: string): boolean {
  if (!needle.trim()) return true;
  return normalizeArabic(haystack).includes(normalizeArabic(needle));
}

/**
 * Arabic plural categories: zero, singular, dual, few (3–10), many (11+).
 * The singular/dual forms carry their own number ("عنصر واحد", "عنصران");
 * the few/many forms are prefixed with the digit ("3 عناصر", "11 عنصراً").
 */
export interface ArabicPluralForms {
  zero?: string;
  one: string;
  two: string;
  few: string;
  many: string;
}

export function arabicPlural(count: number, forms: ArabicPluralForms): string {
  const n = Math.abs(count);
  if (n === 0 && forms.zero) return forms.zero;
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n >= 3 && n <= 10) return forms.few;
  return forms.many;
}

/** A complete count label: "لا طلبات", "طلب واحد", "طلبان", "7 طلبات". */
export function arabicCount(count: number, forms: ArabicPluralForms): string {
  const n = Math.abs(count);
  if (n === 0 && forms.zero) return forms.zero;
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  return `${count} ${arabicPlural(count, forms)}`;
}
