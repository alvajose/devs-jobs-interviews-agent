import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts"],
      reporter: ["text-summary", "text"],
      // Modest ratchet floor, focused on the pure logic we actually test (money + security).
      // Raise these as coverage grows; never lower them.
      thresholds: {
        "src/lib/credits-math.ts": { statements: 90, branches: 80, functions: 90 },
        "src/lib/env.ts": { statements: 90, branches: 85, functions: 90 },
        "src/lib/payload-limits.ts": { statements: 85, branches: 80, functions: 80 },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
