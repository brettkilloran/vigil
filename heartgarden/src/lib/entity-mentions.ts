import { and, eq, inArray, or, sql } from "drizzle-orm";
import { after } from "next/server";

import type { tryGetDb } from "@/src/db/index";
import { entityMentions, itemEmbeddings, items, spaces } from "@/src/db/schema";
import {
  buildEntityVocabularyForBrane,
  clearEntityVocabularyCache,
} from "@/src/lib/entity-vocabulary";
import { invalidateItemLinksRevisionForSpace } from "@/src/lib/item-links-space-revision";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;
type MentionSourceKind = "term" | "semantic";

const SEMANTIC_MENTION_TOKEN = "__semantic__";
const SEMANTIC_MAX_SOURCE_CHUNKS = 8;
const SEMANTIC_PER_CHUNK_NEIGHBORS = 6;
const SEMANTIC_MAX_TARGETS = 10;
const SEMANTIC_MAX_DISTANCE = 0.28;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(text: string, term: string): number {
  const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
  let count = 0;
  while (re.exec(text) !== null) {
    count += 1;
  }
  return count;
}

function makeSnippet(text: string, term: string): string | null {
  const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
  const m = re.exec(text);
  if (!m) {
    return null;
  }
  const idx = m.index;
  const start = Math.max(0, idx - 120);
  const end = Math.min(text.length, idx + term.length + 120);
  return text.slice(start, end).trim();
}

function parseHeadingPath(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof raw !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v ?? "").trim()).filter(Boolean);
    }
  } catch {
    /* ignore */
  }
  return raw.trim() ? [raw.trim()] : [];
}

function upsertBestSemanticMatch(
  bestByTarget: Map<
    string,
    {
      targetSpaceId: string;
      distance: number;
      snippet: string;
      headingPath: string | null;
    }
  >,
  row: {
    targetItemId: string;
    targetSpaceId: string;
    distance: number;
    snippet: string;
    headingPath: unknown;
  }
): void {
  const prev = bestByTarget.get(row.targetItemId);
  if (prev && prev.distance <= row.distance) {
    return;
  }
  const heading = parseHeadingPath(row.headingPath).join(" > ").trim();
  bestByTarget.set(row.targetItemId, {
    distance: row.distance,
    headingPath: heading || null,
    snippet: row.snippet,
    targetSpaceId: row.targetSpaceId,
  });
}

async function computeSemanticNeighborsForItem(
  db: VigilDb,
  sourceItemId: string,
  braneId: string
): Promise<
  Array<{
    targetItemId: string;
    targetSpaceId: string;
    distance: number;
    snippet: string;
    headingPath: string | null;
  }>
> {
  const result = await db.execute(sql`
    with source_chunks as (
      select ${itemEmbeddings.embedding} as embedding
      from ${itemEmbeddings}
      where ${itemEmbeddings.itemId} = ${sourceItemId}
      order by ${itemEmbeddings.chunkIndex} asc
      limit ${SEMANTIC_MAX_SOURCE_CHUNKS}
    )
    select
      c.${itemEmbeddings.itemId}::text as target_item_id,
      c.${itemEmbeddings.spaceId}::text as target_space_id,
      c.${itemEmbeddings.chunkText} as snippet,
      c.${itemEmbeddings.headingPath} as heading_path,
      (s.embedding <=> c.${itemEmbeddings.embedding})::float8 as distance
    from source_chunks s
    join lateral (
      select
        ${itemEmbeddings.itemId},
        ${itemEmbeddings.spaceId},
        ${itemEmbeddings.chunkText},
        ${itemEmbeddings.headingPath},
        ${itemEmbeddings.embedding}
      from ${itemEmbeddings} c
      inner join ${spaces} on ${spaces.id} = c.${itemEmbeddings.spaceId}
      where c.${itemEmbeddings.itemId} <> ${sourceItemId}
        and ${spaces.braneId} = ${braneId}
      order by s.embedding <=> c.${itemEmbeddings.embedding} asc
      limit ${SEMANTIC_PER_CHUNK_NEIGHBORS}
    ) c on true
    where (s.embedding <=> c.${itemEmbeddings.embedding}) <= ${SEMANTIC_MAX_DISTANCE}
    order by distance asc
    limit ${SEMANTIC_MAX_SOURCE_CHUNKS * SEMANTIC_PER_CHUNK_NEIGHBORS};
  `);
  const rows = (
    result as {
      rows?: Array<{
        target_item_id?: string;
        target_space_id?: string;
        distance?: number;
        snippet?: string;
        heading_path?: unknown;
      }>;
    }
  ).rows;
  if (!rows?.length) {
    return [];
  }
  const bestByTarget = new Map<
    string,
    {
      targetSpaceId: string;
      distance: number;
      snippet: string;
      headingPath: string | null;
    }
  >();
  for (const row of rows) {
    const targetItemId = String(row.target_item_id ?? "").trim();
    const targetSpaceId = String(row.target_space_id ?? "").trim();
    const snippet = String(row.snippet ?? "").trim();
    const distance = Number(row.distance);
    if (
      !(targetItemId && targetSpaceId && snippet && Number.isFinite(distance))
    ) {
      continue;
    }
    upsertBestSemanticMatch(bestByTarget, {
      distance,
      headingPath: row.heading_path,
      snippet,
      targetItemId,
      targetSpaceId,
    });
  }
  return [...bestByTarget.entries()]
    .sort((a, b) => a[1].distance - b[1].distance)
    .slice(0, SEMANTIC_MAX_TARGETS)
    .map(([targetItemId, data]) => ({
      distance: data.distance,
      headingPath: data.headingPath,
      snippet: data.snippet,
      targetItemId,
      targetSpaceId: data.targetSpaceId,
    }));
}

function mentionCountFromDistance(distance: number): number {
  const score = Math.round((1 - distance) * 100);
  return Math.max(1, Math.min(100, score));
}

/**
 * Options for {@link rescanItemEntityMentions} and the brane-wide rescan.
 *
 * REVIEW_2026-04-25_1730 H3: when we know which vocabulary terms changed
 * (e.g. only the renamed item's old + new title), pass them in so the rescan
 * only rebuilds term-mention rows for those terms and skips the expensive
 * semantic-neighbor pass. Cleanup of stale rows is also scoped to the same
 * term set so unrelated mentions are preserved.
 */
export interface EntityMentionRescanOptions {
  /**
   * Normalized (lowercased, trimmed) vocabulary terms whose mention rows may
   * have changed. When omitted, the rescan is full (term + semantic, cleanup
   * across all terms).
   */
  restrictToTerms?: readonly string[];
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: entity mention rescan walks term + semantic mention sets and reconciles deletes against the restricted-term scope
export async function rescanItemEntityMentions(
  db: VigilDb,
  itemId: string,
  options?: EntityMentionRescanOptions
): Promise<void> {
  const [row] = await db
    .select({
      braneId: spaces.braneId,
      id: items.id,
      searchBlob: items.searchBlob,
      spaceId: items.spaceId,
      title: items.title,
    })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(eq(items.id, itemId))
    .limit(1);
  if (!row?.braneId) {
    return;
  }
  const sourceBraneId = row.braneId;
  const sourceSpaceId = row.spaceId;

  const restrictToTerms =
    options?.restrictToTerms && options.restrictToTerms.length > 0
      ? new Set(options.restrictToTerms.map((t) => t.toLowerCase()))
      : null;

  const vocab = await buildEntityVocabularyForBrane(db, sourceBraneId);
  const blob = row.searchBlob ?? "";
  const previous = await db
    .select({
      id: entityMentions.id,
      matchedTerm: entityMentions.matchedTerm,
      sourceKind: entityMentions.sourceKind,
      sourceSpaceId: entityMentions.sourceSpaceId,
      targetItemId: entityMentions.targetItemId,
    })
    .from(entityMentions)
    .where(eq(entityMentions.sourceItemId, itemId));
  const nextKeys = new Set<string>();
  const touchedSpaceIds = new Set<string>([sourceSpaceId]);

  // REVIEW_2026-04-25_1835 M4: collect all upsert payloads first, then issue a
  // single `INSERT ... ON CONFLICT ... DO UPDATE` (and a single set-based
  // `DELETE`) at the end of the rescan. The previous per-row UPDATE/INSERT
  // pattern wrote N+1 statements per item × matched-term × target — at a
  // 1k-vocab brane that's thousands of round-trips per rescan.
  interface MentionUpsertRow {
    headingPath: string | null;
    matchedTerm: string;
    mentionCount: number;
    snippet: string | null;
    sourceKind: MentionSourceKind;
    targetItemId: string;
  }
  const pendingUpserts: MentionUpsertRow[] = [];

  const applyMentionRow = (args: {
    targetItemId: string;
    targetSpaceId: string;
    matchedTerm: string;
    sourceKind: MentionSourceKind;
    mentionCount: number;
    snippet: string | null;
    headingPath: string | null;
  }) => {
    const key = `${args.targetItemId}::${args.matchedTerm}::${args.sourceKind}`;
    nextKeys.add(key);
    touchedSpaceIds.add(args.targetSpaceId);
    pendingUpserts.push({
      headingPath: args.headingPath,
      matchedTerm: args.matchedTerm,
      mentionCount: args.mentionCount,
      snippet: args.snippet,
      sourceKind: args.sourceKind,
      targetItemId: args.targetItemId,
    });
  };

  // REVIEW_2026-04-25_1730 H3: precompute matched vocab entries and
  // batch-load all referenced target spaces in one query (was N+1: one
  // SELECT per target).
  interface MatchedTermEntry {
    count: number;
    itemIds: readonly string[];
    snippet: string | null;
    term: string;
  }
  const matchedTerms: MatchedTermEntry[] = [];
  const targetItemIds = new Set<string>();
  for (const entry of vocab.terms) {
    if (restrictToTerms && !restrictToTerms.has(entry.term)) {
      continue;
    }
    const count = countMatches(blob, entry.term);
    if (count < 1) {
      continue;
    }
    const snippet = makeSnippet(blob, entry.term);
    matchedTerms.push({
      count,
      itemIds: entry.itemIds,
      snippet,
      term: entry.term,
    });
    for (const targetItemId of entry.itemIds) {
      if (targetItemId !== itemId) {
        targetItemIds.add(targetItemId);
      }
    }
  }
  const targetSpaceById = new Map<string, string>();
  if (targetItemIds.size > 0) {
    const targetRows = await db
      .select({ id: items.id, spaceId: items.spaceId })
      .from(items)
      .where(inArray(items.id, [...targetItemIds]));
    for (const r of targetRows) {
      if (r.spaceId) {
        targetSpaceById.set(r.id, r.spaceId);
      }
    }
  }

  for (const matched of matchedTerms) {
    for (const targetItemId of matched.itemIds) {
      if (targetItemId === itemId) {
        continue;
      }
      const targetSpaceId = targetSpaceById.get(targetItemId);
      if (!targetSpaceId) {
        continue;
      }
      applyMentionRow({
        headingPath: null,
        matchedTerm: matched.term,
        mentionCount: matched.count,
        snippet: matched.snippet,
        sourceKind: "term",
        targetItemId,
        targetSpaceId,
      });
    }
  }

  // Semantic neighbors don't depend on title vocabulary; skip when the caller
  // restricted the rescan to a specific term set (rename-driven incremental
  // path). Full rescans still rebuild semantic mentions.
  if (!restrictToTerms) {
    const semanticNeighbors = await computeSemanticNeighborsForItem(
      db,
      itemId,
      sourceBraneId
    );
    for (const semantic of semanticNeighbors) {
      applyMentionRow({
        headingPath: semantic.headingPath,
        matchedTerm: SEMANTIC_MENTION_TOKEN,
        mentionCount: mentionCountFromDistance(semantic.distance),
        snippet: semantic.snippet,
        sourceKind: "semantic",
        targetItemId: semantic.targetItemId,
        targetSpaceId: semantic.targetSpaceId,
      });
    }
  }

  // REVIEW_2026-04-25_1835 M4: bulk upsert + bulk delete in one transaction.
  const idsToDelete: string[] = [];
  for (const prev of previous) {
    if (restrictToTerms) {
      if (prev.sourceKind === "semantic") {
        continue;
      }
      if (!restrictToTerms.has(prev.matchedTerm)) {
        continue;
      }
    }
    const key = `${prev.targetItemId}::${prev.matchedTerm}::${prev.sourceKind}`;
    if (nextKeys.has(key)) {
      continue;
    }
    idsToDelete.push(prev.id);
  }

  await db.transaction(async (tx) => {
    if (pendingUpserts.length > 0) {
      // Drizzle's `onConflictDoUpdate` with `excluded.*` to update mentionCount,
      // snippet, heading_path, source_space_id, updated_at in one shot.
      const now = new Date();
      const values = pendingUpserts.map((row) => ({
        braneId: sourceBraneId,
        createdAt: now,
        headingPath: row.headingPath,
        matchedTerm: row.matchedTerm,
        mentionCount: row.mentionCount,
        snippet: row.snippet,
        sourceItemId: itemId,
        sourceKind: row.sourceKind,
        sourceSpaceId,
        targetItemId: row.targetItemId,
        updatedAt: now,
      }));
      await tx
        .insert(entityMentions)
        .values(values)
        .onConflictDoUpdate({
          set: {
            headingPath: sql`excluded.heading_path`,
            mentionCount: sql`excluded.mention_count`,
            snippet: sql`excluded.snippet`,
            sourceSpaceId: sql`excluded.source_space_id`,
            updatedAt: sql`excluded.updated_at`,
          },
          target: [
            entityMentions.sourceItemId,
            entityMentions.targetItemId,
            entityMentions.matchedTerm,
            entityMentions.sourceKind,
          ],
        });
    }
    if (idsToDelete.length > 0) {
      await tx
        .delete(entityMentions)
        .where(inArray(entityMentions.id, idsToDelete));
    }
  });

  for (const spaceId of touchedSpaceIds) {
    invalidateItemLinksRevisionForSpace(spaceId);
  }
}

/**
 * Options that propagate to brane-wide rescan + per-item rescan calls.
 *
 * `affectedTerms` (when supplied) filters BOTH:
 *   - which items in the brane are candidates (only items whose `searchBlob`
 *     contains at least one of the affected terms), and
 *   - which vocab terms each item's rescan rebuilds (via `restrictToTerms`).
 *
 * REVIEW_2026-04-25_1730 H3: enables incremental "one title changed" rescans
 * instead of brane-wide N+1 rebuilds.
 */
export interface ScheduleBraneEntityMentionRescanOptions {
  affectedTerms?: readonly string[];
}

export function scheduleBraneEntityMentionRescanAfterResponse(
  db: VigilDb,
  braneId: string,
  options?: ScheduleBraneEntityMentionRescanOptions
): void {
  const affectedTerms =
    options?.affectedTerms && options.affectedTerms.length > 0
      ? Array.from(
          new Set(
            options.affectedTerms.map((t) => t.toLowerCase()).filter(Boolean)
          )
        )
      : null;
  after(async () => {
    let rows: Array<{ id: string }>;
    if (affectedTerms) {
      // ILIKE substring is intentionally permissive: a few extra rescans are
      // cheap, and the per-item rescan re-applies word-boundary matching
      // before writing rows.
      const blobMatchesAnyTerm = or(
        ...affectedTerms.map(
          (t) => sql`lower(${items.searchBlob}) ILIKE '%' || ${t} || '%'`
        )
      );
      rows = await db
        .select({ id: items.id })
        .from(items)
        .innerJoin(spaces, eq(spaces.id, items.spaceId))
        .where(and(eq(spaces.braneId, braneId), blobMatchesAnyTerm));
    } else {
      rows = await db
        .select({ id: items.id })
        .from(items)
        .innerJoin(spaces, eq(spaces.id, items.spaceId))
        .where(eq(spaces.braneId, braneId));
    }
    for (const row of rows) {
      await rescanItemEntityMentions(db, row.id, {
        restrictToTerms: affectedTerms ?? undefined,
      }).catch(() => {
        /* best effort */
      });
    }
  });
}

export function scheduleEntityMentionRescanOnVocabularyChange(
  db: VigilDb,
  braneId: string,
  options?: ScheduleBraneEntityMentionRescanOptions
): void {
  clearEntityVocabularyCache(braneId);
  scheduleBraneEntityMentionRescanAfterResponse(db, braneId, options);
}
