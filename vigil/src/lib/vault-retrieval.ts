import { and, eq, inArray, or, sql } from "drizzle-orm";

import { itemEmbeddings, itemLinks, items, spaces } from "@/src/db/schema";
import { embedTexts, isEmbeddingApiConfigured } from "@/src/lib/embedding-provider";
import type { VigilDb } from "@/src/lib/spaces";
import {
  searchItemsFTSWithSnippets,
  searchItemsFuzzy,
  type SearchFilters,
  type SearchRow,
} from "@/src/lib/spaces";

const RRF_K = 60;
const DEFAULT_VECTOR_CHUNK_LIMIT = 56;
const DEFAULT_MAX_ITEMS = 16;
const MAX_CHUNKS_PER_ITEM = 4;
const GRAPH_EXTRA_ITEMS = 8;
const GRAPH_EXCERPT_CHARS = 420;

function vectorSqlLiteral(embedding: number[]): string {
  if (embedding.length !== 1536 || !embedding.every((n) => Number.isFinite(n))) {
    throw new Error("invalid query embedding");
  }
  return `'[${embedding.join(",")}]'::vector`;
}

export type VectorChunkHit = {
  itemId: string;
  chunkText: string;
  chunkIndex: number;
  distance: number;
  item: typeof items.$inferSelect;
  space: { id: string; name: string; parentSpaceId: string | null };
};

export async function searchItemChunksByVector(
  db: VigilDb,
  queryEmbedding: number[],
  filters: SearchFilters = {},
  limit = DEFAULT_VECTOR_CHUNK_LIMIT,
): Promise<VectorChunkHit[]> {
  const lit = sql.raw(vectorSqlLiteral(queryEmbedding));
  const distanceExpr = sql<number>`${itemEmbeddings.embedding} <=> ${lit}`;

  const whereParts: ReturnType<typeof sql>[] = [];
  if (filters.spaceId) whereParts.push(eq(itemEmbeddings.spaceId, filters.spaceId));

  const whereClause = whereParts.length ? and(...whereParts) : undefined;

  const q = db
    .select({
      itemId: itemEmbeddings.itemId,
      chunkText: itemEmbeddings.chunkText,
      chunkIndex: itemEmbeddings.chunkIndex,
      distance: distanceExpr,
      item: items,
      spaceId: spaces.id,
      spaceName: spaces.name,
      parentSpaceId: spaces.parentSpaceId,
    })
    .from(itemEmbeddings)
    .innerJoin(items, eq(items.id, itemEmbeddings.itemId))
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .orderBy(distanceExpr)
    .limit(limit);

  const rows = whereClause ? await q.where(whereClause) : await q;

  return rows.map((r) => ({
    itemId: r.itemId,
    chunkText: r.chunkText,
    chunkIndex: r.chunkIndex,
    distance: r.distance,
    item: r.item,
    space: { id: r.spaceId, name: r.spaceName, parentSpaceId: r.parentSpaceId },
  }));
}

function rrfScore(rank: number | undefined): number {
  if (rank === undefined) return 0;
  return 1 / (RRF_K + rank + 1);
}

export type HybridRetrieveResult = {
  rows: SearchRow[];
  itemIdToChunks: Map<string, string[]>;
  itemIdToFtsSnippet: Map<string, string>;
};

/**
 * Lexical (FTS + optional fuzzy) fused with vector chunk hits via RRF.
 */
export async function hybridRetrieveItems(
  db: VigilDb,
  query: string,
  filters: SearchFilters = {},
  options: {
    maxItems?: number;
    vectorChunkLimit?: number;
    includeVector?: boolean;
  } = {},
): Promise<HybridRetrieveResult> {
  const q = query.trim();
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
  const vecLimit = options.vectorChunkLimit ?? DEFAULT_VECTOR_CHUNK_LIMIT;
  const useVector = options.includeVector !== false && isEmbeddingApiConfigured();

  const itemIdToChunks = new Map<string, string[]>();
  const itemIdToFtsSnippet = new Map<string, string>();

  if (!q) {
    return { rows: [], itemIdToChunks, itemIdToFtsSnippet };
  }

  const ftsRows = await searchItemsFTSWithSnippets(db, q, { ...filters, limit: 36 });
  for (const r of ftsRows) {
    if (r.snippet) itemIdToFtsSnippet.set(r.item.id, r.snippet);
  }

  let lexicalRows: SearchRow[] = ftsRows;
  if (ftsRows.length === 0) {
    lexicalRows = await searchItemsFuzzy(db, q, { ...filters, limit: 20 });
  } else if (ftsRows.length < 8) {
    const fuzzyRows = await searchItemsFuzzy(db, q, { ...filters, limit: 16 });
    const seen = new Set(ftsRows.map((r) => r.item.id));
    lexicalRows = [...ftsRows];
    for (const fr of fuzzyRows) {
      if (seen.has(fr.item.id)) continue;
      seen.add(fr.item.id);
      lexicalRows.push(fr);
    }
  }

  let vecHits: VectorChunkHit[] = [];
  if (useVector) {
    try {
      const [qEmb] = await embedTexts([q.slice(0, 8000)]);
      vecHits = await searchItemChunksByVector(db, qEmb, filters, vecLimit);
    } catch {
      vecHits = [];
    }
  }

  const vecRankByItem = new Map<string, number>();
  for (let i = 0; i < vecHits.length; i++) {
    const id = vecHits[i]!.itemId;
    if (!vecRankByItem.has(id)) vecRankByItem.set(id, i);
  }

  for (const h of vecHits) {
    const list = itemIdToChunks.get(h.itemId) ?? [];
    if (list.length < MAX_CHUNKS_PER_ITEM) {
      list.push(h.chunkText);
      itemIdToChunks.set(h.itemId, list);
    }
  }

  const lexRankByItem = new Map<string, number>();
  lexicalRows.forEach((r, i) => {
    if (!lexRankByItem.has(r.item.id)) lexRankByItem.set(r.item.id, i);
  });

  const allIds = new Set<string>([
    ...lexicalRows.map((r) => r.item.id),
    ...vecHits.map((h) => h.itemId),
  ]);

  const scored = [...allIds].map((id) => {
    const lexR = lexRankByItem.get(id);
    const vecR = vecRankByItem.get(id);
    const score = rrfScore(lexR) + rrfScore(vecR);
    return { id, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const topIds = scored.slice(0, maxItems).map((s) => s.id);
  const rowById = new Map<string, SearchRow>();
  for (const r of lexicalRows) rowById.set(r.item.id, r);
  for (const h of vecHits) {
    if (!rowById.has(h.itemId)) {
      rowById.set(h.itemId, {
        item: h.item,
        space: h.space,
        score: undefined,
        snippet: undefined,
      });
    }
  }

  const rows: SearchRow[] = [];
  for (const id of topIds) {
    const r = rowById.get(id);
    if (r) rows.push(r);
  }

  return { rows, itemIdToChunks, itemIdToFtsSnippet };
}

export type GraphNeighborRow = SearchRow & { graphNeighbor?: true };

/**
 * Add up to `cap` linked items (1-hop) not already in `seedIds`.
 */
export async function expandLinkedItems(
  db: VigilDb,
  seedIds: string[],
  filters: SearchFilters,
  cap: number,
): Promise<SearchRow[]> {
  if (cap <= 0 || seedIds.length === 0) return [];

  const seedSet = new Set(seedIds);
  const linkRows = await db
    .select({
      sourceItemId: itemLinks.sourceItemId,
      targetItemId: itemLinks.targetItemId,
    })
    .from(itemLinks)
    .where(
      or(inArray(itemLinks.sourceItemId, seedIds), inArray(itemLinks.targetItemId, seedIds)),
    );

  const neighborIds = new Set<string>();
  for (const l of linkRows) {
    if (!seedSet.has(l.sourceItemId)) neighborIds.add(l.sourceItemId);
    if (!seedSet.has(l.targetItemId)) neighborIds.add(l.targetItemId);
  }

  const toFetch = [...neighborIds].slice(0, cap);
  if (toFetch.length === 0) return [];

  const where = and(
    inArray(items.id, toFetch),
    ...(filters.spaceId ? [eq(items.spaceId, filters.spaceId)] : []),
  );
  const found = await db
    .select({
      item: items,
      spaceId: spaces.id,
      spaceName: spaces.name,
      parentSpaceId: spaces.parentSpaceId,
    })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(where)
    .limit(cap);

  return found.map((r) => ({
    item: r.item,
    space: { id: r.spaceId, name: r.spaceName, parentSpaceId: r.parentSpaceId },
    graphNeighbor: true as const,
  }));
}

export function excerptForLore(
  row: SearchRow,
  itemIdToChunks: Map<string, string[]>,
  itemIdToFtsSnippet: Map<string, string>,
  maxChars: number,
): string {
  const id = row.item.id;
  const chunks = itemIdToChunks.get(id) ?? [];
  const headline = itemIdToFtsSnippet.get(id);
  const title = row.item.title?.trim() || "Untitled";
  const parts: string[] = [`Title: ${title}`];
  if (headline) parts.push(`Search match: ${headline}`);
  if (chunks.length) {
    parts.push("Relevant excerpts (semantic):\n" + chunks.join("\n---\n"));
  } else {
    const body = row.item.contentText?.trim() ?? "";
    if (body) {
      parts.push(body.length <= maxChars ? body : `${body.slice(0, maxChars)}…`);
    }
  }
  const joined = parts.join("\n\n").trim();
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars)}…`;
}

/** Total character budget split across N primary sources (graph neighbors use smaller slice). */
export function budgetPerSource(count: number, totalBudget = 14_000): number {
  if (count <= 0) return totalBudget;
  return Math.max(1200, Math.floor(totalBudget / Math.min(count, 20)));
}
