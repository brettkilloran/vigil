import type { Page } from "@playwright/test";

/** Stable theme + empty local canvas; demo payload comes from `GET /api/bootstrap` when `PLAYWRIGHT_E2E=1` on the server. */
export async function prepDemoSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("vigil-color-scheme", "light");
    localStorage.removeItem("vigil-canvas-local-v1");
  });
}

/** Default route shows the boot gate until the user enters; dock and workspace overlay sit behind it. */
export async function dismissHeartgardenBootIfPresent(page: Page) {
  const enter = page.getByRole("button", { name: /Enter the garden/i });
  try {
    await enter.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    return;
  }
  await enter.click();
}
