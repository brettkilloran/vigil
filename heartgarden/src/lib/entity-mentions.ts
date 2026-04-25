import { after } from "next/server";

import { eq, sql } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { entityMentions, itemEmbeddings, items, spaces } from "@/src/db/schema";
import { buildEntityVocabularyForBrane, clearEntityVocabularyCache } from "@/src/lib/entity-vocabulary";
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
  while (re.exec(text) !== null) count += 1;
  return count;
}

function makeSnippet(text: string, term: string): string | null {
  const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
  const m = re.exec(text);
  if (!m) return null;
  const idx = m.index;
  const start = Math.max(0, idx - 120);
  const end = Math.min(text.length, idx + term.length + 120);
  return text.slice(start, end).trim();
}

function parseHeadingPath(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof raw !== "string") return [];
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
  row: { targetItemId: string; targetSpaceId: string; distance: number; snippet: string; headingPath: unknown },
): void {
  const prev = bestByTarget.get(row.targetItemId);
  if (prev && prev.distance <= row.distance) return;
  const heading = parseHeadingPath(row.headingPath).join(" > ").trim();
  bestByTarget.set(row.targetItemId, {
    targetSpaceId: row.targetSpaceId,
    distance: row.distance,
    snippet: row.snippet,
    headingPath: heading || null,
  });
}

async function computeSemanticNeighborsForItem(
  db: VigilDb,
  sourceItemId: string,
  braneId: string,
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
  const rows = (result as {
    rows?: Array<{
      target_item_id?: string;
      target_space_id?: string;
      distance?: number;
      snippet?: string;
      heading_path?: unknown;
    }>;
  }).rows;
  if (!rows?.length) return [];
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
    if (!targetItemId || !targetSpaceId || !snippet || !Number.isFinite(distance)) continue;
    upsertBestSemanticMatch(bestByTarget, {
      targetItemId,
      targetSpaceId,
      distance,
      snippet,
      headingPath: row.heading_path,
    });
  }
  return [...bestByTarget.entries()]
    .sort((a, b) => a[1].distance - b[1].distance)
    .slice(0, SEMANTIC_MAX_TARGETS)
    .map(([targetItemId, data]) => ({
      targetItemId,
      targetSpaceId: data.targetSpaceId,
      distance: data.distance,
      snippet: data.snippet,
      headingPath: data.headingPath,
    }));
}

function mentionCountFromDistance(distance: number): number {
  const score = Math.round((1 - distance) * 100);
  return Math.max(1, Math.min(100, score));
}

export async function rescanItemEntityMentions(
  db: VigilDb,
  itemId: string,
): Promise<void> {
  const [row] = await db
    .select({
      id: items.id,
      title: items.title,
      searchBlob: items.searchBlob,
      spaceId: items.spaceId,
      braneId: spaces.braneId,
    })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(eq(items.id, itemId))
    .limit(1);
  if (!row?.braneId) return;
  const sourceBraneId = row.braneId;
  const sourceSpaceId = row.spaceId;

  const vocab = await buildEntityVocabularyForBrane(db, sourceBraneId);
  const blob = row.searchBlob ?? "";
  const previous = await db
    .select({
      id: entityMentions.id,
      targetItemId: entityMentions.targetItemId,
      matchedTerm: entityMentions.matchedTerm,
      sourceKind: entityMentions.sourceKind,
      sourceSpaceId: entityMentions.sourceSpaceId,
    })
    .from(entityMentions)
    .where(eq(entityMentions.sourceItemId, itemId));
  const previousKeyToId = new Map<string, string>(
    previous.map((p) => [`${p.targetItemId}::${p.matchedTerm}::${p.sourceKind}`, p.id]),
  );
  const nextKeys = new Set<string>();
  const touchedSpaceIds = new Set<string>([sourceSpaceId]);

  const applyMentionRow = async (args: {
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
    const existingId = previousKeyToId.get(key);
    if (existingId) {
      await db
        .update(entityMentions)
        .set({
          mentionCount: args.mentionCount,
          snippet: args.snippet ?? sql<string | null>`null`,
          headingPath: args.headingPath ?? sql<string | null>`null`,
          sourceSpaceId,
          updatedAt: new Date(),
        })
        .where(eq(entityMentions.id, existingId));
      return;
    }
    await db.insert(entityMentions).values({
      sourceItemId: itemId,
      targetItemId: args.targetItemId,
      matchedTerm: args.matchedTerm,
      mentionCount: args.mentionCount,
      braneId: sourceBraneId,
      sourceSpaceId,
      sourceKind: args.sourceKind,
      ...(args.snippet ? { snippet: args.snippet } : {}),
      ...(args.headingPath ? { headingPath: args.headingPath } : {}),
    });
  };

  for (const entry of vocab.terms) {
    const count = countMatches(blob, entry.term);
    if (count < 1) continue;
    const snippet = makeSnippet(blob, entry.term);
    for (const targetItemId of entry.itemIds) {
      if (targetItemId === itemId) continue;
      const [targetSpace] = await db
        .select({ spaceId: items.spaceId })
        .from(items)
        .where(eq(items.id, targetItemId))
        .limit(1);
      if (!targetSpace?.spaceId) continue;
      await applyMentionRow({
        targetItemId,
        targetSpaceId: targetSpace.spaceId,
        matchedTerm: entry.term,
        sourceKind: "term",
        mentionCount: count,
        snippet,
        headingPath: null,
      });
    }
  }

  const semanticNeighbors = await computeSemanticNeighborsForItem(db, itemId, sourceBraneId);
  for (const semantic of semanticNeighbors) {
    await applyMentionRow({
      targetItemId: semantic.targetItemId,
      targetSpaceId: semantic.targetSpaceId,
      matchedTerm: SEMANTIC_MENTION_TOKEN,
      sourceKind: "semantic",
      mentionCount: mentionCountFromDistance(semantic.distance),
      snippet: semantic.snippet,
      headingPath: semantic.headingPath,
    });
  }

  for (const prev of previous) {
    const key = `${prev.targetItemId}::${prev.matchedTerm}::${prev.sourceKind}`;
    if (nextKeys.has(key)) continue;
    await db.delete(entityMentions).where(eq(entityMentions.id, prev.id));
  }

  for (const spaceId of touchedSpaceIds) {
    invalidateItemLinksRevisionForSpace(spaceId);
  }
}

export function scheduleBraneEntityMentionRescanAfterResponse(
  db: VigilDb,
  braneId: string,
): void {
  after(async () => {
    const rows = await db
      .select({ id: items.id })
      .from(items)
      .innerJoin(spaces, eq(spaces.id, items.spaceId))
      .where(eq(spaces.braneId, braneId));
    for (const row of rows) {
      await rescanItemEntityMentions(db, row.id).catch(() => {
        /* best effort */
      });
    }
  });
}

export function scheduleEntityMentionRescanOnVocabularyChange(
  db: VigilDb,
  braneId: string,
): void {
  clearEntityVocabularyCache(braneId);
  scheduleBraneEntityMentionRescanAfterResponse(db, braneId);
}
