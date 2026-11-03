import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/server/session";
import { readShopSettings, type ShopSettings } from "@/lib/server/settings";
import { ConsolePageShell } from "@/components/console/page-shell";
import { PushToggle } from "@/components/console/push-toggle";
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

  // Never render editable defaults after a failed read: saving that form
  // would overwrite the real kill switch and delivery fees with guesses.
  let shop: ShopSettings | null;
  try {
    shop = await readShopSettings();
  } catch {
    shop = null;
  }

  if (!shop) {
    return (
      <ConsolePageShell title="الإعدادات" widthClass="max-w-2xl">
        <div
          role="alert"
          className="rounded-card border border-danger/30 bg-danger/10 p-5 text-sm font-bold text-danger"
        >
          تعذر قراءة إعدادات المحل الآن. لم يتم عرض أي قيم حتى لا تحفظ بالخطأ
          فوق إعداداتك الحقيقية — أعد المحاولة بعد قليل.
        </div>
        <Link
          href="/console/settings"
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-bold text-action-text"
        >
          إعادة المحاولة
        </Link>
      </ConsolePageShell>
    );
  }

  return (
    <ConsolePageShell
      title="الإعدادات"
      description="رسوم التوصيل وإعدادات المحل تنطبق فوراً على طلبات القائمة — بدون إعادة نشر."
      widthClass="max-w-2xl"
    >
      <ShopSettingsEditor initial={shop} />

      <section className="mt-5 rounded-card border border-border-soft bg-surface-raised p-4">
        <h2 className="font-bold text-text-primary">إشعارات الطلبات</h2>
        <p className="mt-1 text-sm text-text-secondary">
          فعّل الإشعارات على هذا الجهاز ليصلك تنبيه فوري عند وصول طلب جديد —
          بدون بيانات زبون داخل الإشعار.
        </p>
        <div className="mt-3">
          <PushToggle />
        </div>
      </section>

      <ZonesEditor />
    </ConsolePageShell>
  );
}
