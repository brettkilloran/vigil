import { test, expect } from "@playwright/test";

import { prepDemoSession } from "./fixtures/bootstrap";
import { openCommandPalette } from "./fixtures/shortcuts";

test.describe("VIGIL smoke", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
  });

  test("loads canvas shell and primary chrome", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("[data-vigil-canvas]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("[data-vigil-toolbar]")).toBeVisible();

    await expect(page.getByRole("button", { name: "Note" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sticky" })).toBeVisible();

    await expect(page.getByText("Local only")).toBeVisible();
    await expect(
      page.getByText("Start a note, drop in visuals", { exact: false }),
    ).toBeVisible();
  });

  test("command palette opens from keyboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-vigil-canvas]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Local only")).toBeVisible({ timeout: 15_000 });
    await page.locator("[data-vigil-canvas]").click({
      position: { x: 640, y: 400 },
    });

    await openCommandPalette(page);
    await expect(page.locator("[data-vigil-palette]")).toBeVisible();
    await expect(
      page.locator("[data-vigil-palette] input").first(),
    ).toBeFocused();
  });
});
