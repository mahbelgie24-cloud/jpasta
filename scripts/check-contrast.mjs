#!/usr/bin/env node
/**
 * WCAG contrast gate for the brand's critical token pairs.
 *
 * Colours are the approved hex equivalents from docs/brand/brand.md (the
 * runtime tokens are OKLCH equivalents). Run in CI; add a pair whenever a
 * new text/surface combination becomes part of the system.
 */
const PAIRS = [
  { fg: "#182620", bg: "#FDFBF7", min: 4.5, label: "ink / cream-50" },
  { fg: "#4A5A51", bg: "#FDFBF7", min: 4.5, label: "ink-soft / cream-50" },
  { fg: "#FDFBF7", bg: "#235C3E", min: 4.5, label: "cream-50 / basil-700" },
  { fg: "#F9F5EC", bg: "#1B4831", min: 4.5, label: "cream-100 / basil-800" },
  { fg: "#F9F5EC", bg: "#0C2419", min: 7, label: "cream-100 / basil-950" },
  { fg: "#B3402F", bg: "#FDFBF7", min: 4.5, label: "terracotta / cream-50" },
  {
    fg: "#B4791B",
    bg: "#FDFBF7",
    min: 3,
    label: "bronze / cream-50 (large/icon)",
  },
  { fg: "#2C714B", bg: "#FDFBF7", min: 4.5, label: "basil-600 / cream-50" },
  { fg: "#E3C98F", bg: "#0C2419", min: 7, label: "wheat-300 / basil-950" },
  { fg: "#F9F5EC", bg: "#0C2419", min: 7, label: "cream-100 / basil-950" },
];

function channel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

let failed = 0;
for (const pair of PAIRS) {
  const ratio = contrast(pair.fg, pair.bg);
  const ok = ratio >= pair.min;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "✓" : "✗"} ${pair.label.padEnd(34)} ${ratio.toFixed(2)} (min ${pair.min})`,
  );
}

if (failed > 0) {
  console.error(`\n✗ ${failed} contrast pair(s) below target`);
  process.exit(1);
}
console.log("\n✓ all contrast pairs pass");
