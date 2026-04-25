import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessItemSpaceAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { refreshItemEmbedding } from "@/src/lib/item-vault-index";

/** Clears stale `item_embeddings` rows only; vector search is not used. */
export async function POST(
  _req: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) {
    return denied;
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 }
    );
  }
  const { itemId } = await context.params;
  const [row] = await db
    .select()
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);
  if (!row) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!(await gmMayAccessItemSpaceAsync(db, bootCtx, row.spaceId))) {
    return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  try {
    await refreshItemEmbedding(db, row);
  } catch {
    return Response.json(
      { ok: false, error: "Failed to clear embedding row" },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    note: "Stale embedding rows cleared. POST /api/items/:id/index re-chunks when an embedding provider is configured.",
  });
}
