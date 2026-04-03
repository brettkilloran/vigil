import { extractVigilItemLinkTargets } from "@/src/lib/extract-vigil-item-links";
import type { CanvasItem } from "@/src/stores/canvas-types";

export type LocalLinkEndpoint = {
  id: string;
  title: string;
  itemType: string;
};

function itemByNormalizedId(
  items: Record<string, CanvasItem>,
  normalizedId: string,
): CanvasItem | undefined {
  for (const it of Object.values(items)) {
    if (it.id.toLowerCase() === normalizedId) return it;
  }
  return undefined;
}

/** Outgoing `vigil:item:` targets from one item's TipTap JSON that exist on the canvas. */
export function localOutgoingFromItem(
  item: CanvasItem,
  items: Record<string, CanvasItem>,
): LocalLinkEndpoint[] {
  const doc = item.contentJson;
  if (!doc) return [];
  const seen = new Set<string>();
  const out: LocalLinkEndpoint[] = [];
  for (const raw of extractVigilItemLinkTargets(doc)) {
    const t = itemByNormalizedId(items, raw);
    if (!t || t.id === item.id) continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push({ id: t.id, title: t.title, itemType: t.itemType });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

/** Items whose TipTap content links to `targetId` (local canvas only). */
export function localIncomingToItem(
  targetId: string,
  items: Record<string, CanvasItem>,
): LocalLinkEndpoint[] {
  const tLower = targetId.toLowerCase();
  const out: LocalLinkEndpoint[] = [];
  for (const it of Object.values(items)) {
    if (it.id.toLowerCase() === tLower) continue;
    const doc = it.contentJson;
    if (!doc) continue;
    const targets = extractVigilItemLinkTargets(doc);
    if (!targets.some((id) => id === tLower)) continue;
    out.push({ id: it.id, title: it.title, itemType: it.itemType });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}
