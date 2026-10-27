import { getSessionUser } from "@/lib/server/session";
import { bus, ORDERS_CHANGED } from "@/lib/server/bus";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream for the console board / kitchen display.
 * Auth is the session cookie (same boundary as every console action).
 * Every order write calls notifyOrdersChanged() → subscribers refresh
 * within milliseconds (Phase 2 DoD: ticket latency < 2s).
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let onChange: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          // stream already closed — cleanup handles the rest
        }
      };
      send("connected");
      onChange = () => send("orders-changed");
      bus.on(ORDERS_CHANGED, onChange);
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": hb\n\n"));
        } catch {
          // ignore — abort cleanup runs on disconnect
        }
      }, 25000);
      request.signal.addEventListener("abort", () => {
        if (onChange) bus.off(ORDERS_CHANGED, onChange);
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      if (onChange) bus.off(ORDERS_CHANGED, onChange);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
