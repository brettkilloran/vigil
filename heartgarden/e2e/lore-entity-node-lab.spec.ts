import { test, expect } from "@playwright/test";

import { prepDemoSession } from "./fixtures/bootstrap";

test.describe("/dev/lore-entity-nodes", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
  });

  test("shows location v2–v7 seeded previews", async ({ page }) => {
    await page.goto("/dev/lore-entity-nodes");
    await expect(page.getByRole("heading", { name: "Lore entity nodes", level: 1 })).toBeVisible({
      timeout: 60_000,
    });

    await expect(page.getByRole("heading", { name: "Location", level: 2 })).toBeVisible();

    await expect(page.getByText("V2 · Postcard band")).toBeVisible();
    await expect(page.getByText("V3 · Survey tag")).toBeVisible();
    await expect(page.getByText("V4 · Ordo · coordinate slab (mono)")).toBeVisible();
    await expect(page.getByText("V5 · Ordo · coordinate slab (mono, field-mapped)")).toBeVisible();
    await expect(page.getByText("V6 · Ordo · coordinate slab (mono, lean)")).toBeVisible();
    await expect(page.getByText("V7 · Ordo · coordinate slab (mono, hgDoc notes)")).toBeVisible();
    await expect(page.getByTestId("loc-survey-v3")).toBeVisible();
    await expect(page.getByTestId("loc-lab-ordo-coordinate-mono")).toBeVisible();
    await expect(page.getByTestId("loc-lab-ordo-coordinate-mono-v5")).toBeVisible();
    await expect(page.getByTestId("loc-lab-ordo-coordinate-mono-v6")).toBeVisible();
    const v7Slab = page.getByTestId("loc-lab-ordo-coordinate-mono-v7");
    await expect(v7Slab).toBeVisible();
    await expect(v7Slab.locator('[data-hg-lore-location-staple="v7"]')).toBeVisible();
  });

  test("shows faction lab plates through XII including shelf, sleeve, and protocol specimens", async ({ page }) => {
    await page.goto("/dev/lore-entity-nodes");
    await expect(page.getByRole("heading", { name: "Lore entity nodes", level: 1 })).toBeVisible({
      timeout: 60_000,
    });

    await expect(page.getByRole("heading", { name: /Faction · org · company/i })).toBeVisible();
    await expect(page.getByText("I · Dead-drop slip")).toBeVisible();
    await expect(page.getByText("II · Summit stub")).toBeVisible();
    await expect(page.getByText("III · Interoffice memo")).toBeVisible();
    await expect(page.getByText("IV · Shelf · rosy gradient")).toBeVisible();
    await expect(page.getByText("V · Shelf · sleeve perforation")).toBeVisible();
    await expect(page.getByText("VI · Protocol · ORDO LUNARIS · compact", { exact: true })).toBeVisible();
    await expect(page.getByText("VII · Protocol · ORDO LUNARIS")).toBeVisible();
    await expect(page.getByText("VIII · Classified · Silent Synod")).toBeVisible();
    await expect(page.getByText("IX · Archive · 091 internal")).toBeVisible();
    await expect(page.getByText("X · Protocol · Lattice induction")).toBeVisible();
    await expect(page.getByText("XI · Terminal · AEON Conclave")).toBeVisible();
    await expect(page.getByText("XII · Protocol · AEON classified")).toBeVisible();
    await expect(page.getByTestId("fac-sheet-docket")).toBeVisible();
    await expect(page.getByTestId("fac-sheet-buff")).toBeVisible();
    await expect(page.getByTestId("fac-lab-iomemo")).toBeVisible();
    await expect(page.getByTestId("fac-lab-shelfcard")).toBeVisible();
    await expect(page.getByTestId("fac-lab-shelfcard-sleeve")).toBeVisible();
    await expect(page.getByTestId("fac-lab-protocol-ordo-compact")).toBeVisible();
    await expect(page.getByTestId("fac-lab-protocol-ordo")).toBeVisible();
    await expect(page.getByTestId("fac-lab-protocol-synod")).toBeVisible();
    await expect(page.getByTestId("fac-lab-protocol-archive-091")).toBeVisible();
    await expect(page.getByTestId("fac-lab-protocol-lattice")).toBeVisible();
    await expect(page.getByTestId("fac-lab-protocol-aeon-conclave")).toBeVisible();
    await expect(page.getByTestId("fac-lab-protocol-aeon-protocol")).toBeVisible();
  });
});
