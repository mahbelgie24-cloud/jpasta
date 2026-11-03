"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { ConsoleNav } from "./console-nav";
import { CommandPalette } from "./command-palette";

/**
 * Persistent console chrome. Rendered by the server layout for authenticated
 * users only; the login screen keeps its own full-bleed composition.
 */
export function ConsoleChrome({ role }: { role: "owner" | "staff" }) {
  const pathname = usePathname();
  if (pathname === "/console/login") return null;

  return (
    <div className="sticky top-0 z-30 border-b border-border-soft glass-dark print:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:px-6">
        <div className="min-w-0 flex-1">
          <ConsoleNav role={role} />
        </div>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("jpasta:command-palette"))
          }
          aria-label="بحث سريع (Ctrl+K)"
          title="بحث سريع (Ctrl+K)"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-raised text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
        >
          <Search className="size-4" aria-hidden />
        </button>
      </div>
      <CommandPalette role={role} />
    </div>
  );
}
