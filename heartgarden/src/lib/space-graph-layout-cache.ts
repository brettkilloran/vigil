import { and, desc, eq, inArray } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { spaceGraphLayoutCache } from "@/src/db/schema";
import type { GraphLayoutPositions } from "@/src/lib/graph-layout-cache-contract";
import {
  GRAPH_LAYOUT_CACHE_LAYOUT_VERSION,
  sanitizeGraphLayoutPositions,
} from "@/src/lib/graph-layout-cache-contract";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

const SPACE_GRAPH_LAYOUT_CACHE_KEEP_PER_SPACE = 8;

export type SpaceGraphLayoutCacheRecord = {
  graphRevision: string;
  layoutVersion: string;
  positions: GraphLayoutPositions;
  nodeCount: number;
  savedAt: Date;
  updatedAt: Date;
};

export async function readSpaceGraphLayoutCache(
  db: VigilDb,
  spaceId: string,
  graphRevision: string,
  layoutVersion = GRAPH_LAYOUT_CACHE_LAYOUT_VERSION,
): Promise<SpaceGraphLayoutCacheRecord | null> {
  const [row] = await db
    .select({
      graphRevision: spaceGraphLayoutCache.graphRevision,
      layoutVersion: spaceGraphLayoutCache.layoutVersion,
      positions: spaceGraphLayoutCache.positions,
      nodeCount: spaceGraphLayoutCache.nodeCount,
      savedAt: spaceGraphLayoutCache.savedAt,
      updatedAt: spaceGraphLayoutCache.updatedAt,
    })
    .from(spaceGraphLayoutCache)
    .where(
      and(
        eq(spaceGraphLayoutCache.spaceId, spaceId),
        eq(spaceGraphLayoutCache.graphRevision, graphRevision),
        eq(spaceGraphLayoutCache.layoutVersion, layoutVersion),
      ),
    )
    .limit(1);
  if (!row) return null;
  const sanitized = sanitizeGraphLayoutPositions(row.positions);
  if (!sanitized) return null;
  return {
    graphRevision: row.graphRevision,
    layoutVersion: row.layoutVersion,
    positions: sanitized,
    nodeCount: row.nodeCount,
    savedAt: row.savedAt,
    updatedAt: row.updatedAt,
  };
}

export async function writeSpaceGraphLayoutCache(
  db: VigilDb,
  {
    spaceId,
    graphRevision,
    layoutVersion = GRAPH_LAYOUT_CACHE_LAYOUT_VERSION,
    positions,
    nodeCount,
  }: {
    spaceId: string;
    graphRevision: string;
    layoutVersion?: string;
    positions: GraphLayoutPositions;
    nodeCount: number;
  },
): Promise<void> {
  const now = new Date();
  await db
    .insert(spaceGraphLayoutCache)
    .values({
      spaceId,
      graphRevision,
      layoutVersion,
      positions,
      nodeCount,
      savedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        spaceGraphLayoutCache.spaceId,
        spaceGraphLayoutCache.graphRevision,
        spaceGraphLayoutCache.layoutVersion,
      ],
      set: {
        positions,
        nodeCount,
        savedAt: now,
        updatedAt: now,
      },
    });

  const staleRows = await db
    .select({ id: spaceGraphLayoutCache.id })
    .from(spaceGraphLayoutCache)
    .where(eq(spaceGraphLayoutCache.spaceId, spaceId))
    .orderBy(desc(spaceGraphLayoutCache.savedAt))
    .offset(SPACE_GRAPH_LAYOUT_CACHE_KEEP_PER_SPACE);
  const staleIds = staleRows.map((row) => row.id);
  if (staleIds.length === 0) return;
  await db.delete(spaceGraphLayoutCache).where(inArray(spaceGraphLayoutCache.id, staleIds));
}
