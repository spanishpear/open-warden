import path from "node:path";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { defineConfig } from "vite-plus";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default defineConfig({
  plugins: [react()],
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  test: {
    environment: "jsdom",
    // @ts-expect-error -- oxlint typescript
    environmentMatchGlobs: [["apps/desktop/electron/**/*.test.ts", "node"]],
    globals: true,
    setupFiles: ["apps/desktop/src/test/setup.ts"],
    include: ["apps/desktop/src/**/*.{test,spec}.{ts,tsx}", "apps/desktop/electron/**/*.test.ts"],
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "apps/desktop/src"),
      },
      {
        find: "better-sqlite3",
        replacement: path.resolve(__dirname, "apps/desktop/__mocks__/better-sqlite3.ts"),
      },
    ],
  },
  lint: {
    ignorePatterns: [
      "coverage",
      "dist",
      "dist-electron",
      "node_modules",
      "out",
      ".vite",
      "playwright-report",
      "test-results",
      "t3code",
      "*.tsbuildinfo",
    ],
    plugins: ["eslint", "oxc", "react", "unicorn", "typescript"],
    categories: {
      correctness: "warn",
      suspicious: "warn",
      perf: "warn",
    },
    rules: {
      "react-in-jsx-scope": "off",
      "eslint/no-await-in-loop": "off",
      "eslint/no-shadow": "off",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
