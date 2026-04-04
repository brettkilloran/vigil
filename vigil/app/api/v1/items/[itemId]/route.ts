import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { rowToCanvasItem } from "@/src/lib/item-mapper";

/**
 * Versioned read-only single item for scripts / LLM (no auth in single-user mode).
 * v1 keeps legacy `{ error: string }` failures, while `/api/*` routes use `{ ok: false, error }`.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }
  const { itemId } = await context.params;
  const [row] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({
    version: 1,
    item: rowToCanvasItem(row),
  });
}
