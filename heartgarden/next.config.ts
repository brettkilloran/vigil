import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type WebpackRule = {
  loader?: string;
  use?: Array<{ loader?: string } | string> | { loader?: string } | string;
  oneOf?: WebpackRule[];
  rules?: WebpackRule[];
};

type WebpackPluginLike = {
  constructor?: {
    name?: string;
  };
};

function ruleUsesMiniCssExtractLoader(rule: WebpackRule): boolean {
  if (typeof rule.loader === "string" && rule.loader.includes("mini-css-extract-plugin")) {
    return true;
  }
  if (Array.isArray(rule.use)) {
    for (const entry of rule.use) {
      if (typeof entry === "string" && entry.includes("mini-css-extract-plugin")) {
        return true;
      }
      if (
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.loader === "string" &&
        entry.loader.includes("mini-css-extract-plugin")
      ) {
        return true;
      }
    }
  } else if (typeof rule.use === "string" && rule.use.includes("mini-css-extract-plugin")) {
    return true;
  } else if (
    typeof rule.use === "object" &&
    rule.use !== null &&
    typeof rule.use.loader === "string" &&
    rule.use.loader.includes("mini-css-extract-plugin")
  ) {
    return true;
  }
  const nested = [...(rule.oneOf ?? []), ...(rule.rules ?? [])];
  return nested.some(ruleUsesMiniCssExtractLoader);
}

function configUsesMiniCssExtractLoader(rules: unknown): boolean {
  if (!Array.isArray(rules)) {
    return false;
  }
  return (rules as WebpackRule[]).some(ruleUsesMiniCssExtractLoader);
}

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "1" });

const nextConfig: NextConfig = {
  /**
   * PDF stack for `/api/lore/import/parse`: keep these **external** so the bundler does not
   * re-wrap the pre-bundled `pdfjs-dist` ESM (same `Object.defineProperty called on non-object`
   * class of bug as client webpack + prebuilt `pdf.mjs` — see webpack#20095). `pdf-parse` is not
   * listed; it pulls `pdfjs-dist` transitively, but the route imports `pdfjs-dist` directly.
   */
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  /**
   * Expose Vercel’s commit SHA to the client bundle so boot / about strings can show a unique
   * deploy id alongside semver from `package.json` (see `src/lib/app-version.ts`).
   */
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "",
  },
  /**
   * Dev binds to all interfaces (`localhost` + LAN). Next 16 blocks cross-origin HMR by default;
   * without this, opening `http://127.0.0.1:3000` while the dev server prefers `localhost` can
   * break the client (blank / no updates). Add your LAN hostname if you use the Network URL.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  /**
   * Next 16 defaults `next build` to Turbopack. Keep an explicit empty Turbopack
   * config so the fallback webpack hook below remains valid without tripping
   * Next's mixed-config guardrail.
   */
  turbopack: {},
  webpack(config) {
    const hasMiniCssLoader = configUsesMiniCssExtractLoader(config.module?.rules);
    const hasMiniCssPlugin =
      Array.isArray(config.plugins) &&
      (config.plugins as WebpackPluginLike[]).some(
        (plugin) => plugin?.constructor?.name === "MiniCssExtractPlugin",
      );

    // Guard against third-party webpack config wrappers that leave the mini-css loader active
    // but accidentally remove the corresponding plugin instance.
    if (hasMiniCssLoader && !hasMiniCssPlugin) {
      const MiniCssExtractPlugin = require("next/dist/compiled/mini-css-extract-plugin");
      config.plugins ??= [];
      config.plugins.push(new MiniCssExtractPlugin({ ignoreOrder: true }));
    }

    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
