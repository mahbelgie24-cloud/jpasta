import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * One console page frame: back link, the page's single <h1>, an optional
 * description, and a consistent container. The console layout owns the
 * <main> landmark; pages must not nest another one.
 */
export function ConsolePageShell({
  title,
  description,
  children,
  backHref = "/console",
  backLabel = "رجوع للوحة",
  widthClass = "max-w-3xl",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  widthClass?: string;
}) {
  return (
    <div className={`mx-auto w-full ${widthClass} px-4 pt-5 pb-16 sm:px-6`}>
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand-strong transition-colors hover:text-brand"
      >
        <ArrowRight className="size-4" aria-hidden />
        {backLabel}
      </Link>
      <h1 className="mt-4 type-section text-text-primary">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      )}
      <div className="mt-5">{children}</div>
    </div>
  );
}
