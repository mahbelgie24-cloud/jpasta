"use client";

import { usePathname } from "next/navigation";
import { ConsoleNav } from "./console-nav";

/**
 * Persistent console chrome. Rendered by the server layout for authenticated
 * users only; the login screen keeps its own full-bleed composition.
 */
export function ConsoleChrome({ role }: { role: "owner" | "staff" }) {
  const pathname = usePathname();
  if (pathname === "/console/login") return null;

  return (
    <div className="sticky top-0 z-30 border-b border-border-soft glass-dark print:hidden">
      <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
        <ConsoleNav role={role} />
      </div>
    </div>
  );
}
