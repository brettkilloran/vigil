import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { refreshItemEmbedding } from "@/src/lib/item-embedding";

/** Clears stale `item_embeddings` rows only; vector search is not used. */
export async function POST(
  _req: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const { itemId } = await context.params;
  const [row] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  try {
    await refreshItemEmbedding(db, row);
  } catch {
    return Response.json({ ok: false, error: "Failed to clear embedding row" }, { status: 500 });
  }

  return Response.json({
    ok: true,
    note: "Item embeddings are not generated; search uses Postgres full-text and trigram.",
  });
}
