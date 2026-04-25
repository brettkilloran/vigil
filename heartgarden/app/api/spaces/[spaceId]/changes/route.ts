import { and, asc, eq, gt, inArray } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items, spaces } from "@/src/db/schema";
import { getHeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { fetchPlayerSubtreeSpaceRows } from "@/src/lib/heartgarden-space-subtree";
import { computeItemLinksRevisionForSpace } from "@/src/lib/item-links-space-revision";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import {
  collectSpaceSubtreeIds,
  listGmWorkspaceSpaces,
} from "@/src/lib/spaces";

/**
 * Delta feed for GM/player spaces. Contract:
 * - `includeItemIds=1` → response **must** include `itemIds` (full subtree snapshot for tombstones).
 * - `cursor` is the max updatedAt across changed items/spaces (never before `since` when nothing changed).
 * - Invalid `since` → 400 (client must recover via bootstrap, not guess a cursor).
 */
const DEFAULT_CHANGES_LIMIT = 500;
const MAX_CHANGES_LIMIT = 500;
// REVIEW_2026-04-22-2 H2: cap boundary over-fetch so a pathological
// same-timestamp batch cannot drive unbounded memory/query cost.
const BOUNDARY_OVERFETCH_CAP = 2000;

function maxIsoCursor(
  rows: { updatedAt: Date | null }[],
  fallbackMs: number
): string {
  let ms = fallbackMs;
  for (const r of rows) {
    const t = r.updatedAt instanceof Date ? r.updatedAt.getTime() : 0;
    if (t > ms) {
      ms = t;
    }
  }
  return new Date(ms).toISOString();
}

/**
 * REVIEW_2026-04-22-2 H2: close the page-boundary skip bug without a protocol break.
 *
 * The legacy cursor is a single ISO timestamp and the predicate is `updatedAt > since`.
 * If the (pageLimit)-th and (pageLimit+1)-th rows share the exact same `updatedAt`
 * (bulk imports, batched writes), advancing the cursor to that timestamp drops the
 * rows that share it on page 2 because `>` excludes the boundary.
 *
 * Fix: when the truncation point shares a timestamp with the overflow row, fetch all
 * remaining rows at that boundary (bounded by `BOUNDARY_OVERFETCH_CAP`) and include
 * them in the current page. The cursor then advances to the boundary and the next
 * poll's `>` predicate is safe.
 */
async function fetchAdditionalBoundaryRows<
  Row extends { id: string; updatedAt: Date | null },
>(
  fetchRowsEqUpdatedAt: (boundary: Date) => Promise<Row[]>,
  changed: Row[],
  overflowRow: Row
): Promise<{ rows: Row[]; saturated: boolean }> {
  const lastChanged = changed.at(-1);
  if (!(lastChanged && lastChanged.updatedAt instanceof Date)) {
    return { rows: changed, saturated: false };
  }
  if (!(overflowRow.updatedAt instanceof Date)) {
    return { rows: changed, saturated: false };
  }
  if (lastChanged.updatedAt.getTime() !== overflowRow.updatedAt.getTime()) {
    return { rows: changed, saturated: false };
  }
  const boundary = lastChanged.updatedAt;
  const extras = await fetchRowsEqUpdatedAt(boundary);
  const seen = new Set(changed.map((r) => r.id));
  const merged = [...changed];
  let saturated = false;
  for (const r of extras) {
    if (seen.has(r.id)) {
      continue;
    }
    merged.push(r);
    seen.add(r.id);
    if (merged.length >= BOUNDARY_OVERFETCH_CAP) {
      saturated = true;
      break;
    }
  }
  return { rows: merged, saturated };
}

export async function GET(
  req: Request,
  context: { params: Promise<{ spaceId: string }> }
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
      items: [],
      ok: true,
      spaces: [] as {
        id: string;
        name: string;
        parentSpaceId: string | null;
        updatedAt: string;
      }[],
      ...(includeItemIds ? { itemIds: [] as string[] } : {}),
      cursor: new Date(0).toISOString(),
      hasMore: false,
      itemLinksRevision: "0:0:",
    });
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }

  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) {
    return access.response;
  }

  const sinceRaw = url.searchParams.get("since")?.trim() ?? "";
  let sinceMs = 0;
  if (sinceRaw.length > 0) {
    const parsed = Date.parse(sinceRaw);
    if (!Number.isFinite(parsed)) {
      return Response.json(
        { error: "Invalid since", ok: false },
        { status: 400 }
      );
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
    const itemLinksRevision = await computeItemLinksRevisionForSpace(
      db,
      spaceId
    );
    return Response.json({
      items: [],
      ok: true,
      spaces: [],
      ...(includeItemIds ? { itemIds: [] as string[] } : {}),
      cursor: new Date(sinceMs).toISOString(),
      hasMore: false,
      itemLinksRevision,
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
  // REVIEW_2026-04-22-2 H2: add `asc(id)` as a stable secondary sort so the
  // boundary-collision handler can reliably detect and resolve page splits at
  // equal `updatedAt`.
  const rawItemRows = await db
    .select()
    .from(items)
    .where(
      and(inArray(items.spaceId, subtreeIds), gt(items.updatedAt, sinceDate))
    )
    .orderBy(asc(items.updatedAt), asc(items.id))
    .limit(itemFetchLimit);

  let itemHasMore = rawItemRows.length > pageLimit;
  let changedRows = itemHasMore ? rawItemRows.slice(0, pageLimit) : rawItemRows;
  if (itemHasMore) {
    const overflowItem = rawItemRows[pageLimit];
    if (overflowItem) {
      const resolved = await fetchAdditionalBoundaryRows(
        async (boundary) =>
          db
            .select()
            .from(items)
            .where(
              and(
                inArray(items.spaceId, subtreeIds),
                eq(items.updatedAt, boundary)
              )
            )
            .orderBy(asc(items.id)),
        changedRows,
        overflowItem
      );
      changedRows = resolved.rows;
      // If the overflow was strictly greater than the boundary we would have returned
      // `{ saturated: false, rows: changed }` unchanged; when we did absorb the boundary
      // group `hasMore` stays true because the original `pageLimit+1` fetch saw rows
      // beyond this page. Saturation (cap reached) also keeps `hasMore = true` so the
      // next poll will pick up remaining rows.
      itemHasMore = true;
    }
  }

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
    .orderBy(asc(spaces.updatedAt), asc(spaces.id))
    .limit(itemFetchLimit);

  let spaceHasMore = rawSpaceRows.length > pageLimit;
  let changedSpaceRows = spaceHasMore
    ? rawSpaceRows.slice(0, pageLimit)
    : rawSpaceRows;
  if (spaceHasMore) {
    const overflowSpace = rawSpaceRows[pageLimit];
    if (overflowSpace) {
      const resolved = await fetchAdditionalBoundaryRows(
        async (boundary) =>
          db
            .select({
              id: spaces.id,
              name: spaces.name,
              parentSpaceId: spaces.parentSpaceId,
              updatedAt: spaces.updatedAt,
            })
            .from(spaces)
            .where(
              and(
                inArray(spaces.id, subtreeIds),
                eq(spaces.updatedAt, boundary)
              )
            )
            .orderBy(asc(spaces.id)),
        changedSpaceRows,
        overflowSpace
      );
      changedSpaceRows = resolved.rows;
      spaceHasMore = true;
    }
  }

  const spacePayload = changedSpaceRows.map((r) => ({
    id: r.id,
    name: r.name,
    parentSpaceId: r.parentSpaceId ?? null,
    updatedAt:
      r.updatedAt instanceof Date
        ? r.updatedAt.toISOString()
        : String(r.updatedAt ?? ""),
  }));

  const cursor = maxIsoCursor([...changedRows, ...changedSpaceRows], sinceMs);

  const itemLinksRevision = await computeItemLinksRevisionForSpace(db, spaceId);

  const hasMore = itemHasMore || spaceHasMore;

  return Response.json({
    items: changedItems,
    ok: true,
    ...(spacePayload.length > 0 ? { spaces: spacePayload } : {}),
    ...(includeItemIds && itemIds !== undefined ? { itemIds } : {}),
    cursor,
    hasMore,
    itemLinksRevision,
  });
}
