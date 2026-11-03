import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { ConsolePageShell } from "@/components/console/page-shell";
import { InventoryAdmin } from "./inventory-admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "المخزون والوصفات",
  robots: { index: false, follow: false },
};

export default async function InventoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/console/login");
  if (user.role !== "owner") redirect("/console");
  return (
    <ConsolePageShell
      title="المخزون والوصفات"
      description="كل حركة مخزون مسجّلة، والبيع يخصم المكوّنات تلقائياً."
    >
      <InventoryAdmin />
    </ConsolePageShell>
  );
}
