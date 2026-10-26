import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Performance baselines (`pnpm perf`): kept out of `pnpm test`, run one file at a time for steadier numbers. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/perf/**/*.perf.ts"],
    fileParallelism: false,
    testTimeout: 300_000,
  },
});
