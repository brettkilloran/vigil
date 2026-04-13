import { expect, test, type Page } from "@playwright/test";

import { dismissHeartgardenBootIfPresent, prepDemoSession } from "./fixtures/bootstrap";

/**
 * Adds a default note and returns that card (not `[data-node-id].first()`, which may be a seeded
 * node off-screen when open-gate bootstrap loads the local demo graph).
 */
async function createFirstNoteAndGetBodyEditor(page: Page) {
  const nodes = page.locator("[data-node-id]");
  const before = await nodes.count();
  await page.getByRole("button", { name: "Note" }).click();
  await expect(nodes).toHaveCount(before + 1, { timeout: 15_000 });
  const node = nodes.nth(before);
  await expect(node).toBeVisible({ timeout: 15_000 });
  const bodyEditor = node.locator('[data-node-body-editor="true"]');
  await expect(bodyEditor).toBeVisible({ timeout: 15_000 });
  return { node, bodyEditor };
}

function insertBlocksButton(page: Page, name: string) {
  return page.getByRole("toolbar", { name: "Insert blocks" }).getByRole("button", { name });
}

function textFormattingButton(page: Page, name: string) {
  return page.getByRole("toolbar", { name: "Text formatting" }).getByRole("button", { name });
}

test.describe("text editing hardening", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
    await page.goto("/");
    await expect(page.locator("[data-vigil-canvas]")).toBeVisible({ timeout: 30_000 });
    await dismissHeartgardenBootIfPresent(page);
    await expect(page.getByRole("button", { name: /Save and database/ })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("keeps caret anchored in node body while typing", async ({ page }) => {
    const { bodyEditor } = await createFirstNoteAndGetBodyEditor(page);
    await bodyEditor.click();

    await page.keyboard.type(" hardening-check");

    const caretState = await bodyEditor.evaluate((el) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      const ae = document.activeElement as Node | null;
      return {
        containsSelection: el.contains(selection.anchorNode),
        isFocused: ae != null && (el === ae || el.contains(ae)),
      };
    });

    expect(caretState).toEqual({
      containsSelection: true,
      isFocused: true,
    });
    await expect(bodyEditor).toContainText("hardening-check");
  });

  test("node body keeps typed text after blur (commit path)", async ({ page }) => {
    const { bodyEditor } = await createFirstNoteAndGetBodyEditor(page);
    await bodyEditor.click();
    await page.keyboard.type(" blur-commit-guard");
    await bodyEditor.blur();
    await expect(bodyEditor).toContainText("blur-commit-guard");
  });

  test("checklist Enter semantics create new task rows", async ({ page }) => {
    const { bodyEditor } = await createFirstNoteAndGetBodyEditor(page);
    await bodyEditor.click();
    await page.keyboard.type("line one");
    await insertBlocksButton(page, "Checklist").click();

    const firstTaskText = bodyEditor.locator(
      'li[data-hg-task-item="true"] p, li[data-type="taskItem"] p',
    );
    await expect(firstTaskText.first()).toContainText("line one");
    await firstTaskText.first().click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("line two");

    const taskItems = bodyEditor.locator('li[data-hg-task-item="true"], li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(2, { timeout: 10_000 });
    await expect(bodyEditor.locator('[data-arch-task-text="true"]')).toHaveCount(0);
  });

  test("checklist empty-row Enter exits to paragraph", async ({ page }) => {
    const { bodyEditor } = await createFirstNoteAndGetBodyEditor(page);
    await bodyEditor.click();
    await page.keyboard.type("alpha");
    await insertBlocksButton(page, "Checklist").click();
    const firstTaskText = bodyEditor.locator(
      'li[data-hg-task-item="true"] p, li[data-type="taskItem"] p',
    );
    await firstTaskText.first().click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("after-enter-exit");

    const taskItems = bodyEditor.locator('li[data-hg-task-item="true"], li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(1);
    const outsideParagraphText = await bodyEditor.evaluate((el) => {
      const paragraphs = Array.from(el.querySelectorAll("p"));
      const outside = paragraphs.filter((p) => !p.closest('li[data-hg-task-item="true"], li[data-type="taskItem"]'));
      return outside.map((p) => (p.textContent ?? "").trim()).filter(Boolean);
    });
    expect(outsideParagraphText).toContain("after-enter-exit");
  });

  test("checklist empty-row Backspace exits to paragraph", async ({ page }) => {
    const { bodyEditor } = await createFirstNoteAndGetBodyEditor(page);
    await bodyEditor.click();
    await page.keyboard.type("alpha");
    await insertBlocksButton(page, "Checklist").click();
    const firstTaskText = bodyEditor.locator(
      'li[data-hg-task-item="true"] p, li[data-type="taskItem"] p',
    );
    await firstTaskText.first().click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("after-backspace-exit");

    const taskItems = bodyEditor.locator('li[data-hg-task-item="true"], li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(1);
    const outsideParagraphText = await bodyEditor.evaluate((el) => {
      const paragraphs = Array.from(el.querySelectorAll("p"));
      const outside = paragraphs.filter((p) => !p.closest('li[data-hg-task-item="true"], li[data-type="taskItem"]'));
      return outside.map((p) => (p.textContent ?? "").trim()).filter(Boolean);
    });
    expect(outsideParagraphText).toContain("after-backspace-exit");
  });

  test("quote toolbar toggles blockquote in canvas body", async ({ page }) => {
    const { bodyEditor } = await createFirstNoteAndGetBodyEditor(page);
    await bodyEditor.click();
    await page.keyboard.type("quoted line");
    await insertBlocksButton(page, "Quote").click();
    await expect(bodyEditor.locator("blockquote")).toHaveCount(1);
    await expect(bodyEditor.locator("blockquote")).toContainText("quoted line");
    await insertBlocksButton(page, "Quote").click();
    await expect(bodyEditor.locator("blockquote")).toHaveCount(0);
    await expect(bodyEditor.locator("p").first()).toContainText("quoted line");
  });

  test("quote toolbar toggles blockquote in focus body", async ({ page }) => {
    const { node } = await createFirstNoteAndGetBodyEditor(page);
    await node.locator('[data-expand-btn="true"]').click();
    const focusBody = page.locator('[data-focus-body-editor="true"]');
    await expect(focusBody).toBeVisible();
    await focusBody.click();
    await page.keyboard.type("focus quote");
    await insertBlocksButton(page, "Quote").click();
    await expect(focusBody.locator("blockquote")).toHaveCount(1);
    await expect(focusBody.locator("blockquote")).toContainText("focus quote");
    await insertBlocksButton(page, "Quote").click();
    await expect(focusBody.locator("blockquote")).toHaveCount(0);
    await expect(focusBody.locator("p").first()).toContainText("focus quote");
  });

  test("heading picker applies H2 then body paragraph", async ({ page }) => {
    const { bodyEditor } = await createFirstNoteAndGetBodyEditor(page);
    await bodyEditor.click();
    await page.keyboard.type("heading target");
    await textFormattingButton(page, "Heading").click();
    await page.getByRole("button", { name: "H2" }).click();
    await expect(bodyEditor.locator("h2")).toContainText("heading target");
    await textFormattingButton(page, "Heading").click();
    await page.getByRole("button", { name: "Body" }).click();
    await expect(bodyEditor.locator("h2")).toHaveCount(0);
    await expect(bodyEditor.locator("p").first()).toContainText("heading target");
  });

  test("bulleted and numbered list toggles are reversible", async ({ page }) => {
    const { bodyEditor } = await createFirstNoteAndGetBodyEditor(page);
    await bodyEditor.click();
    await page.keyboard.type("list target");

    await textFormattingButton(page, "Bulleted list").click();
    await expect(bodyEditor.locator("ul li")).toHaveCount(1);
    await textFormattingButton(page, "Bulleted list").click();
    await expect(bodyEditor.locator("ul li")).toHaveCount(0);
    await expect(bodyEditor.locator("p").first()).toContainText("list target");

    await textFormattingButton(page, "Numbered list").click();
    await expect(bodyEditor.locator("ol li")).toHaveCount(1);
    await textFormattingButton(page, "Numbered list").click();
    await expect(bodyEditor.locator("ol li")).toHaveCount(0);
    await expect(bodyEditor.locator("p").first()).toContainText("list target");
  });

  test("keeps folder title editor focused during inline rename", async ({ page }) => {
    const folders = page.locator("[data-folder-id]");
    const beforeFolders = await folders.count();
    await page.getByRole("button", { name: "Folder" }).click();
    await expect(folders).toHaveCount(beforeFolders + 1, { timeout: 15_000 });
    const folderNode = folders.nth(beforeFolders);
    await expect(folderNode).toBeVisible({ timeout: 15_000 });

    const titleEditors = folderNode.locator('[data-folder-title-editor="true"]');
    const editor = titleEditors.first();
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type(" Regression Guard");

    const isFocused = await editor.evaluate((el) => {
      const ae = document.activeElement as Node | null;
      return ae != null && (el === ae || el.contains(ae));
    });
    expect(isFocused).toBe(true);
    await expect(editor).toContainText("Regression Guard");
  });

  test("focus mode body preserves typing session", async ({ page }) => {
    const { node } = await createFirstNoteAndGetBodyEditor(page);
    const expandButton = node.locator('[data-expand-btn="true"]');
    await expect(expandButton).toBeVisible();
    await expandButton.click();

    const focusBody = page.locator('[data-focus-body-editor="true"]');
    await expect(focusBody).toBeVisible();
    await focusBody.click();
    await page.keyboard.type(" focus-stability");

    const caretState = await focusBody.evaluate((el) => {
      const selection = window.getSelection();
      const ae = document.activeElement as Node | null;
      return {
        isFocused: ae != null && (el === ae || el.contains(ae)),
        containsSelection: !!selection?.anchorNode && el.contains(selection.anchorNode),
      };
    });

    expect(caretState).toEqual({
      isFocused: true,
      containsSelection: true,
    });
    await expect(focusBody).toContainText("focus-stability");
  });

  test("hgDoc focus body mounts TipTap chrome with ProseMirror root", async ({ page }) => {
    const { node } = await createFirstNoteAndGetBodyEditor(page);
    await node.locator('[data-expand-btn="true"]').click();
    const focusHost = page.locator('[data-focus-body-editor="true"][data-hg-doc-editor="true"]');
    await expect(focusHost).toBeVisible({ timeout: 15_000 });
    await expect(focusHost.locator(".ProseMirror")).toBeVisible({ timeout: 15_000 });
  });
});
