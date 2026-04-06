import { and, asc, gt, inArray } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessSpaceId,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForVisitor,
  isHeartgardenVisitorBlocked,
  visitorMayAccessSpaceId,
} from "@/src/lib/heartgarden-api-boot-context";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import {
  assertSpaceExists,
  collectSpaceSubtreeIds,
  listGmWorkspaceSpaces,
} from "@/src/lib/spaces";

function maxIsoCursor(rows: { updatedAt: Date | null }[], fallbackMs: number): string {
  let ms = fallbackMs;
  for (const r of rows) {
    const t = r.updatedAt instanceof Date ? r.updatedAt.getTime() : 0;
    if (t > ms) ms = t;
  }
  return new Date(ms).toISOString();
}

export async function GET(
  req: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  if (process.env.PLAYWRIGHT_E2E === "1") {
    return Response.json({
      ok: true,
      items: [],
      itemIds: [],
      cursor: new Date(0).toISOString(),
    });
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenVisitorBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const { spaceId } = await context.params;
  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return heartgardenMaskNotFoundForVisitor(
      bootCtx,
      Response.json({ ok: false, error: "Space not found" }, { status: 404 }),
    );
  }
  if (!visitorMayAccessSpaceId(bootCtx, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (bootCtx.role === "gm" && !gmMayAccessSpaceId(bootCtx, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const url = new URL(req.url);
  const sinceRaw = url.searchParams.get("since")?.trim() ?? "";
  let sinceMs = 0;
  if (sinceRaw.length > 0) {
    const parsed = Date.parse(sinceRaw);
    if (!Number.isFinite(parsed)) {
      return Response.json({ ok: false, error: "Invalid since" }, { status: 400 });
    }
    sinceMs = parsed;
  }
  const sinceDate = new Date(sinceMs);

  let spaceRows: { id: string; parentSpaceId: string | null }[];

  if (bootCtx.role === "visitor") {
    spaceRows = [{ id: space.id, parentSpaceId: space.parentSpaceId ?? null }];
  } else {
    const allSpaces = await listGmWorkspaceSpaces(db);
    spaceRows = allSpaces.map((s) => ({
      id: s.id,
      parentSpaceId: s.parentSpaceId ?? null,
    }));
  }

  const subtreeIds = collectSpaceSubtreeIds(spaceId, spaceRows);
  if (subtreeIds.length === 0) {
    return Response.json({
      ok: true,
      items: [],
      itemIds: [],
      cursor: new Date(sinceMs).toISOString(),
    });
  }

  const idRows = await db
    .select({ id: items.id })
    .from(items)
    .where(inArray(items.spaceId, subtreeIds));
  const itemIds = idRows.map((r) => r.id);

  const changedRows = await db
    .select()
    .from(items)
    .where(and(inArray(items.spaceId, subtreeIds), gt(items.updatedAt, sinceDate)))
    .orderBy(asc(items.updatedAt));

  const changedItems = changedRows.map(rowToCanvasItem);
  const cursor = maxIsoCursor(changedRows, sinceMs);

  return Response.json({
    ok: true,
    items: changedItems,
    itemIds,
    cursor,
  });
}
