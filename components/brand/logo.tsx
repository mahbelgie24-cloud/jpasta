import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand logo — the supplied JPasta assets.
 *
 * Four vector source files:
 *   logo.svg             primary roundel, wordmark + secondary line
 *   logo-mark.svg        compact roundel (small spaces)
 *   logo-mono.svg        single-colour line art for receipts/print
 *   logo-horizontal.svg  wide rounded plaque for the sticky header only
 *
 * The logo is never redrawn, retyped or recoloured in component code. The
 * roundel and the horizontal lockup each have locked colours in brand.md §5.
 */

const SIZES = {
  sm: 44,
  md: 64,
  lg: 96,
  xl: 128,
} as const;

interface LogoProps {
  /** full: roundel with the secondary line. mark: compact roundel. */
  variant?: "full" | "mark";
  size?: keyof typeof SIZES;
  /** True when adjacent text already names the shop. */
  decorative?: boolean;
  /** Eager-load the above-the-fold header logo. */
  priority?: boolean;
  className?: string;
}

export function Logo({
  variant = "full",
  size = "md",
  decorative = false,
  priority = false,
  className,
}: LogoProps) {
  const px = SIZES[size];
  const full = variant === "full";
  return (
    <Image
      src={full ? "/brand/logo.svg" : "/brand/logo-mark.svg"}
      alt={decorative ? "" : full ? "JPasta — Fresh Pasta & Chicken" : "JPasta"}
      width={px}
      height={px}
      priority={priority}
      unoptimized
      className={cn("shrink-0", className)}
    />
  );
}

const HORIZONTAL = { width: 1600, height: 557 } as const;

interface HeaderLogoProps {
  /** True when adjacent text already names the shop. */
  decorative?: boolean;
  priority?: boolean;
  className?: string;
}

/**
 * The wide rounded top-bar lockup. Header only: the roundel remains the
 * primary mark for the footer, app icons, status pages and receipts.
 */
export function HeaderLogo({
  decorative = false,
  priority = false,
  className,
}: HeaderLogoProps) {
  return (
    <Image
      src="/brand/logo-horizontal.svg"
      alt={decorative ? "" : "JPasta — Fresh Pasta & Chicken"}
      width={HORIZONTAL.width}
      height={HORIZONTAL.height}
      priority={priority}
      unoptimized
      className={cn("h-10 w-auto shrink-0 sm:h-11 md:h-[3.25rem]", className)}
    />
  );
}

interface LogoMarkProps {
  className?: string;
  /** Single-colour line art (basil ink on paper) for thermal receipts. */
  mono?: boolean;
  /** True when adjacent text already names the shop. */
  decorative?: boolean;
  priority?: boolean;
}

/** The compact badge, for console chrome, status pages and print. */
export function LogoMark({
  className,
  mono = false,
  decorative = false,
  priority = false,
}: LogoMarkProps) {
  return (
    <Image
      src={mono ? "/brand/logo-mono.svg" : "/brand/logo-mark.svg"}
      alt={decorative ? "" : "JPasta"}
      width={64}
      height={64}
      priority={priority}
      unoptimized
      className={cn("shrink-0", className)}
    />
  );
}
