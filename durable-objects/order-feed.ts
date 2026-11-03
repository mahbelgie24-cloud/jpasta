import { DurableObject } from "cloudflare:workers";
import {
  isAuthorizedBroadcast,
  isFreshBroadcastTimestamp,
  verifyRealtimeToken,
} from "../lib/domain/realtime-token";

/**
 * OrderFeed — the single realtime hub for the shop.
 *
 * One instance (idFromName("jpasta")) owns every console/kitchen WebSocket,
 * across all Workers isolates. Hibernatable WebSockets keep it cheap: the
 * object sleeps between messages while connections stay open.
 *
 * Routes:
 *   GET  (Upgrade: websocket)  → connect, requires ?token=<signed>
 *   POST /broadcast            → fan out "orders-changed" after a commit
 */

interface BroadcastBody {
  at?: number;
}

export class OrderFeed extends DurableObject<CloudflareEnv> {
  private version = 0;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/broadcast") {
      // Internal fan-out is a privileged operation: authenticate it with
      // the same secret that signs WebSocket tokens, constant-time.
      if (
        !isAuthorizedBroadcast(
          request.headers.get("authorization"),
          this.env.REALTIME_SECRET,
        )
      ) {
        return new Response("unauthorized", { status: 401 });
      }
      const body = (await request.json().catch(() => ({}))) as BroadcastBody;
      if (!isFreshBroadcastTimestamp(body.at)) {
        return new Response("invalid timestamp", { status: 400 });
      }
      this.version += 1;
      const payload = JSON.stringify({
        type: "orders-changed",
        version: this.version,
        at: body.at ?? Date.now(),
      });
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(payload);
        } catch {
          // socket evicted — hibernation cleans it up
        }
      }
      return new Response("ok", { status: 200 });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", {
        status: 426,
        headers: { upgrade: "websocket" },
      });
    }

    const token = url.searchParams.get("token") ?? "";
    const secret = this.env.REALTIME_SECRET;
    const claims = secret ? await verifyRealtimeToken(token, secret) : null;
    if (!claims) {
      return new Response("unauthorized", { status: 401 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.send(
      JSON.stringify({
        type: "hello",
        version: this.version,
        role: claims.role,
        at: Date.now(),
      }),
    );

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as unknown as ResponseInit);
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    if (message === "ping") ws.send("pong");
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "warn",
        event: "realtime.socket_error",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    try {
      ws.close(1011, "socket-error");
    } catch {
      // already closed
    }
  }
}
