import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { PinLogin } from "./pin-login";
import { getSessionUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "دخول الكونسول",
  robots: { index: false, follow: false },
};

export default async function ConsoleLoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/console");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <LogoMark className="size-20" />
      <h1 className="mt-5 type-section text-ink">كونسول JPasta</h1>
      <p className="mt-2 text-sm text-ink-soft">أدخل رمز الدخول الخاص بك</p>
      <PinLogin />
    </div>
  );
}
