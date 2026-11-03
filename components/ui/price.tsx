import { formatPrice, type Minor } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Money rendering — the only display path for prices (lib/pricing.ts is the
 * only arithmetic path). LTR-isolated so "24.00 ₪" keeps its reading order
 * inside RTL text, with tabular figures for column alignment.
 */
export function Price({
  minor,
  className,
  symbolClassName,
}: {
  minor: Minor;
  className?: string;
  symbolClassName?: string;
}) {
  return (
    <span
      dir="ltr"
      className={cn("inline-flex items-baseline gap-1 tabular-nums", className)}
    >
      <span>{formatPrice(minor)}</span>
      {/*
        The shekel sign lives in the font's Latin-ext subset. Rendering it in
        the brand font made every page fetch an extra ~29 KB woff2 just for
        one glyph; the system stack draws the symbol identically.
      */}
      <span
        className={cn("text-[0.85em] font-bold", symbolClassName)}
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        ₪
      </span>
    </span>
  );
}
