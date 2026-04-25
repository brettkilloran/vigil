import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessItemSpaceAsync,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForPlayer,
  isHeartgardenPlayerBlocked,
  playerMayAccessItemSpaceAsync,
  playerMayAccessSpaceIdAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { searchItemsFTS } from "@/src/lib/spaces";

export async function GET(
  req: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", items: [], ok: false },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { itemId } = await context.params;
  const [row] = await db
    .select()
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);
  if (!row) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ error: "Not found", ok: false }, { status: 404 })
    );
  }
  if (!(await playerMayAccessItemSpaceAsync(db, bootCtx, row.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (!(await gmMayAccessItemSpaceAsync(db, bootCtx, row.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const url = new URL(req.url);
  const spaceParam = url.searchParams.get("spaceId");
  let spaceId = spaceParam && spaceParam.length > 0 ? spaceParam : row.spaceId;
  if (bootCtx.role === "player") {
    if (
      spaceParam &&
      !(await playerMayAccessSpaceIdAsync(db, bootCtx, spaceParam))
    ) {
      return heartgardenApiForbiddenJsonResponse();
    }
    spaceId = row.spaceId;
  }
  if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const limit = Math.min(
    20,
    Math.max(1, Number(url.searchParams.get("limit") ?? "8") || 8)
  );

  const title = row.title?.trim() ?? "";
  const blob = row.searchBlob?.trim() ?? "";
  const q = (title.length >= 3 ? title : blob).slice(0, 200).trim();
  if (q.length < 3) {
    return Response.json({
      items: [],
      note: "Query text too short for FTS.",
      ok: true,
    });
  }

  const rows = await searchItemsFTS(db, q, { limit: limit + 2, spaceId });
  const out = rows
    .filter((r) => r.item.id !== itemId)
    .slice(0, limit)
    .map((r) => ({
      id: r.item.id,
      itemType: r.item.itemType,
      snippet: r.snippet ?? null,
      title: r.item.title?.trim() || "Untitled",
    }));

  return Response.json({ items: out, ok: true });
}
