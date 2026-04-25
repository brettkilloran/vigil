import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const dirname =
  typeof import.meta.dirname === "undefined"
    ? path.dirname(fileURLToPath(import.meta.url))
    : import.meta.dirname;

/** API + lib unit tests. Storybook: `pnpm run dev:storybook` / `pnpm run preview-storybook`. */
export default defineConfig({
  resolve: {
    alias: {
      "@": dirname,
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["app/api/**/*.test.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
