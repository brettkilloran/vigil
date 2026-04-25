import { expect, test } from "@playwright/test";

import {
  dismissHeartgardenBootIfPresent,
  prepDemoSession,
} from "../fixtures/bootstrap";

test.describe("visual: shell (light, empty demo)", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
  });

  test("empty canvas + toolbar alignment", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("[data-vigil-canvas]")).toBeVisible({
      timeout: 30_000,
    });
    await dismissHeartgardenBootIfPresent(page);
    /* PLAYWRIGHT_E2E bootstrap is demo/empty; with boot gate off the shell falls back to local demo canvas. */
    await expect(page.getByText("Local only · not connected")).toBeVisible();

    // Let layout, fonts, and theme settle before capturing.
    await expect(page.locator("html[data-vigil-theme='light']")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot("shell-empty-light.png", {
      fullPage: true,
    });
  });
});
