import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Dev binds to all interfaces (`localhost` + LAN). Next 16 blocks cross-origin HMR by default;
   * without this, opening `http://127.0.0.1:3000` while the dev server prefers `localhost` can
   * break the client (blank / no updates). Add your LAN hostname if you use the Network URL.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
