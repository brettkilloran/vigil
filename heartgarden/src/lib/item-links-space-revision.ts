import { sql } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { entityMentions, itemLinks, items } from "@/src/db/schema";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

// REVIEW_2026-04-22-2 H5: short-TTL in-process cache for the per-space link
// revision. The underlying aggregate uses correlated EXISTS against `items` and
// runs on every `/changes` poll (per active client). Caching for a sub-poll-cycle
// window absorbs bursts of concurrent polls without meaningfully increasing
// staleness (polls are 2–5s; TTL is 1s). Writers can bust the entry via
// `invalidateItemLinksRevisionForSpace` so locally-triggered changes are visible
// on the next poll from the same process.
const ITEM_LINKS_REVISION_CACHE_TTL_MS = 1000;
const itemLinksRevisionCache = new Map<
  string,
  { value: string; expiresAt: number }
>();
const ITEM_LINKS_REVISION_CACHE_MAX_ENTRIES = 1024;

function pruneItemLinksRevisionCacheIfOversized(now: number): void {
  if (itemLinksRevisionCache.size <= ITEM_LINKS_REVISION_CACHE_MAX_ENTRIES) {
    return;
  }
  for (const [key, entry] of itemLinksRevisionCache) {
    if (entry.expiresAt <= now) {
      itemLinksRevisionCache.delete(key);
    }
  }
  if (itemLinksRevisionCache.size <= ITEM_LINKS_REVISION_CACHE_MAX_ENTRIES) {
    return;
  }
  const firstKey = itemLinksRevisionCache.keys().next().value;
  if (firstKey !== undefined) {
    itemLinksRevisionCache.delete(firstKey);
  }
}

export function invalidateItemLinksRevisionForSpace(spaceId: string): void {
  itemLinksRevisionCache.delete(spaceId);
}

async function computeItemLinksRevisionUncached(
  db: VigilDb,
  spaceId: string
): Promise<string> {
  const [row] = await db
    .select({
      c: sql<number>`sum(s.c)::int`,
      maxId: sql<string | null>`max(s.max_id)`,
      maxU: sql<Date | null>`max(s.max_u)`,
    })
    .from(
      sql`(
        SELECT
          count(*)::int AS c,
          max(${itemLinks.updatedAt}) AS max_u,
          max(${itemLinks.id}::text) AS max_id
        FROM ${itemLinks}
        WHERE (
          EXISTS (
            SELECT 1 FROM ${items}
            WHERE ${items.id} = ${itemLinks.sourceItemId} AND ${items.spaceId} = ${spaceId}
          )
          OR EXISTS (
            SELECT 1 FROM ${items}
            WHERE ${items.id} = ${itemLinks.targetItemId} AND ${items.spaceId} = ${spaceId}
          )
        )
        UNION ALL
        SELECT
          count(*)::int AS c,
          max(${entityMentions.updatedAt}) AS max_u,
          max(${entityMentions.id}::text) AS max_id
        FROM ${entityMentions}
        WHERE (
          ${entityMentions.sourceSpaceId} = ${spaceId}
          OR EXISTS (
            SELECT 1 FROM ${items}
            WHERE ${items.id} = ${entityMentions.targetItemId} AND ${items.spaceId} = ${spaceId}
          )
        )
      ) s`
    );

  const c = row?.c ?? 0;
  const maxU = row?.maxU instanceof Date ? row.maxU.getTime() : 0;
  const maxId = row?.maxId ?? "";
  return `${c}:${maxU}:${maxId}`;
}

/**
 * O(1)-ish fingerprint of `item_links` for one canvas `items.space_id` (matches `GET …/graph` scope).
 * Used to avoid full graph downloads on every delta poll when only item rows changed.
 *
 * Backed by a short-TTL process-local cache (see H5 note above). Writers should
 * call {@link invalidateItemLinksRevisionForSpace} after mutating `item_links`
 * rows that touch a given space so the very next poll sees the fresh value.
 */
export async function computeItemLinksRevisionForSpace(
  db: VigilDb,
  spaceId: string
): Promise<string> {
  const now = Date.now();
  const cached = itemLinksRevisionCache.get(spaceId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const value = await computeItemLinksRevisionUncached(db, spaceId);
  itemLinksRevisionCache.set(spaceId, {
    expiresAt: now + ITEM_LINKS_REVISION_CACHE_TTL_MS,
    value,
  });
  pruneItemLinksRevisionCacheIfOversized(now);
  return value;
}
