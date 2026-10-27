import type { SauceKind, ToppingKind } from "@/lib/menu-data";
import { cn } from "@/lib/utils";

/**
 * Dish illustration system (brand.md §6) — the placeholder/fallback imagery
 * until real photography lands in R2. Flat, on-brand, deterministic per
 * product. Decorative only: the product name carries the meaning (aria-hidden).
 */

const SAUCES: Record<SauceKind, { fill: string; noodle: string }> = {
  alfredo: { fill: "#EFE3C6", noodle: "rgba(27,72,49,0.10)" },
  marinara: { fill: "#C4553B", noodle: "rgba(255,255,255,0.35)" },
  pesto: { fill: "#5A8F62", noodle: "rgba(255,255,255,0.30)" },
  pink: { fill: "#D98A7A", noodle: "rgba(255,255,255,0.35)" },
  baked: { fill: "#D9A96E", noodle: "rgba(255,255,255,0.30)" },
  golden: { fill: "#E0B96A", noodle: "rgba(27,72,49,0.12)" },
};

function BasilLeaf({
  x,
  y,
  flip = false,
}: {
  x: number;
  y: number;
  flip?: boolean;
}) {
  return (
    <path
      d={`M ${x} ${y} C ${x + 6} ${y - 4.5}, ${x + 12} ${y - 0.5}, ${x + 11} ${y + 6} C ${x + 4} ${y + 7.5}, ${x - 0.5} ${y + 4}, ${x} ${y} Z`}
      fill="#3D8A5F"
      transform={flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined}
    />
  );
}

function Tomato({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="3.6" fill="#C4553B" />
      <circle cx={x - 1.2} cy={y - 1.2} r="0.9" fill="#F9F5EC" opacity="0.7" />
    </g>
  );
}

function Chicken({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="9" height="5.5" rx="2.4" fill="#D9A96E" />
      <rect
        x={x + 2}
        y={y - 3.4}
        width="7"
        height="4.4"
        rx="2"
        fill="#C9934F"
      />
    </g>
  );
}

function Mushroom({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path
        d={`M ${x - 4} ${y} A 4 3.4 0 0 1 ${x + 4} ${y} Z`}
        fill="#B99C77"
      />
      <rect x={x - 1.3} y={y} width="2.6" height="2.6" rx="1" fill="#A08659" />
    </g>
  );
}

function Cheese({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="#F1E4C0" strokeWidth="2" strokeLinecap="round">
      <path d={`M ${x} ${y} L ${x + 4.5} ${y - 1.5}`} />
      <path d={`M ${x + 3} ${y + 3} L ${x + 8} ${y + 2}`} />
      <path d={`M ${x + 1.5} ${y + 6} L ${x + 6} ${y + 5}`} />
    </g>
  );
}

function Chili({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M ${x} ${y} C ${x + 3} ${y - 2.5}, ${x + 6.5} ${y - 2}, ${x + 8.5} ${y + 1} C ${x + 6} ${y + 0.5}, ${x + 3} ${y + 1.5}, ${x} ${y} Z`}
      fill="#B3402F"
    />
  );
}

function renderTopping(kind: ToppingKind, x: number, y: number) {
  switch (kind) {
    case "basil":
      return <BasilLeaf key={kind} x={x} y={y} />;
    case "tomato":
      return <Tomato key={kind} x={x} y={y} />;
    case "chicken":
      return <Chicken key={kind} x={x} y={y} />;
    case "mushroom":
      return <Mushroom key={kind} x={x} y={y} />;
    case "cheese":
      return <Cheese key={kind} x={x} y={y} />;
    case "chili":
      return <Chili key={kind} x={x} y={y} />;
  }
}

const TOPPING_SLOTS: Array<[number, number]> = [
  [40, 38],
  [56, 34],
  [72, 39],
  [48, 43],
  [66, 43],
  [80, 42],
];

interface Props {
  sauce: SauceKind;
  toppings: ToppingKind[];
  /** cup for drinks, bread for garlic bread — else the pasta bowl. */
  kind?: "bowl" | "cup" | "bread";
  className?: string;
}

export function DishIllustration({
  sauce,
  toppings,
  kind = "bowl",
  className,
}: Props) {
  const s = SAUCES[sauce];

  return (
    <svg
      viewBox="0 0 120 90"
      aria-hidden="true"
      className={cn("select-none", className)}
    >
      <ellipse cx="60" cy="84" rx="32" ry="4" fill="#182620" opacity="0.07" />

      {kind === "bowl" && (
        <g>
          {/* bowl body */}
          <path
            d="M 20 42 A 40 40 0 0 0 100 42 Z"
            fill="#F9F5EC"
            stroke="#E7DDC8"
            strokeWidth="2"
          />
          {/* bowl foot */}
          <rect x="48" y="81" width="24" height="3.4" rx="1.7" fill="#E7DDC8" />
          {/* rim */}
          <ellipse
            cx="60"
            cy="42"
            rx="40"
            ry="10"
            fill="#F2EBDB"
            stroke="#E7DDC8"
            strokeWidth="2"
          />
          {/* sauce mound */}
          <ellipse cx="60" cy="40.5" rx="33" ry="8.2" fill={s.fill} />
          {/* noodles */}
          <g
            fill="none"
            stroke={s.noodle}
            strokeWidth="2.6"
            strokeLinecap="round"
          >
            <path d="M 33 41 C 42 35.5, 54 44.5, 66 38.5 C 74 34.5, 82 38.5, 87 41" />
            <path d="M 38 44 C 50 39.5, 62 46.5, 76 41.5" />
            <path d="M 46 37.5 C 54 33.5, 64 39.5, 74 36" />
          </g>
          {/* toppings */}
          {toppings.map((t, i) => {
            const slot = TOPPING_SLOTS[i % TOPPING_SLOTS.length];
            if (!slot) return null;
            return renderTopping(t, slot[0], slot[1]);
          })}
        </g>
      )}

      {kind === "cup" && (
        <g>
          <path
            d="M 42 30 L 48 78 A 4 4 0 0 0 52 82 L 68 82 A 4 4 0 0 0 72 78 L 78 30 Z"
            fill="#F9F5EC"
            stroke="#E7DDC8"
            strokeWidth="2"
          />
          <path
            d="M 45 42 L 49.5 76 A 2 2 0 0 0 51.5 78 L 68.5 78 A 2 2 0 0 0 70.5 76 L 75 42 Z"
            fill={s.fill}
            opacity="0.9"
          />
          {/* straw */}
          <path
            d="M 66 12 L 60 44"
            stroke="#2C714B"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <rect x="40" y="26" width="40" height="6" rx="3" fill="#E7DDC8" />
          <BasilLeaf x={52} y={20} />
        </g>
      )}

      {kind === "bread" && (
        <g>
          <path
            d="M 22 56 C 22 40, 38 32, 60 32 C 82 32, 98 40, 98 56 C 98 66, 88 72, 60 72 C 32 72, 22 66, 22 56 Z"
            fill="#E0B96A"
            stroke="#D4AF6E"
            strokeWidth="2"
          />
          <g
            stroke="#B98F4C"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          >
            <path d="M 40 44 C 46 41, 52 41, 58 44" />
            <path d="M 64 44 C 70 41, 76 41, 82 44" />
            <path d="M 46 54 C 52 51, 58 51, 64 54" />
          </g>
          <BasilLeaf x={70} y={30} />
        </g>
      )}
    </svg>
  );
}
