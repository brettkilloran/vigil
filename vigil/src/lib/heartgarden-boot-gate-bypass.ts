/**
 * When true, the boot PIN gate is off: middleware does not require `hg_boot`, and API routes
 * treat the session as GM (`readBootEnv` / `readBootGateEnvEdge` return `gateEnabled: false`).
 *
 * - `PLAYWRIGHT_E2E=1` — used by Playwright (`next start` on another port).
 * - `HEARTGARDEN_DEV_BOOT_NO_GATE=1` — **local `next dev` only** (`NODE_ENV === "development"`).
 *   Ignored in production builds and on Vercel, so it cannot weaken deployed environments.
 */

function truthyEnv(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isHeartgardenBootGateBypassed(): boolean {
  if (process.env.PLAYWRIGHT_E2E === "1") return true;
  if (process.env.NODE_ENV !== "development") return false;
  return truthyEnv(process.env.HEARTGARDEN_DEV_BOOT_NO_GATE);
}
