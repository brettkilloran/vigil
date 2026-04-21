import { and, asc, gt, inArray } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items, spaces } from "@/src/db/schema";
import { getHeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import { fetchPlayerSubtreeSpaceRows } from "@/src/lib/heartgarden-space-subtree";
import { computeItemLinksRevisionForSpace } from "@/src/lib/item-links-space-revision";
import { collectSpaceSubtreeIds, listGmWorkspaceSpaces } from "@/src/lib/spaces";

/**
 * Delta feed for GM/player spaces. Contract:
 * - `includeItemIds=1` → response **must** include `itemIds` (full subtree snapshot for tombstones).
 * - `cursor` is the max updatedAt across changed items/spaces (never before `since` when nothing changed).
 * - Invalid `since` → 400 (client must recover via bootstrap, not guess a cursor).
 */
const DEFAULT_CHANGES_LIMIT = 500;
const MAX_CHANGES_LIMIT = 500;

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
  const limitParam = url.searchParams.get("limit");
  let pageLimit = DEFAULT_CHANGES_LIMIT;
  if (limitParam != null && limitParam.trim() !== "") {
    const n = Number(limitParam);
    if (Number.isFinite(n)) {
      pageLimit = Math.min(MAX_CHANGES_LIMIT, Math.max(1, Math.floor(n)));
    }
  }

  if (process.env.PLAYWRIGHT_E2E === "1") {
    return Response.json({
      ok: true,
      items: [],
      spaces: [] as { id: string; name: string; parentSpaceId: string | null; updatedAt: string }[],
      ...(includeItemIds ? { itemIds: [] as string[] } : {}),
      cursor: new Date(0).toISOString(),
      itemLinksRevision: "0:0:",
      hasMore: false,
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
    spaceRows = await fetchPlayerSubtreeSpaceRows(db, bootCtx.playerSpaceId);
  } else {
    const allSpaces = await listGmWorkspaceSpaces(db);
    spaceRows = allSpaces.map((s) => ({
      id: s.id,
      parentSpaceId: s.parentSpaceId ?? null,
    }));
  }

  const subtreeIds = collectSpaceSubtreeIds(spaceId, spaceRows);
  if (subtreeIds.length === 0) {
    const itemLinksRevision = await computeItemLinksRevisionForSpace(db, spaceId);
    return Response.json({
      ok: true,
      items: [],
      spaces: [],
      ...(includeItemIds ? { itemIds: [] as string[] } : {}),
      cursor: new Date(sinceMs).toISOString(),
      itemLinksRevision,
      hasMore: false,
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

  const itemFetchLimit = pageLimit + 1;
  const rawItemRows = await db
    .select()
    .from(items)
    .where(and(inArray(items.spaceId, subtreeIds), gt(items.updatedAt, sinceDate)))
    .orderBy(asc(items.updatedAt))
    .limit(itemFetchLimit);

  const itemHasMore = rawItemRows.length > pageLimit;
  const changedRows = itemHasMore ? rawItemRows.slice(0, pageLimit) : rawItemRows;

  const changedItems = changedRows.map(rowToCanvasItem);

  const rawSpaceRows = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      parentSpaceId: spaces.parentSpaceId,
      updatedAt: spaces.updatedAt,
    })
    .from(spaces)
    .where(and(inArray(spaces.id, subtreeIds), gt(spaces.updatedAt, sinceDate)))
    .orderBy(asc(spaces.updatedAt))
    .limit(itemFetchLimit);

  const spaceHasMore = rawSpaceRows.length > pageLimit;
  const changedSpaceRows = spaceHasMore ? rawSpaceRows.slice(0, pageLimit) : rawSpaceRows;

  const spacePayload = changedSpaceRows.map((r) => ({
    id: r.id,
    name: r.name,
    parentSpaceId: r.parentSpaceId ?? null,
    updatedAt:
      r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt ?? ""),
  }));

  const cursor = maxIsoCursor([...changedRows, ...changedSpaceRows], sinceMs);

  const itemLinksRevision = await computeItemLinksRevisionForSpace(db, spaceId);

  const hasMore = itemHasMore || spaceHasMore;

  return Response.json({
    ok: true,
    items: changedItems,
    ...(spacePayload.length > 0 ? { spaces: spacePayload } : {}),
    ...(includeItemIds && itemIds !== undefined ? { itemIds } : {}),
    cursor,
    itemLinksRevision,
    hasMore,
  });
}
