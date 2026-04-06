import { and, asc, gt, inArray } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { getHeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import { collectSpaceSubtreeIds, listGmWorkspaceSpaces } from "@/src/lib/spaces";

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
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) return access.response;
  const space = access.space;

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
