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

// v4: the catalog was replaced wholesale — old product ids/prices no longer
// exist in the database. Bumping the key clears stale carts instead of
// failing validation at submit.
const STORAGE_KEY = "jpasta.cart.v4";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  return (
    typeof line.key === "string" &&
    line.key.length > 0 &&
    typeof line.productId === "string" &&
    UUID_RE.test(line.productId) &&
    typeof line.nameAr === "string" &&
    Number.isInteger(line.quantity) &&
    (line.quantity ?? 0) > 0 &&
    (line.quantity ?? 0) <= 20 &&
    Number.isInteger(line.unitPriceMinor) &&
    (line.unitPriceMinor ?? 0) >= 0 &&
    Number.isInteger(line.lineTotalMinor) &&
    (line.lineTotalMinor ?? 0) >= 0 &&
    Array.isArray(line.selections)
  );
}

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
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(isValidLine);
          if (valid.length > 0) dispatch({ type: "hydrate", lines: valid });
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
