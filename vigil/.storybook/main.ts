import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/nextjs";
import type { Configuration } from "webpack";

const require = createRequire(import.meta.url);
const storybookDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(storybookDir, "..");

/**
 * `@storybook/nextjs` aliases `react` / `react-dom` to `next/dist/compiled/*`. That copy can drift from
 * the app’s `node_modules` React (e.g. React 19) and trigger reconciliation bugs in the iframe such as
 * `removeChild`: "The node to be removed is not a child of this node." Strip those aliases so Storybook
 * uses the same React as the app. See https://github.com/storybookjs/storybook/issues/30646
 *
 * After stripping, **re-pin** `react` / `react-dom` to this repo’s `node_modules` so webpack never
 * resolves a half-configured graph (can manifest as a blank manager or preview on Windows).
 */
const NEXT_COMPILED_REACT_ALIAS_KEYS = [
  "react",
  "react-dom/test-utils",
  "react-dom$",
  "react-dom/client",
  "react-dom/server",
] as const;

function pinAppReactAliases(map: Record<string, unknown>) {
  try {
    const reactDir = path.dirname(require.resolve("react/package.json", { paths: [repoRoot] }));
    const reactDomDir = path.dirname(require.resolve("react-dom/package.json", { paths: [repoRoot] }));
    map.react = reactDir;
    map["react-dom"] = reactDomDir;
    /* Storybook / Next sometimes register the exact-match key only. */
    map["react-dom$"] = reactDomDir;
  } catch {
    /* If install is broken, leave webpack defaults — build will fail loudly elsewhere. */
  }
}

/**
 * heartgarden UI documentation. App directory in git is `vigil/` (see `docs/NAMING.md`); stories are colocated under `src/components/**` and use explicit `meta.title` paths (`Heartgarden/Overview`, `UI/*`, `Experiments/*`) — not filesystem folders — for the sidebar.
 * Invariants: see `AGENTS.md` § "Local dev, Node, and Storybook (guardrails)".
 */
const config: StorybookConfig = {
  stories: ["../src/components/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  /** Keep minimal until dev UI is stable; add Chromatic / Vitest / onboarding back one at a time. */
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],
  /**
   * Storybook 10 validates Host/Origin separately from webpack. Use `true` when using non-default hosts
   * or proxies (see `core.allowedHosts` docs).
   * @see https://storybook.js.org/docs/api/main-config/main-config-core
   */
  core: {
    allowedHosts: true,
    disableTelemetry: true,
  },
  /**
   * Default npm scripts bind **localhost** (not 0.0.0.0) so Windows HMR / dev-server client URLs stay
   * consistent. Use `npm run storybook:lan` when you need the LAN URL.
   */
  webpackFinal: async (cfg: Configuration) => {
    cfg.devServer = {
      ...cfg.devServer,
      allowedHosts: "all",
    };
    const alias = cfg.resolve?.alias;
    if (alias && !Array.isArray(alias)) {
      const map = alias as Record<string, unknown>;
      for (const key of NEXT_COMPILED_REACT_ALIAS_KEYS) {
        if (key in map) delete map[key];
      }
      pinAppReactAliases(map);
    }
    return cfg;
  },
};

export default config;
