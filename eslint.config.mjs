import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Standalone design exploration (static pages, no Next runtime).
    "design-lab/**",
  ]),
  // Money rule (AGENTS.md): money arithmetic never touches floats in the
  // production path — conversion happens only in lib/pricing.ts.
  // RTL rule (DESIGN.md §10): physical directional classes never ship —
  // logical properties (ms/me/ps/pe/start/end) only. The ltr:/rtl: variants
  // are direction-aware and stay allowed.
  {
    files: [
      "app/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "db/**/*.{ts,tsx}",
    ],
    ignores: ["**/*.test.*"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='parseFloat']",
          message:
            "Do not use parseFloat on money. Convert at the boundary via lib/pricing.ts (toMinorUnits / fromMinorUnits). See AGENTS.md 'Money representation'.",
        },
        {
          selector:
            "Literal[value=/\\b(pl|pr|ml|mr)-\\d/][raw=/\\b(pl|pr|ml|mr)-\\d/]",
          message:
            "Physical padding/margin (pl-/pr-/ml-/mr-) breaks Arabic RTL. Use ps-/pe-/ms-/me- (DESIGN.md §10).",
        },
        {
          selector:
            "Literal[value=/\\btext-(left|right)\\b/][raw=/\\btext-(left|right)\\b/]",
          message:
            "text-left/text-right is physical; use text-start/text-end (DESIGN.md §10).",
        },
        {
          selector:
            "Literal[value=/\\s(-)?(left|right)-\\d|^(-)?(left|right)-\\d/][raw=/\\s(-)?(left|right)-\\d|^(-)?(left|right)-\\d/]",
          message:
            "Physical inset (left-/right-) breaks RTL. Use start-/end- (DESIGN.md §10).",
        },
        {
          selector:
            "Literal[value=/\\brounded-(tl|tr|bl|br|l\\b|r\\b|l-|r-)/][raw=/\\brounded-(tl|tr|bl|br|l\\b|r\\b|l-|r-)/]",
          message:
            "Physical corner rounding (rounded-l/r/tl/…) breaks RTL. Use rounded-ss/se/es/ee (DESIGN.md §10).",
        },
      ],
    },
  },
]);

export default eslintConfig;
