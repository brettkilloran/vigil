import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { itemLinks, items, spaces } from "@/src/db/schema";
import { isHeartgardenGmPlayerSpaceBreakGlassEnabled } from "@/src/lib/heartgarden-gm-break-glass";
import { parseSpaceIdParam } from "@/src/lib/space-id";
import type { CameraState } from "@/src/model/canvas-types";
import { defaultCamera } from "@/src/model/canvas-types";

export type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

function playerSpaceIdExcludedFromGmDb(): string | undefined {
  return parseSpaceIdParam((process.env.HEARTGARDEN_PLAYER_SPACE_ID ?? "").trim() || null);
}

export function parseCameraFromRow(raw: unknown): CameraState {
  if (!raw || typeof raw !== "object") return defaultCamera();
  const o = raw as Record<string, unknown>;
  if (
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.zoom === "number" &&
    Number.isFinite(o.x) &&
    Number.isFinite(o.y) &&
    Number.isFinite(o.zoom) &&
    o.zoom > 0
  ) {
    return { x: o.x, y: o.y, zoom: o.zoom };
  }
  return defaultCamera();
}

export async function listAllSpaces(db: VigilDb) {
  return db
    .select()
    .from(spaces)
    .orderBy(desc(spaces.updatedAt));
}

/** Spaces visible in the GM workspace (excludes `HEARTGARDEN_PLAYER_SPACE_ID` when set). */
export async function listGmWorkspaceSpaces(db: VigilDb) {
  const all = await listAllSpaces(db);
  const hid = playerSpaceIdExcludedFromGmDb();
  if (!hid || isHeartgardenGmPlayerSpaceBreakGlassEnabled()) return all;
  return all.filter((s) => s.id !== hid);
}

/**
 * Like `resolveActiveSpace` but never selects the Players-only space for GM.
 * If the DB only contains the hidden space, inserts a new “Main space” for GM.
 */
export async function resolveActiveSpaceGmWorkspace(db: VigilDb, requestedSpaceId?: string) {
  let allSpaces = await listGmWorkspaceSpaces(db);
  if (allSpaces.length === 0) {
    const [created] = await db
      .insert(spaces)
      .values({ name: "Main space" })
      .returning();
    allSpaces = [created!];
  }
  const hid = playerSpaceIdExcludedFromGmDb();
  const breakGlass = isHeartgardenGmPlayerSpaceBreakGlassEnabled();
  const reqOk =
    requestedSpaceId &&
    allSpaces.some((s) => s.id === requestedSpaceId) &&
    (!hid || breakGlass || requestedSpaceId !== hid);
  const active = reqOk
    ? allSpaces.find((s) => s.id === requestedSpaceId)!
    : allSpaces[0];
  return { activeSpace: active, allSpaces };
}

export async function resolveActiveSpace(
  db: VigilDb,
  requestedSpaceId?: string,
) {
  let allSpaces = await listAllSpaces(db);
  if (allSpaces.length === 0) {
    const [created] = await db
      .insert(spaces)
      .values({ name: "Main space" })
      .returning();
    allSpaces = [created!];
  }
  const active =
    requestedSpaceId && allSpaces.some((s) => s.id === requestedSpaceId)
      ? allSpaces.find((s) => s.id === requestedSpaceId)!
      : allSpaces[0];
  return { activeSpace: active, allSpaces };
}

export async function assertSpaceExists(db: VigilDb, spaceId: string) {
  const [row] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);
  return row;
}

/**
 * Returns true if setting `spaceId.parentSpaceId = newParentId` would create a cycle
 * (`newParentId` is `spaceId` or lies in `spaceId`'s descendant subtree). Pure helper for tests + server.
 */
export function spaceReparentWouldCreateCycle(
  spaceId: string,
  newParentId: string | null,
  rows: readonly { id: string; parentSpaceId: string | null }[],
): boolean {
  if (newParentId == null) return false;
  if (newParentId === spaceId) return true;
  const byId = new Map(rows.map((r) => [r.id, r.parentSpaceId ?? null]));
  let current: string | null = newParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === spaceId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current = byId.get(current) ?? null;
  }
  return false;
}

export async function assertSpaceReparentAllowed(
  db: VigilDb,
  spaceId: string,
  newParentId: string | null,
): Promise<
  { ok: true } | { ok: false; error: "space_not_found" | "parent_not_found" | "would_create_cycle" }
> {
  const child = await assertSpaceExists(db, spaceId);
  if (!child) return { ok: false, error: "space_not_found" };
  if (newParentId !== null) {
    const parent = await assertSpaceExists(db, newParentId);
    if (!parent) return { ok: false, error: "parent_not_found" };
  }
  const treeRows = await db
    .select({ id: spaces.id, parentSpaceId: spaces.parentSpaceId })
    .from(spaces);
  if (spaceReparentWouldCreateCycle(spaceId, newParentId, treeRows)) {
    return { ok: false, error: "would_create_cycle" };
  }
  return { ok: true };
}

export async function listItemsForSpace(db: VigilDb, spaceId: string) {
  return db
    .select()
    .from(items)
    .where(eq(items.spaceId, spaceId))
    .orderBy(asc(items.zIndex), asc(items.createdAt));
}

/** Active space plus all descendant spaces (for canvas items that live in child spaces). */
export function collectSpaceSubtreeIds(
  rootId: string,
  spaceRows: { id: string; parentSpaceId: string | null }[],
): string[] {
  const byParent = new Map<string | null, string[]>();
  for (const s of spaceRows) {
    const p = s.parentSpaceId ?? null;
    const list = byParent.get(p) ?? [];
    list.push(s.id);
    byParent.set(p, list);
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    out.push(id);
    const kids = byParent.get(id);
    if (kids) for (const k of kids) stack.push(k);
  }
  return out;
}

export async function listItemsForSpaceSubtree(
  db: VigilDb,
  rootSpaceId: string,
  spaceRows: { id: string; parentSpaceId: string | null }[],
) {
  const ids = collectSpaceSubtreeIds(rootSpaceId, spaceRows);
  if (ids.length === 0) return [];
  return db
    .select()
    .from(items)
    .where(inArray(items.spaceId, ids))
    .orderBy(asc(items.zIndex), asc(items.createdAt));
}

export type SearchSort = "relevance" | "updated" | "created" | "title";

export type SearchFilters = {
  spaceId?: string;
  /** Exclude items in this space (GM global search vs Players space). */
  excludeSpaceId?: string;
  itemTypes?: string[];
  entityTypes?: string[];
  updatedAfter?: Date;
  hasLinks?: boolean;
  inStack?: boolean;
  sort?: SearchSort;
  limit?: number;
  /** Items with `entityMeta.campaignEpoch` null or >= this value are included. */
  minCampaignEpoch?: number;
  /** When true, exclude items with `entityMeta.loreHistorical === true`. */
  excludeLoreHistorical?: boolean;
};

export type SearchRow = {
  item: typeof items.$inferSelect;
  space: Pick<typeof spaces.$inferSelect, "id" | "name" | "parentSpaceId">;
  score?: number;
  snippet?: string;
};

function normalizeLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(limit)) return fallback;
  const value = Math.floor(limit as number);
  if (value <= 0) return fallback;
  return Math.min(value, max);
}

function searchWhereClauses(filters: SearchFilters): ReturnType<typeof sql>[] {
  const clauses: ReturnType<typeof sql>[] = [];
  if (filters.spaceId) clauses.push(eq(items.spaceId, filters.spaceId));
  if (filters.excludeSpaceId) clauses.push(ne(items.spaceId, filters.excludeSpaceId));
  if (filters.itemTypes?.length) clauses.push(inArray(items.itemType, filters.itemTypes));
  if (filters.entityTypes?.length) clauses.push(inArray(items.entityType, filters.entityTypes));
  if (filters.updatedAfter) clauses.push(sql`${items.updatedAt} >= ${filters.updatedAfter}`);
  if (filters.hasLinks === true) {
    clauses.push(
      sql`exists (select 1 from ${itemLinks} l where l.source_item_id = ${items.id} or l.target_item_id = ${items.id})`,
    );
  }
  if (filters.hasLinks === false) {
    clauses.push(
      sql`not exists (select 1 from ${itemLinks} l where l.source_item_id = ${items.id} or l.target_item_id = ${items.id})`,
    );
  }
  if (filters.inStack === true) clauses.push(sql`${items.stackId} is not null`);
  if (filters.inStack === false) clauses.push(sql`${items.stackId} is null`);
  if (filters.minCampaignEpoch !== undefined) {
    const v = filters.minCampaignEpoch;
    clauses.push(
      sql`(
        ${items.entityMeta} ->> 'campaignEpoch' is null
        or (${items.entityMeta} ->> 'campaignEpoch')::int >= ${v}
      )`,
    );
  }
  if (filters.excludeLoreHistorical === true) {
    clauses.push(
      sql`coalesce((${items.entityMeta} ->> 'loreHistorical')::boolean, false) = false`,
    );
  }
  return clauses;
}

function applySortForNonRanked(sort: SearchSort | undefined) {
  if (sort === "created") return [desc(items.createdAt)];
  if (sort === "title") return [asc(items.title), desc(items.updatedAt)];
  return [desc(items.updatedAt)];
}

function buildPrefixTsQuery(query: string): string | null {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9_-]/g, ""))
    .filter(Boolean);
  if (tokens.length === 0) return null;
  const parts = tokens.map((token, index) =>
    index === tokens.length - 1 ? `${token}:*` : token,
  );
  return parts.join(" & ");
}

function toSearchRows(
  rows: {
    item: typeof items.$inferSelect;
    spaceId: string;
    spaceName: string;
    parentSpaceId: string | null;
    score?: number;
    snippet?: string;
  }[],
): SearchRow[] {
  return rows.map((row) => ({
    item: row.item,
    space: { id: row.spaceId, name: row.spaceName, parentSpaceId: row.parentSpaceId },
    score: row.score,
    snippet: row.snippet,
  }));
}

export async function searchItemsFTS(
  db: VigilDb,
  query: string,
  filters: SearchFilters = {},
) {
  const q = query.trim();
  if (!q) return [] as SearchRow[];
  const limit = normalizeLimit(filters.limit, 50, 200);
  const vectorExpr = sql`to_tsvector('english', coalesce(${items.searchBlob}, ''))`;
  const tsQuery = sql`plainto_tsquery('english', ${q})`;
  const rankExpr = sql<number>`ts_rank(${vectorExpr}, ${tsQuery})`;
  const where = and(...searchWhereClauses(filters), sql`${vectorExpr} @@ ${tsQuery}`);
  const sort = filters.sort ?? "relevance";
  const rankedOrder =
    sort === "relevance"
      ? [desc(rankExpr), desc(items.updatedAt)]
      : applySortForNonRanked(sort);
  const rows = await db
    .select({
      item: items,
      spaceId: spaces.id,
      spaceName: spaces.name,
      parentSpaceId: spaces.parentSpaceId,
      score: rankExpr,
    })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(where)
    .orderBy(...rankedOrder)
    .limit(limit);
  return toSearchRows(rows);
}

/** Same as `searchItemsFTS` but includes `ts_headline` snippet for each row. */
export async function searchItemsFTSWithSnippets(
  db: VigilDb,
  query: string,
  filters: SearchFilters = {},
) {
  const q = query.trim();
  if (!q) return [] as SearchRow[];
  const limit = normalizeLimit(filters.limit, 50, 200);
  const vectorExpr = sql`to_tsvector('english', coalesce(${items.searchBlob}, ''))`;
  const tsQuery = sql`plainto_tsquery('english', ${q})`;
  const rankExpr = sql<number>`ts_rank(${vectorExpr}, ${tsQuery})`;
  const snippetExpr = sql<string>`ts_headline('english', coalesce(${items.searchBlob}, ''), ${tsQuery})`;
  const where = and(...searchWhereClauses(filters), sql`${vectorExpr} @@ ${tsQuery}`);
  const sort = filters.sort ?? "relevance";
  const rankedOrder =
    sort === "relevance"
      ? [desc(rankExpr), desc(items.updatedAt)]
      : applySortForNonRanked(sort);
  const rows = await db
    .select({
      item: items,
      spaceId: spaces.id,
      spaceName: spaces.name,
      parentSpaceId: spaces.parentSpaceId,
      score: rankExpr,
      snippet: snippetExpr,
    })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(where)
    .orderBy(...rankedOrder)
    .limit(limit);
  return toSearchRows(rows);
}

export async function searchItemsFuzzy(
  db: VigilDb,
  query: string,
  filters: SearchFilters = {},
  minSimilarity = 0.25,
) {
  const q = query.trim();
  if (!q) return [] as SearchRow[];
  const limit = normalizeLimit(filters.limit, 24, 100);
  const similarityExpr = sql<number>`similarity(${items.title}, ${q})`;
  const where = and(...searchWhereClauses(filters), sql`${similarityExpr} > ${minSimilarity}`);
  const sort = filters.sort ?? "relevance";
  const rankedOrder =
    sort === "relevance"
      ? [desc(similarityExpr), desc(items.updatedAt)]
      : applySortForNonRanked(sort);
  const rows = await db
    .select({
      item: items,
      spaceId: spaces.id,
      spaceName: spaces.name,
      parentSpaceId: spaces.parentSpaceId,
      score: similarityExpr,
    })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(where)
    .orderBy(...rankedOrder)
    .limit(limit);
  return toSearchRows(rows);
}

/**
 * Merge FTS + trigram (fuzzy) hits; dedupe by item id. No vector / embedding pass.
 */
export async function searchItemsHybrid(
  db: VigilDb,
  query: string,
  filters: SearchFilters = {},
  ftsLimit = 30,
  fuzzyLimit = 16,
) {
  const [ftsRows, fuzzyRows] = await Promise.all([
    searchItemsFTS(db, query, { ...filters, limit: ftsLimit }),
    searchItemsFuzzy(db, query, { ...filters, limit: fuzzyLimit }),
  ]);
  const seen = new Set<string>();
  const out: SearchRow[] = [];
  for (const row of [...ftsRows, ...fuzzyRows]) {
    if (seen.has(row.item.id)) continue;
    seen.add(row.item.id);
    out.push(row);
  }
  return out;
}

export async function suggestItems(
  db: VigilDb,
  query: string,
  filters: SearchFilters = {},
) {
  const q = query.trim();
  if (!q) return [] as SearchRow[];
  const limit = normalizeLimit(filters.limit, 10, 20);
  const vectorExpr = sql`to_tsvector('english', coalesce(${items.searchBlob}, ''))`;
  const prefixTs = buildPrefixTsQuery(q);
  const tsQuery = prefixTs
    ? sql`to_tsquery('english', ${prefixTs})`
    : sql`plainto_tsquery('english', ${q})`;
  const rankExpr = sql<number>`ts_rank(${vectorExpr}, ${tsQuery})`;
  const where = and(...searchWhereClauses(filters), sql`${vectorExpr} @@ ${tsQuery}`);
  const ftsRows = await db
    .select({
      item: items,
      spaceId: spaces.id,
      spaceName: spaces.name,
      parentSpaceId: spaces.parentSpaceId,
      score: rankExpr,
      snippet: sql<string>`ts_headline('english', coalesce(${items.searchBlob}, ''), ${tsQuery})`,
    })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(where)
    .orderBy(desc(rankExpr), desc(items.updatedAt))
    .limit(limit);
  const out = toSearchRows(ftsRows);
  if (out.length >= limit) return out;
  const fuzzyRows = await searchItemsFuzzy(db, q, { ...filters, limit: limit - out.length });
  const seen = new Set(out.map((row) => row.item.id));
  for (const row of fuzzyRows) {
    if (seen.has(row.item.id)) continue;
    out.push(row);
    seen.add(row.item.id);
    if (out.length >= limit) break;
  }
  return out;
}

export async function listLinksForItem(db: VigilDb, itemId: string) {
  return db
    .select()
    .from(itemLinks)
    .where(
      or(
        eq(itemLinks.sourceItemId, itemId),
        eq(itemLinks.targetItemId, itemId),
      ),
    );
}

export type LinkEndpoint = {
  id: string;
  title: string;
  itemType: string;
};

export type ResolvedLinkOut = {
  linkId: string;
  linkType: string;
  label: string | null;
  to: LinkEndpoint;
};

export type ResolvedLinkIn = {
  linkId: string;
  linkType: string;
  label: string | null;
  from: LinkEndpoint;
};

export async function getItemLinksResolved(
  db: VigilDb,
  itemId: string,
): Promise<{ outgoing: ResolvedLinkOut[]; incoming: ResolvedLinkIn[] }> {
  const links = await listLinksForItem(db, itemId);
  const peerIds = new Set<string>();
  for (const l of links) {
    if (l.sourceItemId === itemId) peerIds.add(l.targetItemId);
    else peerIds.add(l.sourceItemId);
  }
  if (peerIds.size === 0) {
    return { outgoing: [], incoming: [] };
  }
  const peerRows = await db
    .select({
      id: items.id,
      title: items.title,
      itemType: items.itemType,
    })
    .from(items)
    .where(inArray(items.id, [...peerIds]));
  const peerMap = new Map(
    peerRows.map((p) => [
      p.id,
      { id: p.id, title: p.title, itemType: p.itemType },
    ]),
  );

  const outgoing: ResolvedLinkOut[] = [];
  const incoming: ResolvedLinkIn[] = [];
  for (const l of links) {
    if (l.sourceItemId === itemId) {
      const to = peerMap.get(l.targetItemId);
      if (to) {
        outgoing.push({
          linkId: l.id,
          linkType: l.linkType,
          label: l.label,
          to,
        });
      }
    } else {
      const from = peerMap.get(l.sourceItemId);
      if (from) {
        incoming.push({
          linkId: l.id,
          linkType: l.linkType,
          label: l.label,
          from,
        });
      }
    }
  }
  return { outgoing, incoming };
}

/**
 * Deletes a space and all descendant spaces (post-order: leaves first).
 * Items in those spaces are removed via `items.space_id` ON DELETE CASCADE.
 */
export async function deleteSpaceSubtree(
  db: VigilDb,
  spaceId: string,
): Promise<{ ok: true; deletedIds: string[] } | { ok: false; error: string }> {
  const all = await db
    .select({ id: spaces.id, parentSpaceId: spaces.parentSpaceId })
    .from(spaces);

  if (!all.some((s) => s.id === spaceId)) {
    return { ok: false, error: "Space not found" };
  }

  const byParent = new Map<string | null, string[]>();
  for (const s of all) {
    const p = s.parentSpaceId ?? null;
    const list = byParent.get(p) ?? [];
    list.push(s.id);
    byParent.set(p, list);
  }

  const inTree = new Set<string>();
  const stack: string[] = [spaceId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (inTree.has(id)) continue;
    inTree.add(id);
    for (const kid of byParent.get(id) ?? []) stack.push(kid);
  }

  if (inTree.size >= all.length) {
    return { ok: false, error: "Cannot delete all spaces" };
  }

  const order: string[] = [];
  const postOrder = (id: string) => {
    for (const kid of byParent.get(id) ?? []) {
      if (inTree.has(kid)) postOrder(kid);
    }
    order.push(id);
  };
  postOrder(spaceId);

  for (const id of order) {
    await db.delete(spaces).where(eq(spaces.id, id));
  }

  return { ok: true, deletedIds: order };
}
