import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vitest deliberately gets its own config: the app's vite.config.js must not
// be edited, and unit/integration tests need jsdom + the jest-dom setup that
// the dev server doesn't care about. Playwright (e2e/) is excluded — it has
// its own runner (playwright.config.ts) and only runs against a live deploy.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "e2e"],
    setupFiles: ["src/test/setup.ts"],
    globals: false, // explicit `import { describe, it, expect } from "vitest"`
    css: false,
    testTimeout: 15000,
  },
});
