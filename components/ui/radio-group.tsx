"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Card-style radio group on fieldset/legend semantics — the pattern for
 * any single-choice row of tiles (order type, payment method, …).
 * sr-only inputs, ≥44px targets, focus ring on the card via has-[].
 */

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export function RadioCardGroup<T extends string>({
  label,
  name,
  value,
  onChange,
  options,
  columns = 2,
  className,
}: {
  label: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<RadioOption<T>>;
  /** 2 → two columns everywhere; 3 → stacked on mobile, three on ≥sm. */
  columns?: 2 | 3;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="text-sm font-bold text-text-primary">{label}</legend>
      <div
        className={cn(
          "mt-2.5 grid gap-2",
          columns === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3",
        )}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <label
              key={opt.value}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md px-2 text-sm font-bold transition-colors",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                active
                  ? "border-2 border-action bg-brand-subtle text-brand-strong"
                  : "border border-line bg-surface-raised text-text-secondary hover:border-brand-soft",
              )}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={active}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.icon ? <opt.icon className="size-4" aria-hidden /> : null}
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
