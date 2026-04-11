import { test, expect } from "@playwright/test";

import { prepDemoSession } from "./fixtures/bootstrap";

test.describe("/dev/lore-entity-nodes", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
  });

  test("shows three lab-only location skin previews (not seeded)", async ({ page }) => {
    await page.goto("/dev/lore-entity-nodes");
    await expect(page.getByRole("heading", { name: "Lore entity nodes", level: 1 })).toBeVisible({
      timeout: 60_000,
    });

    await expect(page.getByRole("heading", { name: "Location lab skins", level: 3 })).toBeVisible();

    await expect(page.getByTestId("loc-lab-skin-blueprint")).toBeVisible();
    await expect(page.getByTestId("loc-lab-skin-waypoint")).toBeVisible();
    await expect(page.getByTestId("loc-lab-skin-deed")).toBeVisible();

    await expect(page.getByText("LAB · Blueprint site sheet")).toBeVisible();
    await expect(page.getByText("LAB · Waypoint board")).toBeVisible();
    await expect(page.getByText("LAB · Deed cadastral slip")).toBeVisible();
  });

  test("shows concept-next row with polaroid / poster / specimen (image slots)", async ({ page }) => {
    await page.goto("/dev/lore-entity-nodes");
    await expect(page.getByRole("heading", { name: "Lore entity nodes", level: 1 })).toBeVisible({
      timeout: 60_000,
    });

    await expect(page.getByRole("heading", { name: "Location · concept next", level: 3 })).toBeVisible();

    await expect(page.getByTestId("loc-concept-polaroid")).toBeVisible();
    await expect(page.getByTestId("loc-concept-poster")).toBeVisible();
    await expect(page.getByTestId("loc-concept-specimen")).toBeVisible();

    await expect(page.getByText("NEXT · Polaroid field slip")).toBeVisible();
    await expect(page.getByText("NEXT · Night-line poster")).toBeVisible();
    await expect(page.getByText("NEXT · Museum specimen tag")).toBeVisible();
  });
});
