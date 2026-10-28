"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChefHat,
  ClipboardList,
  LayoutGrid,
  PieChart,
  Settings,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Console navigation — role-aware (staff never sees owner-only destinations;
 * those pages and actions enforce it server-side anyway).
 */

const OWNER_LINKS = [
  { href: "/console", label: "الطلبات", icon: LayoutGrid },
  { href: "/console/kitchen", label: "المطبخ", icon: ChefHat },
  { href: "/console/new", label: "طلب يدوي", icon: ClipboardList },
  { href: "/console/menu", label: "القائمة", icon: UtensilsCrossed },
  { href: "/console/inventory", label: "المخزون", icon: Boxes },
  { href: "/console/reports", label: "التقارير", icon: PieChart },
  { href: "/console/staff", label: "الموظفون", icon: Users },
  { href: "/console/settings", label: "الإعدادات", icon: Settings },
];

const STAFF_LINKS = OWNER_LINKS.filter((l) =>
  ["/console", "/console/kitchen", "/console/new"].includes(l.href),
);

export function ConsoleNav({ role }: { role: "owner" | "staff" }) {
  const pathname = usePathname();
  const links = role === "owner" ? OWNER_LINKS : STAFF_LINKS;

  return (
    <nav
      aria-label="أقسام الكونسول"
      className="-mx-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1 py-1 [&::-webkit-scrollbar]:hidden"
    >
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/console" && pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-colors",
              active
                ? "bg-brand text-action-text shadow-card"
                : "bg-surface-raised text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
            )}
          >
            <link.icon className="size-4" aria-hidden />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
