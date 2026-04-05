import type { StorybookConfig } from "@storybook/nextjs";
import type { Configuration } from "webpack";

/**
 * `@storybook/nextjs` aliases `react` / `react-dom` to `next/dist/compiled/*`. That copy can drift from
 * the app’s `node_modules` React (e.g. React 19) and trigger reconciliation bugs in the iframe such as
 * `removeChild`: "The node to be removed is not a child of this node." Strip those aliases so Storybook
 * uses the same React as the app. See https://github.com/storybookjs/storybook/issues/30646
 */
const NEXT_COMPILED_REACT_ALIAS_KEYS = [
  "react",
  "react-dom/test-utils",
  "react-dom$",
  "react-dom/client",
  "react-dom/server",
] as const;

/**
 * heartgarden UI documentation. App directory in git is `vigil/` (see `docs/NAMING.md`); stories are colocated under `src/components/**` and use explicit `meta.title` paths (`Heartgarden/Overview`, `Design System/*`, `Architectural Shell/*`) — not filesystem folders — for the sidebar.
 * Invariants (Windows / dev-server): keep `webpackFinal` + `allowedHosts: "all"`; see `AGENTS.md`
 * § "Local dev, Node, and Storybook (guardrails)".
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
  /** Windows / LAN: avoid blank UI when the shell loads but webpack-dev-server rejects the Host header or WS URL. */
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
    }
    return cfg;
  },
};

export default config;
