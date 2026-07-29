import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    rules: {
      // Astro component props are frequently typed `any` pre-Phase-2; revisit once schema firms up.
      "@typescript-eslint/no-explicit-any": "off",
      // Codebase uses `cond ? a() : b()` as a terse branch statement throughout src/lib.
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      // Deliberate no-op branches/catches appear in the existing terse style (e.g. schedule.js, state.js).
      "no-empty": "off",
    },
  },
  {
    files: ["src/scripts/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["src/lib/og.js"],
    languageOptions: { globals: globals.node },
  },
  {
    // Deno runtime, different global set (Deno.*) — out of scope for the Astro/Node lint config.
    ignores: ["dist/**", ".astro/**", "supabase/functions/**"],
  },
);
