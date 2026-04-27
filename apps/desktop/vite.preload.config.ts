import path from "node:path";

import { defineConfig } from "vite-plus";

// @ts-expect-error -- oxlint typescript
const external = ["electron", ...Object.keys(process.binding("natives"))];

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: ".vite/build",
    rolldownOptions: {
      external,
      output: {
        entryFileNames: "preload.cjs",
        format: "cjs",
      },
    },
    ssr: path.resolve(__dirname, "electron/preload.ts"),
    target: "node20",
  },
  clearScreen: false,
});
