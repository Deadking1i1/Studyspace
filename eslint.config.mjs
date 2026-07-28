import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const ignores = [
  ".next/**",
  ".next-study-space/**",
  ".next-study-space-stale-*/**",
  "node_modules/**",
  "migrations/**",
  "static/**",
  "templates/**",
  "routes/**",
  "models/**",
  "tests/**",
  "migration-data/**",
];

export default [
  { ignores },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
