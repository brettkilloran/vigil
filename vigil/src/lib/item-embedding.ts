import { eq } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { itemEmbeddings, items } from "@/src/db/schema";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;
export type ItemRow = typeof items.$inferSelect;

/**
 * Clears any stored vector row for this item. Embeddings are not maintained (search is FTS + trigram).
 */
export async function refreshItemEmbedding(db: VigilDb, row: ItemRow): Promise<void> {
  await db.delete(itemEmbeddings).where(eq(itemEmbeddings.itemId, row.id));
}

/** Fire-and-forget: clears legacy `item_embeddings` rows after item writes (not semantic search maintenance). */
export function scheduleItemEmbeddingRefresh(db: VigilDb, row: ItemRow): void {
  void refreshItemEmbedding(db, row).catch(() => {
    /* best-effort cleanup */
  });
}
