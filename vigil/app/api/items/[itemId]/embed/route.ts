import { eq } from "drizzle-orm";
import OpenAI from "openai";

import { tryGetDb } from "@/src/db/index";
import { itemEmbeddings, items } from "@/src/db/schema";

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

  const openai = new OpenAI({ apiKey: key });
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  const vector = emb.data[0]?.embedding;
  if (!vector) {
    return Response.json({ ok: false, error: "Embedding failed" }, { status: 500 });
  }

  await db.delete(itemEmbeddings).where(eq(itemEmbeddings.itemId, itemId));
  await db.insert(itemEmbeddings).values({
    itemId,
    embedding: vector,
    chunkText: text.slice(0, 2000),
  });

  return Response.json({ ok: true, dimensions: vector.length });
}
