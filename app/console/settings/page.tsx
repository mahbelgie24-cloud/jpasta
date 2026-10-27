import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getSessionUser } from "@/lib/server/session";
import { ZonesEditor } from "./zones-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الإعدادات",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/console/login");

  return (
    <div className="min-h-dvh bg-cream-100">
      <div className="mx-auto max-w-2xl px-4 pt-5 pb-16 sm:px-6">
        <Link
          href="/console"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-basil-700 hover:text-basil-600"
        >
          <ArrowRight className="size-4" aria-hidden />
          رجوع للوحة
        </Link>
        <h1 className="mt-4 type-section text-ink">الإعدادات</h1>
        <p className="mt-1 text-sm text-ink-soft">
          رسوم التوصيل تنطبق فوراً على طلبات القائمة — بدون إعادة نشر.
        </p>
        <ZonesEditor />
      </div>
    </div>
  );
}
