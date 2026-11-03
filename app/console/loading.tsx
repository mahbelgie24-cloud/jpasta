import { TwirlLoader } from "@/components/ui/twirl-loader";

/**
 * Console-scoped loading boundary. Without this, a console navigation falls
 * back to the root (cream) loading screen and flashes a bright page inside
 * the dark console. The layout already supplies the dark surface.
 */
export default function ConsoleLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center gap-3 text-text-secondary">
      <TwirlLoader className="size-8" label="جارٍ التحميل…" />
      جارٍ التحميل…
    </div>
  );
}
