/**
 * Minimal Cloudflare runtime types.
 *
 * We deliberately do NOT pull the full @cloudflare/workers-types global set
 * (it conflicts with the DOM lib that React needs). This file declares only
 * the surface the JPasta worker touches: Durable Objects, the WebSocketPair,
 * and the bindings we use.
 */

declare module "cloudflare:workers" {
  export class DurableObject<Env = unknown> {
    protected readonly ctx: DurableObjectState;
    protected readonly env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectState {
  acceptWebSocket(ws: WebSocket): void;
  getWebSockets(): WebSocket[];
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

interface R2ObjectBody {
  body: ReadableStream;
  httpEtag?: string;
  httpMetadata?: { contentType?: string };
  size?: number;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
  noRetry(): void;
}

interface ExportedHandler<Env = unknown> {
  fetch?(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Response | Promise<Response>;
  scheduled?(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): void | Promise<void>;
}

interface RateLimitBinding {
  limit(key: string): Promise<{ success: boolean }>;
}

interface CloudflareEnv {
  ORDER_FEED: DurableObjectNamespace;
  MEDIA?: R2Bucket;
  AUTH_LIMIT?: RateLimitBinding;
  ORDER_LIMIT?: RateLimitBinding;
  REALTIME_SECRET?: string;
  AUTH_PEPPER?: string;
  DATABASE_URL?: string;
  CRON_SECRET?: string;
  WORKER_SELF_REFERENCE: {
    fetch(input: string, init?: RequestInit): Promise<Response>;
  };
  HYPERDRIVE?: { connectionString: string };
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

// The Workers WebSocket exposes accept() for server-side sockets.
interface WebSocket {
  accept(): void;
}
