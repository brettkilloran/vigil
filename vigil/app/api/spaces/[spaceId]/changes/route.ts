import { and, asc, gt, inArray } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items, spaces } from "@/src/db/schema";
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
  const url = new URL(req.url);
  const includeItemIds = url.searchParams.get("includeItemIds") === "1";

  if (process.env.PLAYWRIGHT_E2E === "1") {
    return Response.json({
      ok: true,
      items: [],
      spaces: [] as { id: string; name: string; parentSpaceId: string | null; updatedAt: string }[],
      ...(includeItemIds ? { itemIds: [] as string[] } : {}),
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

  if (bootCtx.role === "player") {
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
      spaces: [],
      ...(includeItemIds ? { itemIds: [] as string[] } : {}),
      cursor: new Date(sinceMs).toISOString(),
    });
  }

  let itemIds: string[] | undefined;
  if (includeItemIds) {
    const idRows = await db
      .select({ id: items.id })
      .from(items)
      .where(inArray(items.spaceId, subtreeIds));
    itemIds = idRows.map((r) => r.id);
  }

  const changedRows = await db
    .select()
    .from(items)
    .where(and(inArray(items.spaceId, subtreeIds), gt(items.updatedAt, sinceDate)))
    .orderBy(asc(items.updatedAt));

  const changedItems = changedRows.map(rowToCanvasItem);

  const changedSpaceRows = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      parentSpaceId: spaces.parentSpaceId,
      updatedAt: spaces.updatedAt,
    })
    .from(spaces)
    .where(and(inArray(spaces.id, subtreeIds), gt(spaces.updatedAt, sinceDate)))
    .orderBy(asc(spaces.updatedAt));

  const spacePayload = changedSpaceRows.map((r) => ({
    id: r.id,
    name: r.name,
    parentSpaceId: r.parentSpaceId ?? null,
    updatedAt:
      r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt ?? ""),
  }));

  const cursor = maxIsoCursor([...changedRows, ...changedSpaceRows], sinceMs);

  return Response.json({
    ok: true,
    items: changedItems,
    ...(spacePayload.length > 0 ? { spaces: spacePayload } : {}),
    ...(includeItemIds && itemIds !== undefined ? { itemIds } : {}),
    cursor,
  });
}
