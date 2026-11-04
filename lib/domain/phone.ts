/**
 * Phone validation shared by customer checkout and owner settings.
 *
 * The shape regex alone accepted "---------" (no digits at all), which is
 * how the v2 audit's phone bug shipped. A plausible number needs the right
 * characters AND a real digit count.
 */

const SHAPE = /^[0-9+\-()\s]+$/;
const MAX_LENGTH = 20;
const MAX_DIGITS = 15;

export function phoneDigitCount(value: string): number {
  return value.replace(/\D/g, "").length;
}

export function isPlausiblePhone(value: string, minDigits = 9): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) return false;
  if (!SHAPE.test(trimmed)) return false;
  const digits = phoneDigitCount(trimmed);
  return digits >= minDigits && digits <= MAX_DIGITS;
}
