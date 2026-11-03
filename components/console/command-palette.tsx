"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  ChefHat,
  ClipboardList,
  History,
  LayoutGrid,
  LogOut,
  PieChart,
  Search,
  Settings,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { arabicIncludes } from "@/lib/arabic";
import { consoleLogout } from "@/app/actions/console";
import { cn } from "@/lib/utils";

interface PaletteCommand {
  id: string;
  label: string;
  keywords: string;
  icon: LucideIcon;
  run: () => void;
}

const OWNER_COMMANDS: Array<{
  id: string;
  label: string;
  keywords: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    id: "board",
    label: "لوحة الطلبات",
    keywords: "الطلبات اللوحة board orders",
    href: "/console",
    icon: LayoutGrid,
  },
  {
    id: "archive",
    label: "أرشيف الطلبات",
    keywords: "الأرشيف السجل archive history",
    href: "/console/orders",
    icon: History,
  },
  {
    id: "kitchen",
    label: "شاشة المطبخ",
    keywords: "المطبخ المطبخ kitchen kds",
    href: "/console/kitchen",
    icon: ChefHat,
  },
  {
    id: "new",
    label: "طلب يدوي جديد",
    keywords: "طلب جديد يدوي هاتف new order manual",
    href: "/console/new",
    icon: ClipboardList,
  },
  {
    id: "menu",
    label: "إدارة القائمة",
    keywords: "القائمة الأصناف الأسعار menu products",
    href: "/console/menu",
    icon: UtensilsCrossed,
  },
  {
    id: "inventory",
    label: "المخزون والوصفات",
    keywords: "المخزون الوصفات المكونات inventory recipes",
    href: "/console/inventory",
    icon: Boxes,
  },
  {
    id: "reports",
    label: "التقارير",
    keywords: "التقارير المبيعات Z reports sales",
    href: "/console/reports",
    icon: PieChart,
  },
  {
    id: "staff",
    label: "الموظفون",
    keywords: "الموظفون الفريق staff team",
    href: "/console/staff",
    icon: Users,
  },
  {
    id: "settings",
    label: "الإعدادات",
    keywords: "الإعدادات المحل التوصيل settings shop",
    href: "/console/settings",
    icon: Settings,
  },
];

const STAFF_IDS = new Set(["board", "archive", "kitchen", "new"]);

export function CommandPalette({ role }: { role: "owner" | "staff" }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const commands = useMemo<PaletteCommand[]>(() => {
    const allowed = OWNER_COMMANDS.filter(
      (command) => role === "owner" || STAFF_IDS.has(command.id),
    );
    return [
      ...allowed.map((command) => ({
        id: command.id,
        label: command.label,
        keywords: command.keywords,
        icon: command.icon,
        run: () => {
          setOpen(false);
          router.push(command.href);
        },
      })),
      {
        id: "logout",
        label: "تسجيل الخروج",
        keywords: "خروج تسجيل logout signout",
        icon: LogOut,
        run: () => {
          setOpen(false);
          void consoleLogout().then(() => {
            router.push("/console/login");
            router.refresh();
          });
        },
      },
    ];
  }, [role, router]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return commands;
    return commands.filter(
      (command) =>
        arabicIncludes(command.label, q) || arabicIncludes(command.keywords, q),
    );
  }, [commands, query]);

  useEffect(() => {
    const openPalette = () => {
      setQuery("");
      setActive(0);
      setOpen(true);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("jpasta:command-palette", openPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("jpasta:command-palette", openPalette);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function run(index: number) {
    const command = filtered[index];
    if (command) command.run();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="لوحة الأوامر"
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === dialogRef.current) setOpen(false);
      }}
      className="fixed inset-x-0 top-24 m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-border-soft bg-surface p-0 text-text-primary shadow-overlay"
    >
      <div className="flex items-center gap-2 border-b border-border-soft px-4">
        <Search className="size-4 shrink-0 text-text-secondary" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((current) =>
                Math.min(filtered.length - 1, current + 1),
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => Math.max(0, current - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              run(active);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
          }}
          role="combobox"
          aria-label="بحث الأوامر"
          aria-expanded="true"
          aria-controls="console-command-list"
          aria-autocomplete="list"
          aria-activedescendant={
            filtered[active]
              ? `console-command-${filtered[active].id}`
              : undefined
          }
          placeholder="ابحث عن صفحة أو أمر…"
          className="min-h-12 w-full bg-transparent text-sm outline-none placeholder:text-text-secondary/60"
        />
        <kbd className="hidden shrink-0 rounded border border-border-soft px-1.5 py-0.5 text-[11px] text-text-secondary sm:block">
          Esc
        </kbd>
      </div>

      <ul
        id="console-command-list"
        role="listbox"
        aria-label="الأوامر"
        className="max-h-[55dvh] overflow-y-auto p-2"
      >
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-text-secondary">
            لا نتائج مطابقة.
          </li>
        ) : (
          filtered.map((command, index) => (
            <li
              key={command.id}
              id={`console-command-${command.id}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                run(index);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-bold",
                index === active
                  ? "bg-brand text-action-text"
                  : "text-text-primary hover:bg-surface-raised",
              )}
            >
              <command.icon className="size-4 shrink-0" aria-hidden />
              {command.label}
            </li>
          ))
        )}
      </ul>

      <p className="border-t border-border-soft px-4 py-2 text-[11px] text-text-secondary">
        ↑↓ للتنقل · Enter للفتح · Esc للإغلاق
      </p>
    </dialog>
  );
}
