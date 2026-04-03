import type { CanvasItem } from "@/src/stores/canvas-types";

export type TitleMentionHit = { id: string; title: string; itemType: string };

const MIN_TITLE_LEN = 3;

/**
 * Other items on the canvas whose plain text or title contains the target's title
 * (case-insensitive). Heuristic stand-in for “who mentions this card?” without LLM/FTS.
 */
export function localItemsMentioningTitle(
  targetId: string,
  targetTitle: string,
  items: Record<string, CanvasItem>,
): TitleMentionHit[] {
  const needle = targetTitle.trim();
  if (needle.length < MIN_TITLE_LEN) return [];

  const lower = needle.toLowerCase();
  const out: TitleMentionHit[] = [];

  for (const it of Object.values(items)) {
    if (it.id === targetId) continue;
    const hay = `${it.contentText ?? ""}\n${it.title ?? ""}`.toLowerCase();
    if (!hay.includes(lower)) continue;
    out.push({
      id: it.id,
      title: it.title?.trim() || "(untitled)",
      itemType: it.itemType,
    });
  }

  out.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  return out;
}
