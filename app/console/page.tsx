import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { ConsoleBoard } from "./console-board";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "لوحة الطلبات",
  robots: { index: false, follow: false },
};

export default async function ConsolePage() {
  const user = await getSessionUser();
  if (!user) redirect("/console/login");
  return <ConsoleBoard ownerName={user.name} role={user.role} />;
}
