import { TwirlLoader } from "@/components/ui/twirl-loader";

/** App-level loading shell — brand loader, no layout shift. */
export default function Loading() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas"
    >
      <TwirlLoader className="size-12" label="جارٍ التحميل…" />
      <p className="text-sm text-text-secondary">لحظة… نجهّز الطاولة</p>
    </main>
  );
}
