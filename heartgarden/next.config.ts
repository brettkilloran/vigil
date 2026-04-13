import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "1" });

const nextConfig: NextConfig = {
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
