import { test, expect } from "@playwright/test";

import { prepDemoSession } from "./fixtures/bootstrap";

test.describe("VIGIL smoke", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
  });

  test("loads canvas shell and primary chrome", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("ARCH_ENV")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Note" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Task" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Folder" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pan Hand" })).toBeVisible();
  });

  test("creates a new note from dock", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("ARCH_ENV")).toBeVisible({ timeout: 30_000 });

    const nodes = page.locator("[data-node-id]");
    const beforeCount = await nodes.count();

    await page.getByRole("button", { name: "Note" }).click();

    await expect(nodes).toHaveCount(beforeCount + 1);
  });
});
