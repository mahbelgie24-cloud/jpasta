import { getSessionUser } from "@/lib/server/session";
import { ConsoleChrome } from "@/components/console/console-chrome";

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    // Dark, glare-free surface for a shop that runs until 01:00.
    // Each page still performs its own server-side auth/role gate.
    <div className="theme-console min-h-dvh bg-surface text-text-primary print:min-h-0 print:bg-white print:text-black">
      {user && <ConsoleChrome role={user.role} />}
      {children}
    </div>
  );
}
