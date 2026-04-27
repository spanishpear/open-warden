import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    // @ts-expect-error -- oxlint typescript
    environmentMatchGlobs: [["electron/**/*.test.ts", "node"]],
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "electron/**/*.test.ts"],
    alias: [
      {
        find: "better-sqlite3",
        replacement: path.resolve(__dirname, "./__mocks__/better-sqlite3.ts"),
      },
    ],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}", "electron/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/main.tsx"],
    },
  },
});
