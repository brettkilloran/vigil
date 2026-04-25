import { expect, test } from "@playwright/test";

import { prepDemoSession } from "../fixtures/bootstrap";

test.use({ viewport: { height: 844, width: 390 } });

test.describe("visual: boot (mobile width)", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
  });

  test("boot layout: no horizontal overflow + screenshot", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: /Enter the garden/i })
    ).toBeVisible({
      timeout: 30_000,
    });

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot("boot-mobile-390.png", {
      fullPage: true,
    });
  });
});
