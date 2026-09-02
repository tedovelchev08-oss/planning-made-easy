import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/**
 * ESLint flat config.
 *
 * Rule-level decisions (Phase 0 — intentionally surfaced, not silenced):
 *  - no-empty allows empty catch blocks: the codebase uses `catch { }` as
 *    deliberate graceful degradation (storage quota, clipboard, audio).
 *  - @typescript-eslint/no-unused-vars ignores `_`-prefixed names (idiomatic
 *    for intentionally unused callback params).
 *  - no-explicit-any and react-hooks/exhaustive-deps are WARNINGS for now:
 *    the codebase has intentional any-casts (CustomEvent plumbing, WebAudio
 *    vendor prefixes) and intentional dep omissions. Both stay visible in CI
 *    output for a later cleanup pass without blocking it.
 *  - react-hooks/rules-of-hooks stays an ERROR — it catches real bugs.
 */
export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
