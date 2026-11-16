"use client";

import { cn } from "@/lib/utils";

/**
 * Accessible switch — role="switch" semantics with a ≥44px hit area around
 * a compact track. Reduced-motion users get the instant transition via the
 * global prefers-reduced-motion kill-switch.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name — the switch itself is icon-free. */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors disabled:opacity-40",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-150 ease-out",
          checked ? "bg-action" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute size-5 rounded-full bg-surface shadow-card transition-[inset-inline-start] duration-150 ease-out",
            checked ? "start-[26px]" : "start-1",
          )}
        />
      </span>
    </button>
  );
}
