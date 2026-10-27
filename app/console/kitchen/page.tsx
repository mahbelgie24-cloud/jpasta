import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { KitchenBoard } from "./kitchen-board";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "شاشة المطبخ",
  robots: { index: false, follow: false },
};

export default async function KitchenPage() {
  const user = await getSessionUser();
  if (!user) redirect("/console/login");
  return <KitchenBoard />;
}
