import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

/** API + lib unit tests. Storybook: `npm run dev:storybook` / `npm run preview-storybook`. */
export default defineConfig({
  resolve: {
    alias: {
      "@": dirname,
    },
  },
  test: {
    include: ["app/api/**/*.test.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    globals: true,
  },
});
