"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { FieldLabel } from "@/components/ui/field";

/**
 * Select on the shared field chrome. The native picker stays (no
 * appearance-none) — it is the best mobile UX and inherits platform RTL.
 */

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function SelectField({
  label,
  hint,
  error,
  className,
  id: idProp,
  children,
  ...props
}: SelectFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  // Always-mounted live region (empty while valid) — see field.tsx.
  const errorId = `${id}-error`;
  const describedBy =
    [hintId, errorId, props["aria-describedby"]].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} required={props.required} />
      <select
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-12 w-full rounded-md border border-line bg-surface px-4 text-sm transition-colors outline-none focus:border-action",
          "mt-1.5",
          className,
        )}
      >
        {children}
      </select>
      {hint && hintId ? (
        <p id={hintId} className="mt-1.5 text-xs text-text-secondary">
          {hint}
        </p>
      ) : null}
      <p
        id={errorId}
        aria-live="polite"
        className={cn("text-xs font-bold text-danger", error && "mt-1.5")}
      >
        {error ?? ""}
      </p>
    </div>
  );
}
