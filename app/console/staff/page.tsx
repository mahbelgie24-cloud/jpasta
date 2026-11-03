import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { ConsolePageShell } from "@/components/console/page-shell";
import { StaffEditor } from "./staff-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الموظفون",
  robots: { index: false, follow: false },
};

export default async function StaffPage() {
  const user = await getSessionUser();
  if (!user) redirect("/console/login");
  if (user.role !== "owner") redirect("/console");
  return (
    <ConsolePageShell
      title="الموظفون"
      description="إضافة موظفين وإعادة تعيين الرموز وإيقاف الحسابات — بصلاحية المالك فقط."
    >
      <StaffEditor currentUserId={user.id} />
    </ConsolePageShell>
  );
}
