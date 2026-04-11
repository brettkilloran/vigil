import { test, expect, type Page } from "@playwright/test";

import { dismissHeartgardenBootIfPresent, prepDemoSession } from "./fixtures/bootstrap";

async function gotoCanvasAfterBoot(page: Page) {
  await page.goto("/");
  await expect(page.locator("[data-vigil-canvas]")).toBeVisible({ timeout: 30_000 });
  await dismissHeartgardenBootIfPresent(page);
  await expect(page.getByRole("button", { name: /Save and database/ })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("heartgarden smoke", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
  });

  test("loads canvas shell and primary chrome", async ({ page }) => {
    await gotoCanvasAfterBoot(page);
    await expect(page.getByRole("button", { name: "Note" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Task" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Folder" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pan Hand" })).toBeVisible();
  });

  test("creates a new note from dock", async ({ page }) => {
    await gotoCanvasAfterBoot(page);

    const nodes = page.locator("[data-node-id]");
    const beforeCount = await nodes.count();

    await page.getByRole("button", { name: "Note" }).click();

    await expect(nodes).toHaveCount(beforeCount + 1);
  });

  test("keeps code-card tape variant and dark treatment in app shell", async ({ page }) => {
    await gotoCanvasAfterBoot(page);

    const nodes = page.locator("[data-node-id]");
    const before = await nodes.count();
    await page.getByRole("button", { name: "Code" }).click();
    await expect(nodes).toHaveCount(before + 1);

    const codeCard = nodes.nth(before);
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
