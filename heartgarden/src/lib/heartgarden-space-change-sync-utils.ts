/**
 * Heartgarden GM space **delta sync** helpers used by {@link useHeartgardenSpaceChangeSync}.
 *
 * ## Sync contract (tombstones + cursoring)
 *
 * 1. **Full subtree id snapshot (`itemIds`)** — When applying remote tombstones, the merge layer
 *    needs the complete set of item ids still present on the server for the active subtree.
 *    Polls that request `includeItemIds: true` **must** receive a JSON array for `itemIds`
 *    (possibly empty). If `itemIds` is missing while required, treat the payload as invalid and
 *    run recovery (bootstrap repair), **do not** call `mergeRemoteItemPatches` with a partial id set.
 *
 * 2. **Cursor monotonicity** — The client advances `syncCursorRef` only forward in time (see
 *    {@link mergeLatestIsoCursor}). A regressive or malformed server `cursor` must not move the
 *    client backward (avoids re-fetching the same window and hiding remote deletes).
 *
 * 3. **Controlled recovery** — Repeated poll failures, HTTP errors, or invalid payloads trigger
 *    bootstrap repair and user-visible auxiliary sync state; never silently apply deltas without
 *    tombstone data when it was requested.
 */

import {
  mergeRemoteItemPatches,
  mergeRemoteSpaceRowsIntoGraph,
} from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasGraph } from "@/src/components/foundation/architectural-types";
import type { CanvasItem } from "@/src/model/canvas-types";
import { collectSpaceSubtreeIds } from "@/src/lib/spaces";

/**
 * Pure logic shared by {@link useHeartgardenSpaceChangeSync}: which item ids must keep
 * local title/body during delta merge (focus overlay dirty + inline card drafts).
 */
export function buildCollabMergeProtectedContentIds(options: {
  focusOpen: boolean;
  focusDirty: boolean;
  activeNodeId: string | null;
  inlineContentDirtyIds: ReadonlySet<string>;
  /** Item ids with a PATCH in flight — keep local text and skip poll `updatedAt` bumps until the save settles. */
  savingContentIds?: ReadonlySet<string>;
}): Set<string> {
  const out = new Set<string>();
  const { focusOpen, focusDirty, activeNodeId, inlineContentDirtyIds, savingContentIds } = options;
  if (focusOpen && focusDirty && activeNodeId) {
    out.add(activeNodeId);
  }
  inlineContentDirtyIds.forEach((id) => out.add(id));
  savingContentIds?.forEach((id) => out.add(id));
  return out;
}

/** Apply poll/bootstrap `updatedAt` only when newer than the client map (avoids regressing `baseUpdatedAt`). */
export function mergeItemServerUpdatedAtIfNewer(
  map: Map<string, string>,
  id: string,
  incoming: string,
): void {
  const cur = map.get(id);
  const prevMs = cur ? Date.parse(cur) : NaN;
  const nextMs = Date.parse(incoming);
  if (!Number.isFinite(nextMs)) return;
  if (!Number.isFinite(prevMs) || nextMs > prevMs) {
    map.set(id, incoming);
  }
}

/** Advance cursor only forward; ignore absent, invalid, or regressive server cursors. */
export function mergeLatestIsoCursor(currentIso: string, serverCursor: string | undefined): string {
  const prevMs = Date.parse(currentIso);
  const base = Number.isFinite(prevMs) ? prevMs : 0;
  if (typeof serverCursor !== "string" || serverCursor.length === 0) {
    return Number.isFinite(prevMs) ? currentIso : new Date(0).toISOString();
  }
  const nextMs = Date.parse(serverCursor);
  if (!Number.isFinite(nextMs)) return Number.isFinite(prevMs) ? currentIso : new Date(0).toISOString();
  if (nextMs < base) return currentIso;
  return serverCursor;
}

export type SpaceChangePayloadRow = {
  id: string;
  name: string;
  parentSpaceId: string | null;
  updatedAt?: string;
};

/** Parsed/validated shape for `GET /api/spaces/:id/changes` JSON (successful body). */
export type ParsedSpaceChangesResponse = {
  ok: true;
  items: CanvasItem[];
  spaces: SpaceChangePayloadRow[];
  itemIds?: string[];
  cursor?: string;
  /** Present on current API; when absent, clients should fall back to refreshing the graph each poll. */
  itemLinksRevision?: string;
  /** Server has additional pages; advance `since` to `cursor` and fetch again. */
  hasMore?: boolean;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/**
 * Validate JSON already known to be `ok: true` from HTTP layer. Returns `null` if the body
 * violates the merge contract (e.g. missing `itemIds` when required).
 */
export function parseSpaceChangesResponseJson(
  raw: unknown,
  options: { requireItemIds: boolean },
): ParsedSpaceChangesResponse | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.ok !== true) return null;
  if ("items" in o && o.items != null && !Array.isArray(o.items)) return null;
  if ("spaces" in o && o.spaces != null && !Array.isArray(o.spaces)) return null;
  if ("cursor" in o && o.cursor != null && typeof o.cursor !== "string") return null;
  if (
    "itemLinksRevision" in o &&
    o.itemLinksRevision != null &&
    typeof o.itemLinksRevision !== "string"
  ) {
    return null;
  }
  if ("hasMore" in o && o.hasMore != null && typeof o.hasMore !== "boolean") {
    return null;
  }

  if (options.requireItemIds) {
    if (!("itemIds" in o) || !isStringArray(o.itemIds)) return null;
  } else if ("itemIds" in o && o.itemIds != null && !isStringArray(o.itemIds)) {
    return null;
  }

  const items = (Array.isArray(o.items) ? o.items : []) as CanvasItem[];
  const spacesRaw = Array.isArray(o.spaces) ? o.spaces : [];
  const spaces: SpaceChangePayloadRow[] = [];
  for (const row of spacesRaw) {
    if (typeof row !== "object" || row === null) return null;
    const r = row as Record<string, unknown>;
    if (!isNonEmptyString(r.id) || typeof r.name !== "string") return null;
    const ps = r.parentSpaceId;
    if (ps !== null && typeof ps !== "string") return null;
    spaces.push({
      id: r.id,
      name: r.name,
      parentSpaceId: ps,
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : undefined,
    });
  }

  const itemIds = isStringArray(o.itemIds) ? o.itemIds : undefined;
  const cursor = typeof o.cursor === "string" ? o.cursor : undefined;
  const itemLinksRevision =
    typeof o.itemLinksRevision === "string" ? o.itemLinksRevision : undefined;
  const hasMore = o.hasMore === true ? true : undefined;

  return {
    ok: true,
    items,
    spaces,
    ...(itemIds !== undefined ? { itemIds } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
    ...(itemLinksRevision !== undefined ? { itemLinksRevision } : {}),
    ...(hasMore !== undefined ? { hasMore } : {}),
  };
}

/**
 * Deterministic graph merge for one delta poll (testable pure orchestration).
 * Computes subtree from `prev` and applies item patches + space row updates.
 */
export function applySpaceChangeGraphMerge(input: {
  prev: CanvasGraph;
  activeSpaceId: string;
  rawItems: CanvasItem[];
  rawSpaceRows: readonly SpaceChangePayloadRow[];
  serverItemIds: ReadonlySet<string>;
  protectedContentIds: ReadonlySet<string>;
  tombstoneExemptIds: ReadonlySet<string>;
}): CanvasGraph {
  const {
    prev,
    activeSpaceId,
    rawItems,
    rawSpaceRows,
    serverItemIds,
    protectedContentIds,
    tombstoneExemptIds,
  } = input;
  const spaceRows = Object.values(prev.spaces).map((s) => ({
    id: s.id,
    parentSpaceId: s.parentSpaceId ?? null,
  }));
  const subtree = collectSpaceSubtreeIds(activeSpaceId, spaceRows);
  const mergedItems = mergeRemoteItemPatches(
    prev,
    rawItems,
    serverItemIds,
    subtree,
    protectedContentIds,
    tombstoneExemptIds,
  );
  const rows = rawSpaceRows.map((s) => ({
    id: s.id,
    name: s.name,
    parentSpaceId: s.parentSpaceId ?? null,
  }));
  return mergeRemoteSpaceRowsIntoGraph(mergedItems, rows);
}

/** Server `updatedAt` bumps for items that are not text-protected (for conflict base). */
export function collectItemServerUpdatedAtBumps(
  rawItems: CanvasItem[],
  protectedContentIds: ReadonlySet<string>,
): Array<{ id: string; updatedAt: string }> {
  const out: Array<{ id: string; updatedAt: string }> = [];
  for (const it of rawItems) {
    if (!it.updatedAt || protectedContentIds.has(it.id)) continue;
    out.push({ id: it.id, updatedAt: it.updatedAt });
  }
  return out;
}
