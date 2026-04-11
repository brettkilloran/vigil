import { test, expect } from "@playwright/test";

import { prepDemoSession } from "./fixtures/bootstrap";

test.describe("/dev/lore-entity-nodes", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
  });

  test("shows three high-concept location lab bodies (not seeded card IA)", async ({ page }) => {
    await page.goto("/dev/lore-entity-nodes");
    await expect(page.getByRole("heading", { name: "Lore entity nodes", level: 1 })).toBeVisible({
      timeout: 60_000,
    });

    await expect(page.getByRole("heading", { name: "Location · high-concept lab", level: 3 })).toBeVisible();

    await expect(page.getByTestId("loc-lab-concept-survey")).toBeVisible();
    await expect(page.getByTestId("loc-lab-concept-departures")).toBeVisible();
    await expect(page.getByTestId("loc-lab-concept-polaroid")).toBeVisible();

    await expect(page.getByText("LAB · Survey datum sheet")).toBeVisible();
    await expect(page.getByText("LAB · Night departures board")).toBeVisible();
    await expect(page.getByText("LAB · Polaroid caption stub")).toBeVisible();

    await expect(page.getByText("OBQ-CRY-B")).toBeVisible();
    await expect(page.getByText("Salt spine express")).toBeVisible();
    await expect(page.getByText("HG-LOC-LAB")).toBeVisible();
  });
});
