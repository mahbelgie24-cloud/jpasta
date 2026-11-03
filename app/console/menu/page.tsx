import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { ConsolePageShell } from "@/components/console/page-shell";
import { MenuAdmin } from "./menu-admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إدارة القائمة",
  robots: { index: false, follow: false },
};

export default async function MenuAdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/console/login");
  if (user.role !== "owner") redirect("/console");
  return (
    <ConsolePageShell
      title="إدارة القائمة"
      description="الظهور والأسعار والصور — كل تغيير سعر مسجّل في سجل التدقيق."
    >
      <MenuAdmin />
    </ConsolePageShell>
  );
}
