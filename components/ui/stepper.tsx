"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  className?: string;
}

/** Quantity stepper — 40px+ targets, announced to AT. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
  className,
}: StepperProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-cream-300 bg-cream-50 p-1",
        className,
      )}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`إنقاص ${label}`}
        className="flex size-10 items-center justify-center rounded-full text-basil-800 transition-colors hover:bg-cream-200 disabled:opacity-40"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span
        aria-live="polite"
        className="min-w-8 text-center font-bold tabular-nums"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`زيادة ${label}`}
        className="flex size-10 items-center justify-center rounded-full text-basil-800 transition-colors hover:bg-cream-200 disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
