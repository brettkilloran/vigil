import { test, expect } from "@playwright/test";

import { dismissHeartgardenBootIfPresent, prepDemoSession } from "../fixtures/bootstrap";

test.describe("visual: shell (light, empty demo)", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
  });

  test("empty canvas + toolbar alignment", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("[data-vigil-canvas]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Local only")).toBeVisible();
    await dismissHeartgardenBootIfPresent(page);
    await expect(page.getByText("Workspace unavailable")).toBeVisible();

    // Let layout, fonts, and theme settle before capturing.
    await expect(page.locator("html[data-vigil-theme='light']")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot("shell-empty-light.png", {
      fullPage: true,
    });
  });
});
