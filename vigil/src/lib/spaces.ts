import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { itemEmbeddings, itemLinks, items, spaces } from "@/src/db/schema";
import type { CameraState } from "@/src/stores/canvas-types";
import { defaultCamera } from "@/src/stores/canvas-types";

export type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

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

export async function listItemsForSpace(db: VigilDb, spaceId: string) {
  return db
    .select()
    .from(items)
    .where(eq(items.spaceId, spaceId))
    .orderBy(asc(items.zIndex), asc(items.createdAt));
}

export type SearchSort = "relevance" | "updated" | "created" | "title";

export type SearchFilters = {
  spaceId?: string;
  itemTypes?: string[];
  entityTypes?: string[];
  updatedAfter?: Date;
  hasLinks?: boolean;
  inStack?: boolean;
  sort?: SearchSort;
  limit?: number;
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

/** Nearest items by pgvector cosine distance (`<=>`). Requires rows in `item_embeddings`. */
export async function searchItemsSemantic(
  db: VigilDb,
  embedding: number[],
  filters: SearchFilters = {},
) {
  if (embedding.length === 0) return [] as SearchRow[];
  const limit = normalizeLimit(filters.limit, 24, 100);
  const literal = `'[${embedding.map((n) => Number(n)).join(",")}]'::vector`;
  const distanceExpr = sql<number>`${itemEmbeddings.embedding} <=> ${sql.raw(literal)}`;
  const where = and(...searchWhereClauses(filters));
  const rows = await db
    .select({
      item: items,
      spaceId: spaces.id,
      spaceName: spaces.name,
      parentSpaceId: spaces.parentSpaceId,
      score: distanceExpr,
    })
    .from(items)
    .innerJoin(itemEmbeddings, eq(items.id, itemEmbeddings.itemId))
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(where)
    .orderBy(distanceExpr)
    .limit(limit);
  return toSearchRows(rows);
}

export async function searchItemsHybrid(
  db: VigilDb,
  query: string,
  embedding: number[],
  filters: SearchFilters = {},
  ftsLimit = 30,
  fuzzyLimit = 16,
  semanticLimit = 24,
) {
  const [ftsRows, fuzzyRows, semRows] = await Promise.all([
    searchItemsFTS(db, query, { ...filters, limit: ftsLimit }),
    searchItemsFuzzy(db, query, { ...filters, limit: fuzzyLimit }),
    searchItemsSemantic(db, embedding, { ...filters, limit: semanticLimit }),
  ]);
  const seen = new Set<string>();
  const out: SearchRow[] = [];
  for (const row of [...ftsRows, ...fuzzyRows, ...semRows]) {
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
