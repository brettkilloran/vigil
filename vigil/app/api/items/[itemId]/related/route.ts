import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessItemSpace,
  gmMayAccessSpaceId,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForPlayer,
  isHeartgardenPlayerBlocked,
  playerMayAccessItemSpaceAsync,
  playerMayAccessSpaceIdAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { searchItemsFTS } from "@/src/lib/spaces";

export async function GET(
  req: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured", items: [] }, { status: 503 });
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { itemId } = await context.params;
  const [row] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ ok: false, error: "Not found" }, { status: 404 }),
    );
  }
  if (!(await playerMayAccessItemSpaceAsync(db, bootCtx, row.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (bootCtx.role === "gm" && !gmMayAccessItemSpace(bootCtx, row.spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const url = new URL(req.url);
  const spaceParam = url.searchParams.get("spaceId");
  let spaceId = spaceParam && spaceParam.length > 0 ? spaceParam : row.spaceId;
  if (bootCtx.role === "player") {
    if (spaceParam && !(await playerMayAccessSpaceIdAsync(db, bootCtx, spaceParam))) {
      return heartgardenApiForbiddenJsonResponse();
    }
    spaceId = row.spaceId;
  }
  if (bootCtx.role === "gm" && !gmMayAccessSpaceId(bootCtx, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const limit = Math.min(
    20,
    Math.max(1, Number(url.searchParams.get("limit") ?? "8") || 8),
  );

  const title = row.title?.trim() ?? "";
  const blob = row.searchBlob?.trim() ?? "";
  const q = (title.length >= 3 ? title : blob).slice(0, 200).trim();
  if (q.length < 3) {
    return Response.json({ ok: true, items: [], note: "Query text too short for FTS." });
  }

  const rows = await searchItemsFTS(db, q, { spaceId, limit: limit + 2 });
  const out = rows
    .filter((r) => r.item.id !== itemId)
    .slice(0, limit)
    .map((r) => ({
      id: r.item.id,
      title: r.item.title?.trim() || "Untitled",
      itemType: r.item.itemType,
      snippet: r.snippet ?? null,
    }));

  return Response.json({ ok: true, items: out });
}
