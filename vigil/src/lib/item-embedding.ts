import { eq } from "drizzle-orm";
import OpenAI from "openai";

import type { tryGetDb } from "@/src/db/index";
import { itemEmbeddings, items } from "@/src/db/schema";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;
export type ItemRow = typeof items.$inferSelect;

/**
 * Recomputes the single embedding row for an item from title + contentText.
 * No-op when OPENAI_API_KEY is unset. Clears embeddings when there is no text.
 */
export async function refreshItemEmbedding(
  db: VigilDb,
  row: ItemRow,
): Promise<void> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return;

  const text = `${row.title}\n${row.contentText}`.trim();

  await db.delete(itemEmbeddings).where(eq(itemEmbeddings.itemId, row.id));

  if (!text) return;

  const openai = new OpenAI({ apiKey: key });
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  const vector = emb.data[0]?.embedding;
  if (!vector?.length) return;

  await db.insert(itemEmbeddings).values({
    itemId: row.id,
    embedding: vector,
    chunkText: text.slice(0, 2000),
  });
}

export function scheduleItemEmbeddingRefresh(
  db: VigilDb,
  row: ItemRow,
): void {
  void refreshItemEmbedding(db, row).catch(() => {
    /* avoid unhandled rejection; embedding is best-effort */
  });
}
