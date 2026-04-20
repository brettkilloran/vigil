import { eq, sql } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { itemLinks, items } from "@/src/db/schema";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

/**
 * O(1)-ish fingerprint of `item_links` for one canvas `items.space_id` (matches `GET …/graph` scope).
 * Used to avoid full graph downloads on every delta poll when only item rows changed.
 */
export async function computeItemLinksRevisionForSpace(db: VigilDb, spaceId: string): Promise<string> {
  const [row] = await db
    .select({
      c: sql<number>`count(*)::int`,
      maxU: sql<Date | null>`max(${itemLinks.updatedAt})`,
      maxId: sql<string | null>`max(${itemLinks.id}::text)`,
    })
    .from(itemLinks)
    .innerJoin(items, eq(items.id, itemLinks.sourceItemId))
    .where(eq(items.spaceId, spaceId));

  const c = row?.c ?? 0;
  const maxU = row?.maxU instanceof Date ? row.maxU.getTime() : 0;
  const maxId = row?.maxId ?? "";
  return `${c}:${maxU}:${maxId}`;
}
