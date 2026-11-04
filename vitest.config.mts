import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Component tests (.tsx) opt in to a browser-like environment with `// @vitest-environment jsdom`.
  test: { environment: "node", include: ["tests/**/*.test.{ts,tsx}"] },
});
