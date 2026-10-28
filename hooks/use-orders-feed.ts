"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchConsoleBoard } from "@/app/actions/console";
import {
  alertNewOrder,
  clearTitleFlash,
  loadSoundPreference,
} from "@/lib/alert";

/**
 * Live orders feed for the console board and kitchen display.
 *
 * Transport order:
 *  1. WebSocket to /api/realtime (Durable Object, hibernatable) — <1s fan-out
 *  2. polling every 8s only while the socket is down (visibility-aware)
 *  3. BroadcastChannel keeps tabs in sync and prevents duplicate chimes
 */

export interface FeedItem {
  nameAr: string;
  detailAr: string | null;
  note: string | null;
  quantity: number;
  lineTotalMinor: number;
}

export interface FeedOrder {
  id: string;
  orderNumber: string;
  status: "received" | "preparing" | "ready";
  channel: "takeaway" | "delivery" | "dine_in";
  source: string;
  customerName: string;
  customerPhone: string;
  address: string | null;
  zoneId: string | null;
  totalMinor: number;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  customerNote: string | null;
  cancelledReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: FeedItem[];
}

export type FeedConnection = "connecting" | "live" | "polling" | "offline";

const CHANNEL_NAME = "jpasta-orders";
const LEADER_KEY = "jpasta.alert.leader";

function isAlertLeader(tabId: string): boolean {
  try {
    const raw = window.localStorage.getItem(LEADER_KEY);
    const now = Date.now();
    const parsed = raw ? (JSON.parse(raw) as { id: string; at: number }) : null;
    if (!parsed || now - parsed.at > 10_000) {
      window.localStorage.setItem(
        LEADER_KEY,
        JSON.stringify({ id: tabId, at: now }),
      );
      return true;
    }
    return parsed.id === tabId;
  } catch {
    return true;
  }
}

export function useOrdersFeed(options?: { alertOnNew?: boolean }) {
  const { alertOnNew = false } = options ?? {};
  const router = useRouter();
  const [orders, setOrders] = useState<FeedOrder[] | null>(null);
  const [connection, setConnection] = useState<FeedConnection>("connecting");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const mounted = useRef(true);
  const seenIds = useRef<Set<string>>(new Set());
  const baselineReady = useRef(false);
  const requestSeq = useRef(0);
  const wsOpen = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabId = useRef<string>("");

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const res = await fetchConsoleBoard();
      if (!mounted.current || seq !== requestSeq.current) return;
      if (res.ok) {
        const list = res.orders as FeedOrder[];
        if (!baselineReady.current) {
          baselineReady.current = true;
          for (const o of list) seenIds.current.add(o.id);
        } else if (alertOnNew) {
          const fresh = list.filter(
            (o) => o.status === "received" && !seenIds.current.has(o.id),
          );
          if (fresh.length > 0) {
            for (const o of fresh) seenIds.current.add(o.id);
            channelRef.current?.postMessage({
              type: "new-orders",
              ids: fresh.map((o) => o.id),
              count: fresh.length,
            });
            if (isAlertLeader(tabId.current)) alertNewOrder(fresh.length);
          }
        }
        for (const o of list) seenIds.current.add(o.id);
        // Keep the dedupe set bounded over a long shift.
        if (seenIds.current.size > 500) {
          seenIds.current = new Set([...seenIds.current].slice(-300));
        }
        setOrders(list);
        setLastUpdated(Date.now());
        setConnection(wsOpen.current ? "live" : "polling");
      } else {
        setConnection("offline");
        if (res.error === "unauthenticated") router.push("/console/login");
      }
    } catch {
      if (mounted.current) setConnection("offline");
    }
  }, [router, alertOnNew]);

  useEffect(() => {
    mounted.current = true;
    if (!tabId.current) {
      tabId.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    loadSoundPreference();
    // External-store sync: the initial snapshot is fetched after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let retry = 0;

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        if (!document.hidden) void refresh();
      }, 8000);
    };
    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    const scheduleReconnect = () => {
      if (closed) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const delay = Math.min(30_000, 1000 * 2 ** retry);
      retry += 1;
      reconnectTimer = setTimeout(() => void connect(), delay);
    };

    const connect = async () => {
      if (closed) return;
      if (typeof WebSocket === "undefined") {
        startPolling();
        return;
      }
      try {
        const res = await fetch("/api/realtime-token", {
          cache: "no-store",
        });
        if (!res.ok) {
          startPolling();
          scheduleReconnect();
          return;
        }
        const { token } = (await res.json()) as { token?: string };
        if (!token) {
          startPolling();
          scheduleReconnect();
          return;
        }
        const proto = location.protocol === "https:" ? "wss:" : "ws:";
        ws = new WebSocket(
          `${proto}//${location.host}/api/realtime?token=${encodeURIComponent(token)}`,
        );
        ws.onopen = () => {
          wsOpen.current = true;
          retry = 0;
          stopPolling();
          setConnection("live");
          ws?.send("ping");
        };
        ws.onmessage = (event) => {
          if (event.data === "pong") return;
          void refresh();
        };
        ws.onclose = () => {
          wsOpen.current = false;
          setConnection("polling");
          startPolling();
          scheduleReconnect();
        };
        ws.onerror = () => {
          try {
            ws?.close();
          } catch {
            // ignore
          }
        };
      } catch {
        startPolling();
        scheduleReconnect();
      }
    };

    startPolling();
    void connect();

    const onVisibility = () => {
      if (!document.hidden) {
        clearTitleFlash();
        void refresh();
      }
    };
    const onFocus = () => clearTitleFlash();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;
      channel.onmessage = (event: MessageEvent) => {
        const data = event.data as
          | { type: "new-orders"; ids: string[]; count: number }
          | { type: "refresh" };
        if (data?.type === "new-orders") {
          for (const id of data.ids) seenIds.current.add(id);
          if (alertOnNew && isAlertLeader(tabId.current)) {
            alertNewOrder(data.count);
          }
        } else if (data?.type === "refresh") {
          void refresh();
        }
      };
    } catch {
      // BroadcastChannel unsupported — single-tab behaviour is fine
    }

    return () => {
      closed = true;
      mounted.current = false;
      wsOpen.current = false;
      stopPolling();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        // already closed
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      clearTitleFlash();
      channel?.close();
      channelRef.current = null;
    };
  }, [refresh, alertOnNew]);

  return {
    orders,
    live: connection === "live",
    connection,
    lastUpdated,
    refresh,
  };
}
