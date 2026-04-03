import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { refreshItemEmbedding } from "@/src/lib/item-embedding";

export async function POST(
  _req: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return Response.json({ ok: false, error: "OPENAI_API_KEY not set" }, { status: 503 });
  }
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const { itemId } = await context.params;
  const [row] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const text = `${row.title}\n${row.contentText}`.trim();
  if (!text) {
    return Response.json({ ok: false, error: "No text to embed" }, { status: 400 });
  }

  try {
    await refreshItemEmbedding(db, row);
  } catch {
    return Response.json({ ok: false, error: "Embedding failed" }, { status: 500 });
  }

  return Response.json({ ok: true, dimensions: 1536 });
}
