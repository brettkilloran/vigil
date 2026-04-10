/** Default v9 inline field copy — classified / unfilled affordance. */
export const LORE_V9_REDACTED_SENTINEL = "REDACTED";

/** Default header line (catalog-style id); keeps muted styling like REDACTED until edited. */
export const LORE_V9_HEADER_META_PLACEHOLDER = "CLGN-ID";

/**
 * Toggle `data-hg-lore-placeholder` on `[data-hg-lore-field]` nodes under `host`
 * when text is empty or still the sentinel.
 */
export function syncLoreV9RedactedPlaceholderState(host: HTMLElement | null): void {
  if (!host) return;
  const shell = host.querySelector<HTMLElement>('[class*="charSkShell"]');
  if (!shell) return;
  const sentinel = LORE_V9_REDACTED_SENTINEL;
  const headerPh = LORE_V9_HEADER_META_PLACEHOLDER;
  for (const el of shell.querySelectorAll<HTMLElement>("[data-hg-lore-field]")) {
    const raw = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const isHeaderMeta = el.matches?.('[class*="charSkHeaderMeta"]') === true;
    const isPlaceholder =
      raw === "" ||
      raw === sentinel ||
      (isHeaderMeta && raw === headerPh);
    if (isPlaceholder) {
      el.setAttribute("data-hg-lore-placeholder", "true");
    } else {
      el.removeAttribute("data-hg-lore-placeholder");
    }
  }
}
