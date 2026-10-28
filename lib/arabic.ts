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
