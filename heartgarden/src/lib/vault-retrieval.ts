/**
 * Hybrid search over the vault: FTS + fuzzy + optional pgvector chunks, fused via RRF
 * (`fuseRrfFromOrderedLists`). Consumed by `/api/search`, lore import planning, and `lore-engine`.
 */
import { and, eq, inArray, ne, notInArray, or, sql } from "drizzle-orm";

import { entityMentions, itemEmbeddings, itemLinks, items, spaces } from "@/src/db/schema";
import { embedTexts, isEmbeddingApiConfigured } from "@/src/lib/embedding-provider";
import { logVaultHybridRetrieval } from "@/src/lib/vault-retrieval-debug";
import { fuseRrfFromOrderedLists } from "@/src/lib/vault-retrieval-rrf";
import { extractHgArchBoundItemIds } from "@/src/lib/hg-arch-binding-projection";
import {
  buildItemVaultCorpus,
  itemSearchableSourceFromRow,
} from "@/src/lib/item-searchable-text";
import { dedupeLogicalItemLinkRows } from "@/src/lib/item-links-logical-dedupe";
import { linkExpansionDepriorityRank } from "@/src/lib/item-link-meta";
import type { VigilDb } from "@/src/lib/spaces";
import {
  searchItemAttributeWhereClauses,
  searchItemsFTS,
  searchItemsFTSWithSnippets,
  searchItemsFuzzy,
  type SearchFilters,
  type SearchRow,
} from "@/src/lib/spaces";

export const DEFAULT_VECTOR_CHUNK_LIMIT = 56;
export const DEFAULT_MAX_ITEMS = 16;
export const DEFAULT_FTS_LIMIT = 36;
export const DEFAULT_FUZZY_LIMIT_WHEN_EMPTY = 20;
export const DEFAULT_FUZZY_LIMIT_WHEN_SPARSE = 16;
/** When FTS hit count is below this, merge fuzzy supplement rows. */
export const DEFAULT_FTS_SPARSE_THRESHOLD = 8;
export const DEFAULT_MAX_CHUNKS_PER_ITEM = 4;
export const DEFAULT_RRF_K = 60;
export const DEFAULT_RRF_LEXICAL_WEIGHT = 1;
export const DEFAULT_RRF_VECTOR_WEIGHT = 1;
export const DEFAULT_RRF_MENTION_WEIGHT = 0.5;

function envNumberInRange(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function envIntegerInRange(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

const defaultRrfKFromEnv = envIntegerInRange(
  process.env.HEARTGARDEN_RETRIEVAL_RRF_K,
  DEFAULT_RRF_K,
  1,
  500,
);
const defaultRrfLexicalWeightFromEnv = envNumberInRange(
  process.env.HEARTGARDEN_RETRIEVAL_RRF_LEXICAL_WEIGHT,
  DEFAULT_RRF_LEXICAL_WEIGHT,
  0.1,
  8,
);
const defaultRrfVectorWeightFromEnv = envNumberInRange(
  process.env.HEARTGARDEN_RETRIEVAL_RRF_VECTOR_WEIGHT,
  DEFAULT_RRF_VECTOR_WEIGHT,
  0.1,
  8,
);
const defaultRrfMentionWeightFromEnv = envNumberInRange(
  process.env.HEARTGARDEN_RETRIEVE_MENTION_WEIGHT,
  DEFAULT_RRF_MENTION_WEIGHT,
  0.1,
  8,
);

/**
 * Options for `hybridRetrieveItems`. Omitted fields use defaults matching pre-tuning behavior.
 */
export type HybridRetrieveOptions = {
  maxItems?: number;
  vectorChunkLimit?: number;
  includeVector?: boolean;
  ftsLimit?: number;
  fuzzyLimitWhenEmpty?: number;
  fuzzyLimitWhenSparse?: number;
  ftsSparseThreshold?: number;
  maxChunksPerItem?: number;
  rrfK?: number;
  rrfLexicalWeight?: number;
  rrfVectorWeight?: number;
  rrfMentionWeight?: number;
  /**
   * When false, skip `ts_headline` snippet generation in the lexical leg.
   * Default: true (back-compat with lore-engine / lore-import-plan-build / lore-consistency-check
   * which read `itemIdToFtsSnippet`). Callers that only consume `rows` (e.g. `/api/search`)
   * can pass `false` to avoid expensive headline computation. (`REVIEW_2026-04-25_1835` M5.)
   */
  includeSnippets?: boolean;
};

function tokenizeMentionQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((v) => v.trim())
    .filter((v) => v.length >= 3)
    .slice(0, 8);
}

function vectorSqlLiteral(embedding: number[]): string {
  if (embedding.length !== 1536 || !embedding.every((n) => Number.isFinite(n))) {
    throw new Error("invalid query embedding");
  }
  return `'[${embedding.join(",")}]'::vector`;
}

export type VectorChunkHit = {
  itemId: string;
  chunkText: string;
  headingPath: string[];
  chunkIndex: number;
  distance: number;
  item: typeof items.$inferSelect;
  space: { id: string; name: string; parentSpaceId: string | null };
};

export type VectorChunkMatch = {
  text: string;
  headingPath: string[];
};

function parseHeadingPath(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v ?? "").trim()).filter(Boolean);
      }
    } catch {
      /* ignore */
    }
    if (raw.trim()) return [raw.trim()];
  }
  return [];
}

export async function searchItemChunksByVector(
  db: VigilDb,
  queryEmbedding: number[],
  filters: SearchFilters = {},
  limit = DEFAULT_VECTOR_CHUNK_LIMIT,
): Promise<VectorChunkHit[]> {
  const lit = sql.raw(vectorSqlLiteral(queryEmbedding));
  const distanceExpr = sql<number>`${itemEmbeddings.embedding} <=> ${lit}`;

  const whereParts: ReturnType<typeof sql>[] = [];
  if (filters.spaceIds?.length) whereParts.push(inArray(itemEmbeddings.spaceId, filters.spaceIds));
  else if (filters.spaceId) whereParts.push(eq(itemEmbeddings.spaceId, filters.spaceId));
  if (filters.excludeSpaceIds?.length) {
    whereParts.push(notInArray(itemEmbeddings.spaceId, filters.excludeSpaceIds));
  }
  if (filters.excludeSpaceId) whereParts.push(ne(itemEmbeddings.spaceId, filters.excludeSpaceId));
  // REVIEW_2026-04-25_1835 H5: apply non-space filters (item-type, entity-kind,
  // historical, campaign-epoch, hasLinks, inStack) on the embedding leg too,
  // so hybrid + semantic results obey the same eligibility set as lexical.
  whereParts.push(...searchItemAttributeWhereClauses(filters));

  const whereClause = whereParts.length ? and(...whereParts) : undefined;

  const base = db
    .select({
      itemId: itemEmbeddings.itemId,
      chunkText: itemEmbeddings.chunkText,
      headingPath: itemEmbeddings.headingPath,
      chunkIndex: itemEmbeddings.chunkIndex,
      distance: distanceExpr,
      item: items,
      spaceId: spaces.id,
      spaceName: spaces.name,
      parentSpaceId: spaces.parentSpaceId,
    })
    .from(itemEmbeddings)
    .innerJoin(items, eq(items.id, itemEmbeddings.itemId))
    .innerJoin(spaces, eq(spaces.id, items.spaceId));

  const rows = whereClause
    ? await base.where(whereClause).orderBy(distanceExpr).limit(limit)
    : await base.orderBy(distanceExpr).limit(limit);

  return rows.map((r) => ({
    itemId: r.itemId,
    chunkText: r.chunkText,
    headingPath: parseHeadingPath(r.headingPath),
    chunkIndex: r.chunkIndex,
    distance: r.distance,
    item: r.item,
    space: { id: r.spaceId, name: r.spaceName, parentSpaceId: r.parentSpaceId },
  }));
}

export type HybridRetrieveResult = {
  rows: SearchRow[];
  itemIdToChunks: Map<string, string[]>;
  itemIdToChunkMatches: Map<string, VectorChunkMatch[]>;
  itemIdToFtsSnippet: Map<string, string>;
};

/**
 * Lexical (FTS + optional fuzzy) fused with vector chunk hits via RRF.
 */
export async function hybridRetrieveItems(
  db: VigilDb,
  query: string,
  filters: SearchFilters = {},
  options: HybridRetrieveOptions = {},
): Promise<HybridRetrieveResult> {
  const q = query.trim();
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
  const vecLimit = options.vectorChunkLimit ?? DEFAULT_VECTOR_CHUNK_LIMIT;
  const useVector = options.includeVector !== false && isEmbeddingApiConfigured();
  const ftsLimit = options.ftsLimit ?? DEFAULT_FTS_LIMIT;
  const fuzzyLimitWhenEmpty = options.fuzzyLimitWhenEmpty ?? DEFAULT_FUZZY_LIMIT_WHEN_EMPTY;
  const fuzzyLimitWhenSparse = options.fuzzyLimitWhenSparse ?? DEFAULT_FUZZY_LIMIT_WHEN_SPARSE;
  const ftsSparseThreshold = options.ftsSparseThreshold ?? DEFAULT_FTS_SPARSE_THRESHOLD;
  const maxChunksPerItem = options.maxChunksPerItem ?? DEFAULT_MAX_CHUNKS_PER_ITEM;
  const rrfK = options.rrfK ?? defaultRrfKFromEnv;
  const rrfLexicalWeight = options.rrfLexicalWeight ?? defaultRrfLexicalWeightFromEnv;
  const rrfVectorWeight = options.rrfVectorWeight ?? defaultRrfVectorWeightFromEnv;
  const rrfMentionWeight = options.rrfMentionWeight ?? defaultRrfMentionWeightFromEnv;
  const includeSnippets = options.includeSnippets !== false;

  const itemIdToChunks = new Map<string, string[]>();
  const itemIdToChunkMatches = new Map<string, VectorChunkMatch[]>();
  const itemIdToFtsSnippet = new Map<string, string>();

  if (!q) {
    return { rows: [], itemIdToChunks, itemIdToChunkMatches, itemIdToFtsSnippet };
  }

  const ftsRows = includeSnippets
    ? await searchItemsFTSWithSnippets(db, q, { ...filters, limit: ftsLimit })
    : await searchItemsFTS(db, q, { ...filters, limit: ftsLimit });
  if (includeSnippets) {
    for (const r of ftsRows) {
      if (r.snippet) itemIdToFtsSnippet.set(r.item.id, r.snippet);
    }
  }

  let lexicalRows: SearchRow[] = ftsRows;
  if (ftsRows.length === 0) {
    lexicalRows = await searchItemsFuzzy(db, q, { ...filters, limit: fuzzyLimitWhenEmpty });
  } else if (ftsRows.length < ftsSparseThreshold) {
    const fuzzyRows = await searchItemsFuzzy(db, q, { ...filters, limit: fuzzyLimitWhenSparse });
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

  for (const h of vecHits) {
    const list = itemIdToChunks.get(h.itemId) ?? [];
    const detailed = itemIdToChunkMatches.get(h.itemId) ?? [];
    if (list.length < maxChunksPerItem) {
      list.push(h.chunkText);
      itemIdToChunks.set(h.itemId, list);
      detailed.push({ text: h.chunkText, headingPath: h.headingPath });
      itemIdToChunkMatches.set(h.itemId, detailed);
    }
  }

  const lexicalOrderedIds = lexicalRows.map((r) => r.item.id);
  const vectorOrderedIds: string[] = [];
  const seenVectorSections = new Set<string>();
  for (const hit of vecHits) {
    const h2Path = hit.headingPath.slice(0, 2).join(">");
    const sectionKey = `${hit.itemId}|${h2Path || "__root__"}`;
    if (seenVectorSections.has(sectionKey)) continue;
    seenVectorSections.add(sectionKey);
    vectorOrderedIds.push(hit.itemId);
  }
  let mentionOrderedIds: string[] = [];
  const mentionTerms = tokenizeMentionQuery(q);
  if (mentionTerms.length > 0) {
    // REVIEW_2026-04-25_1835 H5: join to `items` and apply the same item-attribute
    // filter set as the lexical leg so item-type / entity-kind / canonical-kind /
    // historical / campaign-epoch toggles cannot leak through the mention path.
    const itemAttributeClauses = searchItemAttributeWhereClauses(filters);
    const needItemsJoin = itemAttributeClauses.length > 0;
    const mentionRowsBase = needItemsJoin
      ? db
          .select({
            itemId: entityMentions.sourceItemId,
            mentionCount: sql<number>`sum(${entityMentions.mentionCount})::int`,
          })
          .from(entityMentions)
          .innerJoin(items, eq(items.id, entityMentions.sourceItemId))
      : db
          .select({
            itemId: entityMentions.sourceItemId,
            mentionCount: sql<number>`sum(${entityMentions.mentionCount})::int`,
          })
          .from(entityMentions);
    const mentionRows = await mentionRowsBase
      .where(
        and(
          inArray(entityMentions.matchedTerm, mentionTerms),
          ...(filters.spaceIds?.length
            ? [inArray(entityMentions.sourceSpaceId, filters.spaceIds)]
            : filters.spaceId
              ? [eq(entityMentions.sourceSpaceId, filters.spaceId)]
              : []),
          ...(filters.excludeSpaceIds?.length
            ? [notInArray(entityMentions.sourceSpaceId, filters.excludeSpaceIds)]
            : filters.excludeSpaceId
              ? [ne(entityMentions.sourceSpaceId, filters.excludeSpaceId)]
              : []),
          ...itemAttributeClauses,
        ),
      )
      .groupBy(entityMentions.sourceItemId)
      .orderBy(sql`sum(${entityMentions.mentionCount}) desc`)
      .limit(Math.max(vecLimit, ftsLimit));
    mentionOrderedIds = mentionRows.map((row) => row.itemId);
  }
  const { topIds, scores } = fuseRrfFromOrderedLists({
    lexicalOrderedIds,
    vectorOrderedIds,
    mentionOrderedIds,
    maxItems,
    config: {
      k: rrfK,
      lexicalWeight: rrfLexicalWeight,
      vectorWeight: rrfVectorWeight,
      mentionWeight: rrfMentionWeight,
    },
  });

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
  const normalizedQuery = q.toLowerCase().trim();
  const boostedTopIds = [...topIds].sort((a, b) => {
    const aBase = scores.get(a)?.rrf ?? 0;
    const bBase = scores.get(b)?.rrf ?? 0;
    const aLeaf = (itemIdToChunkMatches.get(a)?.[0]?.headingPath.at(-1) ?? "").toLowerCase();
    const bLeaf = (itemIdToChunkMatches.get(b)?.[0]?.headingPath.at(-1) ?? "").toLowerCase();
    const shortQuery = normalizedQuery.length <= 80;
    const aBoost = shortQuery && aLeaf && aLeaf === normalizedQuery ? 0.03 : 0;
    const bBoost = shortQuery && bLeaf && bLeaf === normalizedQuery ? 0.03 : 0;
    const diff = bBase + bBoost - (aBase + aBoost);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
  for (const id of boostedTopIds) {
    const r = rowById.get(id);
    if (r) rows.push(r);
  }

  logVaultHybridRetrieval({
    queryPreview: q.slice(0, 240),
    maxItems,
    useVector,
    ftsLimit,
    fuzzyLimitWhenEmpty,
    fuzzyLimitWhenSparse,
    ftsSparseThreshold,
    maxChunksPerItem,
    vecLimit,
    rrfK,
    rrfLexicalWeight,
    rrfVectorWeight,
    rrfMentionWeight,
    ftsHits: ftsRows.length,
    lexicalRows: lexicalRows.length,
    vectorChunkHits: vecHits.length,
    mentionHits: mentionOrderedIds.length,
    filtersSummary: summarizeSearchFiltersForDebug(filters),
    top: topIds.slice(0, 12).map((id) => {
      const s = scores.get(id);
      const title = rowById.get(id)?.item.title?.trim() || "Untitled";
      return {
        id,
        title,
        lexRank: s?.lexRank,
        vecRank: s?.vecRank,
        mentionRank: s?.mentionRank,
        rrf: s?.rrf != null ? Number(s.rrf.toFixed(5)) : undefined,
      };
    }),
  });

  return { rows, itemIdToChunks, itemIdToChunkMatches, itemIdToFtsSnippet };
}

function summarizeSearchFiltersForDebug(f: SearchFilters): Record<string, unknown> {
  return {
    spaceId: f.spaceId ?? null,
    spaceIdsCount: f.spaceIds?.length ?? 0,
    excludeSpaceId: f.excludeSpaceId ?? null,
    excludeSpaceIdsCount: f.excludeSpaceIds?.length ?? 0,
    itemTypes: f.itemTypes?.length ? f.itemTypes : undefined,
    entityTypes: f.entityTypes?.length ? f.entityTypes : undefined,
    minCampaignEpoch: f.minCampaignEpoch,
    excludeLoreHistorical: f.excludeLoreHistorical,
    limit: f.limit,
  };
}

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
  const linkRowsRaw = await db
    .select({
      id: itemLinks.id,
      sourceItemId: itemLinks.sourceItemId,
      targetItemId: itemLinks.targetItemId,
      meta: itemLinks.meta,
      sourcePin: itemLinks.sourcePin,
      targetPin: itemLinks.targetPin,
      linkType: itemLinks.linkType,
      updatedAt: itemLinks.updatedAt,
    })
    .from(itemLinks)
    .where(
      or(inArray(itemLinks.sourceItemId, seedIds), inArray(itemLinks.targetItemId, seedIds)),
    );

  const linkRows = dedupeLogicalItemLinkRows(
    linkRowsRaw.map((l) => ({
      id: l.id,
      source: l.sourceItemId,
      target: l.targetItemId,
      linkType: l.linkType ?? null,
      sourcePin: l.sourcePin ?? null,
      targetPin: l.targetPin ?? null,
      color: null,
      meta: l.meta,
      updatedAtMs: l.updatedAt?.getTime() ?? 0,
    })),
  );

  const neighborRank = new Map<string, number>();
  for (const l of linkRows) {
    const rank = linkExpansionDepriorityRank(l.meta);
    const bump = (id: string) => {
      if (seedSet.has(id)) return;
      const prev = neighborRank.get(id) ?? Number.POSITIVE_INFINITY;
      neighborRank.set(id, Math.min(prev, rank));
    };
    bump(l.source);
    bump(l.target);
  }

  const sortedNeighbors = [...neighborRank.keys()].sort((a, b) => {
    const ra = neighborRank.get(a) ?? 0;
    const rb = neighborRank.get(b) ?? 0;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
  const toFetch = sortedNeighbors.slice(0, cap);
  if (toFetch.length === 0) return [];

  const where = and(
    inArray(items.id, toFetch),
    sql`coalesce((${items.entityMeta}::jsonb -> 'hgArchive' ->> 'archived'), 'false') != 'true'`,
    ...(filters.spaceIds?.length ? [inArray(items.spaceId, filters.spaceIds)] : []),
    ...(filters.spaceId && !filters.spaceIds?.length ? [eq(items.spaceId, filters.spaceId)] : []),
    ...(filters.excludeSpaceIds?.length ? [notInArray(items.spaceId, filters.excludeSpaceIds)] : []),
    ...(filters.excludeSpaceId ? [ne(items.spaceId, filters.excludeSpaceId)] : []),
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
  }));
}

/**
 * Neighbors referenced from structured `hgArch` on primary hits (bindings without a graph edge).
 */
export async function expandHgArchBindingNeighbors(
  db: VigilDb,
  seedRows: SearchRow[],
  filters: SearchFilters,
  cap: number,
): Promise<SearchRow[]> {
  if (cap <= 0 || seedRows.length === 0) return [];

  const seedIds = new Set(seedRows.map((r) => r.item.id));
  const neighborIds = new Set<string>();
  for (const row of seedRows) {
    const cj = row.item.contentJson as Record<string, unknown> | null | undefined;
    for (const id of extractHgArchBoundItemIds(cj)) {
      if (!seedIds.has(id)) neighborIds.add(id);
    }
  }

  const toFetch = [...neighborIds].slice(0, cap);
  if (toFetch.length === 0) return [];

  const where = and(
    inArray(items.id, toFetch),
    sql`coalesce((${items.entityMeta}::jsonb -> 'hgArchive' ->> 'archived'), 'false') != 'true'`,
    ...(filters.spaceIds?.length ? [inArray(items.spaceId, filters.spaceIds)] : []),
    ...(filters.spaceId && !filters.spaceIds?.length ? [eq(items.spaceId, filters.spaceId)] : []),
    ...(filters.excludeSpaceIds?.length ? [notInArray(items.spaceId, filters.excludeSpaceIds)] : []),
    ...(filters.excludeSpaceId ? [ne(items.spaceId, filters.excludeSpaceId)] : []),
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
    const corpus = buildItemVaultCorpus(itemSearchableSourceFromRow(row.item));
    const body = corpus.trim() || (row.item.contentText?.trim() ?? "");
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
