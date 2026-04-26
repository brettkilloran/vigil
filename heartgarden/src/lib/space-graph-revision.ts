import { eq, sql } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { computeItemLinksRevisionForSpace } from "@/src/lib/item-links-space-revision";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

const SPACE_GRAPH_REVISION_CACHE_TTL_MS = 1_000;
const SPACE_GRAPH_REVISION_CACHE_MAX_ENTRIES = 1024;
const spaceGraphRevisionCache = new Map<string, { value: string; expiresAt: number }>();

function pruneSpaceGraphRevisionCacheIfOversized(now: number): void {
  if (spaceGraphRevisionCache.size <= SPACE_GRAPH_REVISION_CACHE_MAX_ENTRIES) return;
  for (const [key, entry] of spaceGraphRevisionCache) {
    if (entry.expiresAt <= now) spaceGraphRevisionCache.delete(key);
  }
  if (spaceGraphRevisionCache.size <= SPACE_GRAPH_REVISION_CACHE_MAX_ENTRIES) return;
  const firstKey = spaceGraphRevisionCache.keys().next().value;
  if (firstKey !== undefined) spaceGraphRevisionCache.delete(firstKey);
}

export function invalidateSpaceGraphRevisionForSpace(spaceId: string): void {
  spaceGraphRevisionCache.delete(spaceId);
}

async function computeItemsRevisionForSpace(db: VigilDb, spaceId: string): Promise<string> {
  const [row] = await db
    .select({
      c: sql<number>`count(*)::int`,
      maxU: sql<Date | null>`max(${items.updatedAt})`,
      maxId: sql<string | null>`max(${items.id}::text)`,
    })
    .from(items)
    .where(eq(items.spaceId, spaceId));
  const c = row?.c ?? 0;
  const maxU = row?.maxU instanceof Date ? row.maxU.getTime() : 0;
  const maxId = row?.maxId ?? "";
  return `${c}:${maxU}:${maxId}`;
}

/**
 * Fingerprint of graph topology/content for one space.
 * Includes both item rows and link/mention aggregate revision.
 */
export async function computeSpaceGraphRevisionForSpace(
  db: VigilDb,
  spaceId: string,
  itemLinksRevision?: string,
): Promise<string> {
  const now = Date.now();
  const canUseCachedValue = itemLinksRevision == null;
  const cached = canUseCachedValue ? spaceGraphRevisionCache.get(spaceId) : undefined;
  if (cached && cached.expiresAt > now) return cached.value;
  const [itemsRevision, linksRevision] = await Promise.all([
    computeItemsRevisionForSpace(db, spaceId),
    itemLinksRevision ? Promise.resolve(itemLinksRevision) : computeItemLinksRevisionForSpace(db, spaceId),
  ]);
  const value = `items:${itemsRevision}|links:${linksRevision}`;
  spaceGraphRevisionCache.set(spaceId, {
    value,
    expiresAt: now + SPACE_GRAPH_REVISION_CACHE_TTL_MS,
  });
  pruneSpaceGraphRevisionCacheIfOversized(now);
  return value;
}
