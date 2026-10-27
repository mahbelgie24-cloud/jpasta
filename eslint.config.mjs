import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  // Money rule (AGENTS.md): money arithmetic never touches floats in the
  // production path — conversion happens only in lib/pricing.ts.
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
      ],
    },
  },
]);

export default eslintConfig;
