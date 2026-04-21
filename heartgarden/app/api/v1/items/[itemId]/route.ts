import { tryGetDb } from "@/src/db/index";
import {
  getHeartgardenApiBootContext,
  isHeartgardenPlayerBlocked,
} from "@/src/lib/heartgarden-api-boot-context";
import { loadItemRowForHeartgardenApi } from "@/src/lib/heartgarden-api-item-loaders";
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
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  const { itemId } = await context.params;
  const loaded = await loadItemRowForHeartgardenApi(db, bootCtx, itemId);
  if (loaded.kind === "absent") {
    if (bootCtx.role === "player") {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (loaded.kind === "deny") {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  return Response.json({
    version: 1,
    item: rowToCanvasItem(loaded.row),
  });
}
