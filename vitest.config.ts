import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: ".vite-cache",
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
  },
});
