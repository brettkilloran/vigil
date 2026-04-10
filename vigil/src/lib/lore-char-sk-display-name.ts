import { syncLoreV11PhCaretOffsetsInHost } from "@/src/lib/lore-v11-ph-caret";
import { LORE_V9_REDACTED_SENTINEL } from "@/src/lib/lore-v9-placeholder";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function logicalLineFromDisplayName(el: HTMLElement): string {
  return el.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

/** HTML for `.charSkDisplayName`: one logical line, escaped (no forced `<br>` between words). */
export function buildCharSkDisplayNameInnerHtml(logical: string): string {
  const s = logical;
  if (s === "") return "";
  if (s === LORE_V9_REDACTED_SENTINEL) return escapeHtml(s);
  return escapeHtml(s);
}

/**
 * Normalize `.charSkDisplayName` inner HTML from `textContent` (flattens legacy `<br>` layouts to one line).
 */
export function syncCharSkDisplayNameStack(host: HTMLElement | null): void {
  if (!host) return;
  const el = host.querySelector<HTMLElement>(
    '[class*="charSkDisplayName"][data-hg-lore-field]',
  );
  if (!el) return;
  const logical = logicalLineFromDisplayName(el);
  const next = buildCharSkDisplayNameInnerHtml(logical);
  if (el.innerHTML !== next) el.innerHTML = next;
  syncLoreV11PhCaretOffsetsInHost(host);
}
