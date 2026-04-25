import type { Page } from "@playwright/test";

import { WORKSPACE_VIEW_CACHE_STORAGE_KEY } from "../../src/lib/workspace-view-cache";

const ENTER_THE_GARDEN_BUTTON_RE = /Enter the garden/i;

/** Stable theme + no workspace cache; demo payload comes from `GET /api/bootstrap` when `PLAYWRIGHT_E2E=1` on the server. */
export async function prepDemoSession(page: Page) {
  await page.addInitScript((workspaceCacheKey: string) => {
    localStorage.setItem("vigil-color-scheme", "light");
    localStorage.removeItem("vigil-canvas-local-v1");
    localStorage.removeItem(workspaceCacheKey);
  }, WORKSPACE_VIEW_CACHE_STORAGE_KEY);
}

/** Default route shows the boot gate until the user enters; dock and workspace overlay sit behind it. */
export async function dismissHeartgardenBootIfPresent(page: Page) {
  const enter = page.getByRole("button", { name: ENTER_THE_GARDEN_BUTTON_RE });
  try {
    await enter.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    return;
  }
  await enter.click();
}
