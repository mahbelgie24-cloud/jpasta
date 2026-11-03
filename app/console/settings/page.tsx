import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getSessionUser } from "@/lib/server/session";
import { getShopSettings } from "@/lib/server/settings";
import { ZonesEditor } from "./zones-editor";
import { ShopSettingsEditor } from "./shop-settings-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الإعدادات",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/console/login");
  // Money-affecting settings are owner-only on the server, not just in nav.
  if (user.role !== "owner") redirect("/console");
  const shop = await getShopSettings();

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
          رسوم التوصيل وإعدادات المحل تنطبق فوراً على طلبات القائمة — بدون إعادة
          نشر.
        </p>
        <ShopSettingsEditor initial={shop} />
        <ZonesEditor />
      </div>
    </div>
  );
}
