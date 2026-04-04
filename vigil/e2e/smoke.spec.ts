import { test, expect } from "@playwright/test";

import { prepDemoSession } from "./fixtures/bootstrap";

test.describe("heartgarden smoke", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
  });

  test("loads canvas shell and primary chrome", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("波途画電")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Note" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Task" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Folder" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pan Hand" })).toBeVisible();
  });

  test("creates a new note from dock", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("波途画電")).toBeVisible({ timeout: 30_000 });

    const nodes = page.locator("[data-node-id]");
    const beforeCount = await nodes.count();

    await page.getByRole("button", { name: "Note" }).click();

    await expect(nodes).toHaveCount(beforeCount + 1);
  });

  test("keeps code-card tape variant and dark treatment in app shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("波途画電")).toBeVisible({ timeout: 30_000 });

    const codeCard = page
      .locator("[data-node-id]")
      .filter({ has: page.getByText("DAT // sing_1r_boot.ts") })
      .first();
    await expect(codeCard).toBeVisible();

    const tape = codeCard.locator('[data-node-tape="true"]');
    await expect(tape).toHaveAttribute("data-tape-variant", "dark");

    const styleSnapshot = await tape.evaluate((el) => {
      const styles = getComputedStyle(el);
      return {
        backgroundImage: styles.backgroundImage,
        boxShadow: styles.boxShadow,
      };
    });

    expect(styleSnapshot.backgroundImage).toContain("linear-gradient");
    expect(styleSnapshot.boxShadow).toContain("inset");
  });
});
