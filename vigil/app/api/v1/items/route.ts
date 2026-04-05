import { tryGetDb } from "@/src/db/index";
import {
  getHeartgardenApiBootContext,
  isHeartgardenVisitorBlocked,
  visitorMayAccessSpaceId,
} from "@/src/lib/heartgarden-api-boot-context";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import { assertSpaceExists, listItemsForSpace } from "@/src/lib/spaces";

/**
 * Versioned read-only list for scripts / LLM (no auth in single-user mode).
 * v1 keeps legacy `{ error: string }` failures, while `/api/*` routes use `{ ok: false, error }`.
 */
export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenVisitorBlocked(bootCtx)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  const url = new URL(req.url);
  const spaceId = url.searchParams.get("space_id");
  if (!spaceId) {
    return Response.json({ error: "space_id required" }, { status: 400 });
  }
  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    if (bootCtx.role === "visitor") {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }
    return Response.json({ error: "Space not found" }, { status: 404 });
  }
  if (!visitorMayAccessSpaceId(bootCtx, spaceId)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  const rows = await listItemsForSpace(db, spaceId);
  return Response.json({
    version: 1,
    space_id: spaceId,
    items: rows.map(rowToCanvasItem),
  });
}
