import { cn } from "@/lib/utils";

/**
 * Brand logo — the twirled-fork mark + live-text wordmark (Fraunces).
 * The mark is inline SVG (crisp at any size); the wordmark is real text so
 * it always ships the actual webfont. Colors come from the palette via
 * props — never recolor outside the documented variants (brand.md §5).
 */

interface MarkProps {
  className?: string;
  /** Single-color (basil-900) variant for print/receipts. */
  mono?: boolean;
  /** Background badge color (basil-800 default). */
  bgClassName?: string;
}

export function LogoMark({ className, mono = false, bgClassName }: MarkProps) {
  const bg = mono ? "transparent" : undefined;
  const stroke = mono ? "#143725" : "#F9F5EC";
  return (
    <svg
      viewBox="0 0 96 96"
      role="img"
      aria-label="JPasta"
      className={cn("shrink-0", className)}
    >
      {!mono && (
        <rect
          x="0"
          y="0"
          width="96"
          height="96"
          rx="24"
          className={cn(bg ? "" : "fill-basil-800", bgClassName)}
          fill={bg ?? undefined}
        />
      )}
      {/* fork tines — dip behind the pasta nest */}
      <g stroke={stroke} strokeWidth="4" strokeLinecap="round">
        <path d="M 43.5 22 L 43.5 40" />
        <path d="M 48 22 L 48 40" />
        <path d="M 52.5 22 L 52.5 40" />
      </g>
      {/* handle — emerges below the nest */}
      <path
        d="M 48 50 L 48 79"
        stroke={stroke}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      {/* pasta nest — growing spiral */}
      <path
        d="M 53 46 A 5 5 0 0 1 43 46 A 7 7 0 0 1 57 46 A 9 9 0 0 1 39 46 A 11 11 0 0 1 61 46 A 13 13 0 0 1 35 46"
        fill="none"
        stroke={stroke}
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* wheat highlight strand */}
      {!mono && (
        <path
          d="M 40 41.4 A 11 11 0 0 1 56 36.8"
          fill="none"
          stroke="#E3C98F"
          strokeWidth="6"
          strokeLinecap="round"
        />
      )}
      {/* basil leaf accent */}
      <path
        d="M 70 60 C 76 55.5, 82.5 59.5, 81.5 66.5 C 74.5 68, 69.5 65, 70 60 Z"
        className={mono ? "" : "fill-basil-400"}
        fill={mono ? "#143725" : undefined}
      />
    </svg>
  );
}

interface LogoProps {
  /** lockup: mark + wordmark + secondary line. mark: mark only. */
  variant?: "lockup" | "mark";
  tone?: "color" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { mark: "size-9", word: "text-xl", tag: "text-[8px] tracking-[0.22em]" },
  md: {
    mark: "size-11 sm:size-12",
    word: "text-2xl sm:text-[1.7rem]",
    tag: "text-[9px] sm:text-[10px] tracking-[0.24em]",
  },
  lg: { mark: "size-16", word: "text-4xl", tag: "text-xs tracking-[0.3em]" },
} as const;

export function Logo({
  variant = "lockup",
  tone = "color",
  size = "md",
  className,
}: LogoProps) {
  const s = sizes[size];
  const wordColor = tone === "light" ? "text-cream-50" : "text-basil-800";
  const tagColor = tone === "light" ? "text-wheat-300" : "text-basil-600";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={s.mark} />
      {variant === "lockup" && (
        <span className="flex flex-col items-start leading-none">
          <span className={cn("font-display font-semibold", s.word, wordColor)}>
            JPasta
          </span>
          <span className={cn("mt-1 font-bold uppercase", s.tag, tagColor)}>
            Fresh Pasta &amp; Chicken
          </span>
        </span>
      )}
    </span>
  );
}
