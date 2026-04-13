import { test, expect } from "@playwright/test";

import { prepDemoSession } from "../fixtures/bootstrap";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("visual: boot (mobile width)", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
  });

  test("boot layout: no horizontal overflow + screenshot", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: /Enter the garden/i })).toBeVisible({
      timeout: 30_000,
    });

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot("boot-mobile-390.png", {
      fullPage: true,
    });
  });
});
