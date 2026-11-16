"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Form field primitives — label, hint, and error with the aria wiring
 * (aria-invalid + aria-describedby) built in, so no form hand-rolls it.
 * Validation stays caller-owned; these only present the messages.
 * Pass `required` for the marker + aria-required; when validation is
 * manual, pair it with noValidate on the form to suppress native popups.
 */

/** Shared control chrome — native focus-visible outline comes from globals. */
export const controlClass =
  "min-h-12 w-full rounded-md border border-line bg-surface px-4 text-sm outline-none transition-colors placeholder:text-text-secondary/50 focus:border-action";

export function FieldLabel({
  htmlFor,
  label,
  required,
  optional,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-bold text-text-primary">
      {label}{" "}
      {required ? (
        <span aria-hidden className="text-danger">
          *
        </span>
      ) : optional ? (
        <span className="font-normal text-text-secondary">(اختياري)</span>
      ) : null}
    </label>
  );
}

function FieldHint({ id, hint }: { id: string; hint: string }) {
  return (
    <p id={id} className="mt-1.5 text-xs text-text-secondary">
      {hint}
    </p>
  );
}

/**
 * Always-mounted live region (empty while valid) — a region inserted
 * together with its text is not reliably announced by screen readers.
 */
function FieldError({ id, error }: { id: string; error: string }) {
  return (
    <p
      id={id}
      aria-live="polite"
      className={cn("text-xs font-bold text-danger", error && "mt-1.5")}
    >
      {error}
    </p>
  );
}

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  /** Validation message — marks the control aria-invalid while set. */
  error?: string | null;
  /** Renders "(اختياري)" instead of the required marker. */
  optional?: boolean;
}

export function TextField({
  label,
  hint,
  error,
  optional,
  className,
  id: idProp,
  ...props
}: TextFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = `${id}-error`;
  const describedBy =
    [hintId, errorId, props["aria-describedby"]].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div>
      <FieldLabel
        htmlFor={id}
        label={label}
        required={props.required}
        optional={optional}
      />
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(controlClass, "mt-1.5", className)}
      />
      {hint && hintId ? <FieldHint id={hintId} hint={hint} /> : null}
      <FieldError id={errorId} error={error ?? ""} />
    </div>
  );
}
