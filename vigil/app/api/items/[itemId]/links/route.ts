import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { getItemLinksResolved } from "@/src/lib/spaces";

export async function GET(
  _req: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured", outgoing: [], incoming: [] },
      { status: 503 },
    );
  }
  const { itemId } = await context.params;
  const [row] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const { outgoing, incoming } = await getItemLinksResolved(db, itemId);
  return Response.json({ ok: true, outgoing, incoming });
}
