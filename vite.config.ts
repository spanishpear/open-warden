import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
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
