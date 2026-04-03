import type { Page } from "@playwright/test";

/** Matches in-app search shortcut (`useModKeyHints` / canvas handlers). */
export async function openCommandPalette(page: Page) {
  const useMeta = await page.evaluate(
    () =>
      /Mac|iPhone|iPad/i.test(navigator.platform) ||
      /Mac OS X|Macintosh/i.test(navigator.userAgent),
  );
  if (useMeta) {
    await page.keyboard.press("Meta+KeyK");
  } else {
    await page.keyboard.press("Control+KeyK");
  }
}
