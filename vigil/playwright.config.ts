import { defineConfig, devices } from "@playwright/test";

/**
 * E2E + visual regression for VIGIL.
 *
 * - `npm run test:e2e` — builds once, then headless Chromium against `next start` on **:3001**
 *   (avoids Next’s single `next dev` lock per repo while you keep `npm run dev` on :3000).
 * - `npm run test:e2e:update` — refresh screenshot baselines after intentional UI changes.
 * - CI: set `CI=1`; use the official Playwright Docker image or `npx playwright install --with-deps chromium`
 *   so fonts and headless shell match your baseline platform (Linux vs Windows snapshots differ).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    /** Dedicated port so `npm run dev` on :3000 can run alongside e2e. */
    baseURL: "http://127.0.0.1:3001",
    /** PWA `sw.js` can intercept `/api/*` in production builds. */
    serviceWorkers: "block",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 720 },
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    },
  },
  webServer: {
    command: "npm run build && npx next start --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ...process.env,
      PLAYWRIGHT_E2E: "1",
    },
  },
  projects: [{ name: "chromium" }],
});
