import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      // stub server-only so server modules can be imported in tests
      "server-only": resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
})
