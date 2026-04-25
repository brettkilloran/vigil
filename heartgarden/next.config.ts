import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

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
   * pnpm's symlinked node_modules can cause serverExternalPackages to miss
   * platform-specific native binaries (e.g. @napi-rs/canvas-linux-x64-gnu).
   * Explicitly externalize any .node binary and the whole @napi-rs scope.
   */
  webpack: (config, { isServer }) => {
    if (isServer && Array.isArray(config.externals)) {
      config.externals.push(/@napi-rs/);
    }
    return config;
  },
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
};

export default withBundleAnalyzer(nextConfig);
