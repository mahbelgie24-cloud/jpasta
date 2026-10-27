"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchConsoleBoard } from "@/app/actions/console";
import { alertNewOrder, loadSoundPreference } from "@/lib/alert";

/**
 * Live orders feed (Phase 2): the console board and kitchen display share
 * this hook. Primary transport is SSE (`/api/console/stream`, ~0ms after
 * commit — DoD < 2s); a 5s poll runs as the reconnect/legacy fallback.
 * New "received" orders trigger the audible/visual alert exactly once.
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
  customerName: string;
  customerPhone: string;
  address: string | null;
  totalMinor: number;
  deliveryFeeMinor: number;
  customerNote: string | null;
  createdAt: string;
  items: FeedItem[];
}

export function useOrdersFeed(options?: { alertOnNew?: boolean }) {
  const { alertOnNew = false } = options ?? {};
  const router = useRouter();
  const [orders, setOrders] = useState<FeedOrder[] | null>(null);
  const [live, setLive] = useState(false);
  const mounted = useRef(true);
  const seenIds = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchConsoleBoard();
      if (!mounted.current) return;
      if (res.ok) {
        const list = res.orders as FeedOrder[];
        if (seenIds.current === null) {
          // first load — baseline, never alerts on history
          seenIds.current = new Set(list.map((o) => o.id));
        } else if (alertOnNew) {
          const fresh = list.filter(
            (o) => o.status === "received" && !seenIds.current?.has(o.id),
          );
          if (fresh.length > 0) alertNewOrder(fresh.length);
        }
        for (const o of list) seenIds.current?.add(o.id);
        setOrders(list);
        setLive(true);
      } else {
        setLive(false);
        if (res.error === "unauthenticated") router.push("/console/login");
      }
    } catch {
      if (mounted.current) setLive(false);
    }
  }, [router, alertOnNew]);

  useEffect(() => {
    mounted.current = true;
    loadSoundPreference();
    // Initial fetch + push subscription — the canonical external-system
    // sync effect; setStates run after await boundaries, never in render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/console/stream");
      es.onmessage = () => void refresh();
      es.onopen = () => setLive(true);
      es.onerror = () => {
        // EventSource auto-reconnects; the 5s poll covers the gap
        setLive(false);
      };
    } catch {
      es = null; // EventSource unavailable — polling carries the feed
    }
    const interval = setInterval(() => void refresh(), 5000);

    return () => {
      mounted.current = false;
      es?.close();
      clearInterval(interval);
    };
  }, [refresh]);

  return { orders, live, refresh };
}
