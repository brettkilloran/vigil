import type { StorybookConfig } from "@storybook/nextjs";
import type { Configuration } from "webpack";

/**
 * heartgarden UI documentation. Repo directory is `vigil/`; stories live under `src/components/`.
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
    return cfg;
  },
};

export default config;
