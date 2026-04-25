/**
 * When true, the boot PIN gate is off: middleware does not require `hg_boot`, and API routes
 * treat the session as GM (`readBootEnv` / `readBootGateEnvEdge` return `gateEnabled: false`).
 *
 * - `PLAYWRIGHT_E2E=1` — used by Playwright (`next start` on another port).
 * - **`next dev`** (`NODE_ENV === "development"`): gate is **off by default** so local work (e.g. Cursor,
 *   http://localhost:3000) does not require copying PINs into `.env.local`. Set
 *   **`HEARTGARDEN_DEV_ENFORCE_BOOT_GATE=1`** to test the PIN flow locally when boot env is configured.
 * - Production / `next start` with `NODE_ENV === "production"` is unchanged.
 */

function truthyEnv(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isHeartgardenBootGateBypassed(): boolean {
  if (process.env.PLAYWRIGHT_E2E === "1") {
    return true;
  }
  if (process.env.NODE_ENV !== "development") {
    return false;
  }
  if (truthyEnv(process.env.HEARTGARDEN_DEV_ENFORCE_BOOT_GATE)) {
    return false;
  }
  return true;
}
