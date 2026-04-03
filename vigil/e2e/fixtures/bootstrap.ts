import type { Page } from "@playwright/test";

/** Stable theme + empty local canvas; demo payload comes from `GET /api/bootstrap` when `PLAYWRIGHT_E2E=1` on the server. */
export async function prepDemoSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("vigil-color-scheme", "light");
    localStorage.removeItem("vigil-canvas-local-v1");
  });
}
