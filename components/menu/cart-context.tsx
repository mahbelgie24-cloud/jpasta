"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { multiplyMinor, sumMinor, type Minor } from "@/lib/pricing";

/**
 * Cart state — client-only, persisted to localStorage. Hydration-safe:
 * the server render (and first client render) see an empty cart, then the
 * persisted lines hydrate in an effect.
 */

export interface CartSelection {
  /** Server-side keys (modifier_groups.key / modifiers.key) — the server
   *  revalidates every selection and recomputes all prices. */
  groupKey: string;
  optionKey: string;
}

export interface CartLine {
  /** productId + selection hash — identical customizations merge. */
  key: string;
  productId: string;
  nameAr: string;
  detailAr: string;
  note?: string;
  quantity: number;
  unitPriceMinor: Minor;
  lineTotalMinor: Minor;
  selections: CartSelection[];
}

type Action =
  | { type: "add"; line: CartLine }
  | { type: "setQty"; key: string; quantity: number }
  | { type: "remove"; key: string }
  | { type: "clear" }
  | { type: "hydrate"; lines: CartLine[] };

function reducer(state: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case "add": {
      const existing = state.find((l) => l.key === action.line.key);
      if (existing) {
        return state.map((l) =>
          l.key === action.line.key
            ? {
                ...l,
                quantity: Math.min(20, l.quantity + action.line.quantity),
                lineTotalMinor: multiplyMinor(
                  l.unitPriceMinor,
                  Math.min(20, l.quantity + action.line.quantity),
                ),
              }
            : l,
        );
      }
      return [...state, action.line];
    }
    case "setQty": {
      if (action.quantity <= 0)
        return state.filter((l) => l.key !== action.key);
      return state.map((l) =>
        l.key === action.key
          ? {
              ...l,
              quantity: action.quantity,
              lineTotalMinor: multiplyMinor(l.unitPriceMinor, action.quantity),
            }
          : l,
      );
    }
    case "remove":
      return state.filter((l) => l.key !== action.key);
    case "clear":
      return [];
    case "hydrate":
      return action.lines;
  }
}

// v2: pre-Phase-1 carts carried placeholder catalog ids (slugs, not UUIDs) —
// bumping the key invalidates them instead of failing validation at submit.
const STORAGE_KEY = "jpasta.cart.v2";

interface CartApi {
  lines: CartLine[];
  count: number;
  subtotal: Minor;
  add: (line: CartLine) => void;
  setQty: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, dispatch] = useReducer(reducer, []);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartLine[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          dispatch({ type: "hydrate", lines: parsed });
        }
      }
    } catch {
      // corrupted storage — start fresh
    }
    // Hydrating from localStorage is a post-mount external-store sync (SSR-safe):
    // the first client render must match the server render, so persisted state
    // can only enter in an effect. Standard pattern — not the derived-state
    // anti-pattern this rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // storage unavailable — cart stays in memory
    }
  }, [lines, hydrated]);

  const api = useMemo<CartApi>(() => {
    return {
      lines,
      count: sumMinor(lines.map((l) => l.quantity)),
      subtotal: sumMinor(lines.map((l) => l.lineTotalMinor)),
      add: (line) => dispatch({ type: "add", line }),
      setQty: (key, quantity) => dispatch({ type: "setQty", key, quantity }),
      remove: (key) => dispatch({ type: "remove", key }),
      clear: () => dispatch({ type: "clear" }),
    };
  }, [lines]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
