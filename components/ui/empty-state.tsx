import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Empty/error state — one centered composition (icon, title, body, action)
 * so no surface hand-rolls its blank slate. Server-component safe.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center py-10 text-center", className)}
    >
      {Icon ? (
        <div className="flex size-16 items-center justify-center rounded-full bg-brand-subtle">
          <Icon className="size-7 text-brand" aria-hidden />
        </div>
      ) : null}
      <p className="mt-4 type-title">{title}</p>
      {body ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
