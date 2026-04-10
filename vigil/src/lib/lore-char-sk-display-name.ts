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

/** HTML for one contenteditable display name: line 1 = first word, line 2 = remainder. */
export function buildCharSkDisplayNameInnerHtml(logical: string): string {
  const s = logical;
  if (s === "") return "";
  if (s === LORE_V9_REDACTED_SENTINEL) return escapeHtml(s);
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return escapeHtml(words[0] ?? "");
  return `${escapeHtml(words[0]!)}<br>${escapeHtml(words.slice(1).join(" "))}`;
}

/**
 * Normalize v9 `.charSkDisplayName` markup so the first word sits on its own line
 * and the rest wrap below — still one field, one value in plain text / exports.
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
}
