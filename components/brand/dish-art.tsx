import type { SauceKind, ToppingKind } from "@/lib/menu-data";

/**
 * DishArt — the JPasta illustration system.
 *
 * A deterministic, layered composition: plate shape, pasta nest, sauce,
 * toppings, garnish and steam. The same product always renders the same
 * dish, but no two products look identical. All colours come from design
 * tokens (no raw hex).
 *
 * This is also the permanent empty state once real photography exists:
 * DishMedia falls back to it whenever a product has no image.
 */

type Variant = "card" | "hero" | "tile" | "dark";

const SAUCE_TOKEN: Record<SauceKind, string> = {
  golden: "var(--color-wheat-400)",
  marinara: "var(--color-tomato-500)",
  alfredo: "var(--color-cream-100)",
  pink: "color-mix(in oklab, var(--color-tomato-500) 45%, var(--color-cream-100))",
  pesto: "var(--color-pistachio-600)",
  baked:
    "color-mix(in oklab, var(--color-wheat-500) 60%, var(--color-tomato-500))",
};

const PLATE_SHAPES = [
  { rx: 150, ry: 106, depth: 18 }, // wide oval
  { rx: 132, ry: 132, depth: 22 }, // round
  { rx: 142, ry: 98, depth: 30 }, // deep bowl
] as const;

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function rand(seed: number, index: number): number {
  const x = Math.sin(seed * 0.0001 + index * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface DishArtProps {
  seed: string;
  sauce?: SauceKind;
  toppings?: ToppingKind[];
  variant?: Variant;
  className?: string;
  /** Hide steam for dense grids and print. */
  steam?: boolean;
  /**
   * True when adjacent text already names the dish (cards, sheet titles).
   * Prevents screen readers from hearing the same generic image label for
   * every dish on the menu.
   */
  decorative?: boolean;
  ariaLabel?: string;
}

function Topping({
  kind,
  x,
  y,
  rotate,
  scale,
}: {
  kind: ToppingKind;
  x: number;
  y: number;
  rotate: number;
  scale: number;
}) {
  const transform = `translate(${x} ${y}) rotate(${rotate}) scale(${scale})`;
  switch (kind) {
    case "chicken":
      return (
        <g transform={transform}>
          <rect
            x={-16}
            y={-7}
            width={32}
            height={14}
            rx={6}
            fill="var(--color-wheat-500)"
          />
          <path
            d="M-10 -3 H10 M-12 2 H8 M-6 6 H12"
            stroke="var(--color-basil-900)"
            strokeOpacity={0.35}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </g>
      );
    case "mushroom":
      return (
        <g transform={transform}>
          <path
            d="M-11 2 C-11 -8, 11 -8, 11 2 Z"
            fill="var(--color-cream-400)"
          />
          <rect
            x={-2.5}
            y={2}
            width={5}
            height={8}
            rx={2}
            fill="var(--color-cream-300)"
          />
        </g>
      );
    case "cheese":
      return (
        <g transform={transform}>
          <path d="M-12 4 L-2 -7 L10 1 L4 9 Z" fill="var(--color-wheat-300)" />
          <path
            d="M-2 -7 L4 9"
            stroke="var(--color-wheat-600)"
            strokeWidth={1.2}
          />
        </g>
      );
    case "tomato":
      return (
        <g transform={transform}>
          <ellipse
            cx={0}
            cy={0}
            rx={10}
            ry={8}
            fill="var(--color-tomato-500)"
          />
          <path
            d="M0 -8 L-3 -12 M0 -8 L3 -12"
            stroke="var(--color-pistachio-600)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      );
    case "basil":
      return (
        <g transform={transform}>
          <path
            d="M0 0 C-10 -3, -10 -12, 0 -15 C10 -12, 10 -3, 0 0 Z"
            fill="var(--color-pistachio-600)"
          />
          <path
            d="M0 0 V-13"
            stroke="var(--color-basil-800)"
            strokeWidth={1.2}
          />
        </g>
      );
    case "chili":
      return (
        <g transform={transform}>
          <path
            d="M-12 0 C-6 8, 8 8, 13 1 C7 3, -2 2, -12 0 Z"
            fill="var(--color-tomato-500)"
          />
          <path
            d="M-12 0 L-16 -4"
            stroke="var(--color-pistachio-600)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      );
    default:
      return (
        <circle
          cx={x}
          cy={y}
          r={5 * scale}
          fill="var(--color-wheat-500)"
          opacity={0.85}
        />
      );
  }
}

export function DishArt({
  seed,
  sauce = "golden",
  toppings = [],
  variant = "card",
  className,
  steam = true,
  decorative = false,
  ariaLabel,
}: DishArtProps) {
  const h = hashSeed(seed);
  const plate = PLATE_SHAPES[h % PLATE_SHAPES.length] ?? PLATE_SHAPES[0];
  const dark = variant === "dark";
  const uid = `d${(h % 100000).toString(36)}`;
  const sauceColor = SAUCE_TOKEN[sauce] ?? SAUCE_TOKEN.golden;

  const strands = Array.from({ length: 10 }, (_, i) => {
    const spread = 34 + rand(h, i) * 58;
    const lift = 8 + rand(h, i + 40) * 18;
    const rotation = rand(h, i + 80) * 60 - 30;
    return { spread, lift, rotation, i };
  });

  const toppingSlots = toppings.slice(0, 6).map((kind, i) => {
    const angle =
      (i / Math.max(1, toppings.length)) * Math.PI * 2 + rand(h, i + 7);
    return {
      kind,
      x: 200 + Math.cos(angle) * (52 + rand(h, i + 13) * 34),
      y: 154 + Math.sin(angle) * (26 + rand(h, i + 21) * 22),
      rotate: rand(h, i + 31) * 70 - 35,
      scale: 0.8 + rand(h, i + 51) * 0.5,
    };
  });

  const plateFill = dark ? "var(--color-basil-900)" : "var(--color-cream-100)";
  const plateRim = dark ? "var(--color-basil-700)" : "var(--color-cream-400)";
  const shadow = dark ? "var(--color-basil-950)" : "var(--color-basil-800)";

  return (
    <svg
      viewBox="0 0 400 300"
      role={decorative ? undefined : "img"}
      aria-label={
        decorative ? undefined : (ariaLabel ?? "رسم توضيحي لطبق باستا")
      }
      aria-hidden={decorative || undefined}
      className={className}
    >
      <defs>
        <radialGradient id={`${uid}-plate`} cx="42%" cy="34%" r="72%">
          <stop offset="0%" stopColor={plateFill} />
          <stop
            offset="100%"
            stopColor={
              dark ? "var(--color-basil-950)" : "var(--color-cream-200)"
            }
          />
        </radialGradient>
        <radialGradient id={`${uid}-sauce`} cx="46%" cy="40%" r="62%">
          <stop offset="0%" stopColor={sauceColor} stopOpacity={0.98} />
          <stop offset="100%" stopColor={sauceColor} stopOpacity={0.72} />
        </radialGradient>
        <linearGradient id={`${uid}-pasta`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-wheat-300)" />
          <stop offset="55%" stopColor="var(--color-wheat-400)" />
          <stop offset="100%" stopColor="var(--color-wheat-500)" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <ellipse cx="200" cy="154" rx={plate.rx} ry={plate.ry} />
        </clipPath>
      </defs>

      {/* ambient glow */}
      <ellipse
        cx="200"
        cy="168"
        rx={plate.rx + 26}
        ry={plate.ry + 18}
        fill={shadow}
        opacity={dark ? 0.28 : 0.08}
      />
      <ellipse
        cx="200"
        cy="142"
        rx={plate.rx - 8}
        ry={plate.ry - 10}
        fill={plateFill}
        opacity={0.4}
      />

      {/* plate */}
      <ellipse
        cx="200"
        cy="154"
        rx={plate.rx}
        ry={plate.ry}
        fill={`url(#${uid}-plate)`}
        stroke={plateRim}
        strokeWidth={3}
      />
      <ellipse
        cx="200"
        cy="154"
        rx={plate.rx - 16}
        ry={plate.ry - 14}
        fill="none"
        stroke={plateRim}
        strokeOpacity={0.55}
        strokeWidth={1.5}
      />
      <ellipse
        cx="200"
        cy={154 + plate.depth / 2}
        rx={plate.rx - 26}
        ry={plate.ry - 30}
        fill={shadow}
        opacity={dark ? 0.18 : 0.05}
      />

      <g clipPath={`url(#${uid}-clip)`}>
        {/* sauce pool */}
        <ellipse
          cx={196 + rand(h, 3) * 16}
          cy={158 + rand(h, 4) * 10}
          rx={plate.rx * 0.62}
          ry={plate.ry * 0.56}
          fill={`url(#${uid}-sauce)`}
          opacity={0.9}
        />

        {/* pasta nest — deterministic curved strands */}
        <g stroke={`url(#${uid}-pasta)`} fill="none" strokeLinecap="round">
          {strands.map(({ spread, lift, rotation, i }) => (
            <path
              key={i}
              d={`M ${200 - spread} ${160 + rand(h, i + 5) * 10}
                  C ${200 - spread * 0.4} ${160 - lift},
                    ${200 + spread * 0.4} ${176 + lift},
                    ${200 + spread} ${158 + rand(h, i + 9) * 12}`}
              strokeWidth={7 - (i % 3)}
              transform={`rotate(${rotation} 200 160)`}
              opacity={0.92}
            />
          ))}
        </g>

        {/* wheat highlight strand */}
        <path
          d="M128 176 C160 140, 238 140, 272 172"
          stroke="var(--color-wheat-300)"
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
          opacity={0.8}
          transform={`rotate(${rand(h, 60) * 14 - 7} 200 160)`}
        />

        {/* toppings */}
        {toppingSlots.map((t, i) => (
          <Topping key={`${t.kind}-${i}`} {...t} />
        ))}

        {/* basil garnish */}
        <g
          transform={`translate(${236 + rand(h, 70) * 14} ${132 + rand(h, 71) * 8})`}
        >
          <path
            d="M0 0 C-9 -3, -9 -12, 0 -15 C9 -12, 9 -3, 0 0 Z"
            fill="var(--color-pistachio-600)"
          />
          <path
            d="M0 0 V-13"
            stroke="var(--color-basil-800)"
            strokeWidth={1.2}
          />
        </g>
      </g>

      {/* steam */}
      {steam && (
        <g
          className="motion-safe:animate-steam"
          fill="none"
          stroke={dark ? "var(--color-cream-100)" : "var(--color-basil-800)"}
          strokeLinecap="round"
          opacity={0.22}
        >
          <path d="M172 74 C164 62, 180 52, 172 38" strokeWidth={3} />
          <path d="M200 68 C192 54, 210 46, 202 30" strokeWidth={3.5} />
          <path d="M228 76 C220 64, 236 54, 228 40" strokeWidth={2.5} />
        </g>
      )}

      {/* Steam is the only ambient effect. The old SVG grain overlay used
          feTurbulence, which the browser re-rasterises for every dish (five
          on the landing) and cost seconds of main-thread render time on a
          throttled phone. A flat grain-free illustration paints instantly. */}
    </svg>
  );
}
