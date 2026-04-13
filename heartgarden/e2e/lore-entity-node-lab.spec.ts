import { test, expect } from "@playwright/test";

import { prepDemoSession } from "./fixtures/bootstrap";

test.describe("/dev/lore-entity-nodes", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
  });

  test("shows location v2 and v3 seeded previews", async ({ page }) => {
    await page.goto("/dev/lore-entity-nodes");
    await expect(page.getByRole("heading", { name: "Lore entity nodes", level: 1 })).toBeVisible({
      timeout: 60_000,
    });

    await expect(page.getByRole("heading", { name: "Location", level: 2 })).toBeVisible();

    await expect(page.getByText("V2 · Postcard band")).toBeVisible();
    await expect(page.getByText("V3 · Survey tag")).toBeVisible();
    await expect(page.getByTestId("loc-survey-v3")).toBeVisible();
  });

  test("shows faction lab plates I–IX", async ({ page }) => {
    await page.goto("/dev/lore-entity-nodes");
    await expect(page.getByRole("heading", { name: "Lore entity nodes", level: 1 })).toBeVisible({
      timeout: 60_000,
    });

    await expect(page.getByRole("heading", { name: /Faction · org · company/i })).toBeVisible();
    await expect(page.getByText("I · Dead-drop slip")).toBeVisible();
    await expect(page.getByText("II · Rating plate")).toBeVisible();
    await expect(page.getByText("III · Summit stub")).toBeVisible();
    await expect(page.getByText("IV · Carbon copy")).toBeVisible();
    await expect(page.getByText("V · Interoffice memo")).toBeVisible();
    await expect(page.getByText("VI · Shelf card")).toBeVisible();
    await expect(page.getByText("VII · Luggage tag")).toBeVisible();
    await expect(page.getByText("VIII · Manila tab")).toBeVisible();
    await expect(page.getByText("IX · Queue chit")).toBeVisible();
    await expect(page.getByTestId("fac-sheet-docket")).toBeVisible();
    await expect(page.getByTestId("fac-sheet-ember")).toBeVisible();
    await expect(page.getByTestId("fac-sheet-buff")).toBeVisible();
    await expect(page.getByTestId("fac-lab-carboncopy")).toBeVisible();
    await expect(page.getByTestId("fac-lab-iomemo")).toBeVisible();
    await expect(page.getByTestId("fac-lab-shelfcard")).toBeVisible();
    await expect(page.getByTestId("fac-lab-luggagetag")).toBeVisible();
    await expect(page.getByTestId("fac-lab-manilatab")).toBeVisible();
    await expect(page.getByTestId("fac-lab-queuechit")).toBeVisible();
  });
});
