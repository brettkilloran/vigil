import { expect, test } from "@playwright/test";

import { prepDemoSession } from "./fixtures/bootstrap";

test.describe("text editing hardening", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
    await page.goto("/");
    await expect(page.getByText("波途画電")).toBeVisible({ timeout: 30_000 });
  });

  test("keeps caret anchored in node body while typing", async ({ page }) => {
    const bodyEditor = page.locator('[data-node-body-editor="true"]').first();
    await expect(bodyEditor).toBeVisible();
    await bodyEditor.click();

    await page.keyboard.type(" hardening-check");

    const caretState = await bodyEditor.evaluate((el) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      return {
        containsSelection: el.contains(selection.anchorNode),
        isFocused: document.activeElement === el,
      };
    });

    expect(caretState).toEqual({
      containsSelection: true,
      isFocused: true,
    });
    await expect(bodyEditor).toContainText("hardening-check");
  });

  test("keeps folder title editor focused during inline rename", async ({ page }) => {
    await page.getByRole("button", { name: "Folder" }).click();

    const titleEditors = page.locator('[data-folder-title-editor="true"]');
    const editor = titleEditors.last();
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type(" Regression Guard");

    const isFocused = await editor.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);
    await expect(editor).toContainText("Regression Guard");
  });

  test("focus mode body preserves typing session", async ({ page }) => {
    const expandButton = page.locator('[data-expand-btn="true"]').first();
    await expect(expandButton).toBeVisible();
    await expandButton.click();

    const focusBody = page.locator('[data-focus-body-editor="true"]');
    await expect(focusBody).toBeVisible();
    await focusBody.click();
    await page.keyboard.type(" focus-stability");

    const caretState = await focusBody.evaluate((el) => {
      const selection = window.getSelection();
      return {
        isFocused: document.activeElement === el,
        containsSelection: !!selection?.anchorNode && el.contains(selection.anchorNode),
      };
    });

    expect(caretState).toEqual({
      isFocused: true,
      containsSelection: true,
    });
    await expect(focusBody).toContainText("focus-stability");
  });
});
