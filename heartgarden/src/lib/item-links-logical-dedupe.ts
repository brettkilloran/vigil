/**
 * Collapse duplicate `item_links` rows that share the same undirected pair + link_type
 * (e.g. null pins vs canvas pins) to one edge for graph hydration / inspector.
 */

export interface ItemLinkLogicalEdge {
  color: string | null;
  id: string;
  linkType: string | null;
  meta: unknown;
  source: string;
  sourcePin: string | null;
  target: string;
  targetPin: string | null;
  updatedAtMs: number;
}

function undirectedKey(
  source: string,
  target: string,
  linkType: string | null
): string {
  const a = source < target ? source : target;
  const b = source < target ? target : source;
  return `${a}\0${b}\0${linkType ?? ""}`;
}

function pinScore(sourcePin: string | null, targetPin: string | null): number {
  return (sourcePin ? 1 : 0) + (targetPin ? 1 : 0);
}

/** Prefer more pin detail, then newest `updatedAt`, then lexicographically larger id (stable tie-break). */
export function dedupeLogicalItemLinkRows(
  rows: ItemLinkLogicalEdge[]
): ItemLinkLogicalEdge[] {
  const best = new Map<string, ItemLinkLogicalEdge>();
  for (const row of rows) {
    const k = undirectedKey(row.source, row.target, row.linkType);
    const prev = best.get(k);
    if (!prev) {
      best.set(k, row);
      continue;
    }
    const sNew = pinScore(row.sourcePin, row.targetPin);
    const sOld = pinScore(prev.sourcePin, prev.targetPin);
    if (sNew > sOld) {
      best.set(k, row);
      continue;
    }
    if (sNew < sOld) {
      continue;
    }
    if (row.updatedAtMs > prev.updatedAtMs) {
      best.set(k, row);
      continue;
    }
    if (row.updatedAtMs < prev.updatedAtMs) {
      continue;
    }
    if (row.id > prev.id) {
      best.set(k, row);
    }
  }
  return [...best.values()];
}
