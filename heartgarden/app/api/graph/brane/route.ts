import { createHash } from "node:crypto";

import { and, eq, inArray, or, sql } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { entityMentions, itemLinks, items, spaces } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayReadBraneIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { parseSpaceIdParam } from "@/src/lib/space-id";

export const runtime = "nodejs";

/**
 * REVIEW_2026-04-25_1730 H4: scalability rework for /api/graph/brane.
 *
 * Old contract returned every node and every explicit/implicit edge in the
 * brane on every call. At thousands of items and tens of thousands of
 * mentions that locks the worker AND the browser tab.
 *
 * New contract is neighborhood-first with a hard cap and a brane-revision
 * ETag:
 *
 *  - `seedItemId=<uuid>&maxDepth=1|2&limit=N`  — BFS from a seed up to
 *    `maxDepth` hops, capped at `limit` nodes (default 250, max 2000).
 *    Returns `truncated:true` and `frontierTruncated:true` when caps fire.
 *    This is the default exploration mode and the only way to look at large
 *    branes interactively.
 *
 *  - `mode=full&limit=N`  — legacy whole-brane fetch, still capped to
 *    `limit` (default 250, max 2000) with `truncated:true` when more
 *    exist. Intended for small workspaces or programmatic dumps.
 *
 *  - `If-None-Match` is honored against a per-brane revision ETag so an
 *    unchanged brane returns `304` cheaply on repeated polls.
 */

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 2000;
const MAX_DEPTH = 2;

interface BraneGraphNode {
  depth: number;
  entityType: string | null;
  id: string;
  itemType: string;
  spaceId: string;
  title: string;
}

interface BraneGraphEdge {
  color: string | null;
  edgeKind: "explicit" | "implicit";
  id: string;
  linkType: string | null;
  matchedTerm: string | null;
  source: string;
  sourcePin: string | null;
  target: string;
  targetPin: string | null;
}

function clampInt(
  raw: string | null,
  fallback: number,
  max: number,
  min = 1
): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

async function fetchBraneRevision(
  db: VigilDb,
  braneId: string
): Promise<string> {
  const result = await db.execute(sql`
    WITH brane_spaces AS (
      SELECT ${spaces.id} AS id
      FROM ${spaces}
      WHERE ${spaces.braneId} = ${braneId}
    )
    SELECT
      (SELECT EXTRACT(EPOCH FROM COALESCE(MAX(${items.updatedAt}), TIMESTAMP 'epoch'))::bigint
         FROM ${items}
         WHERE ${items.spaceId} IN (SELECT id FROM brane_spaces)) AS items_max,
      (SELECT COUNT(*)::int
         FROM ${items}
         WHERE ${items.spaceId} IN (SELECT id FROM brane_spaces)) AS items_count,
      (SELECT EXTRACT(EPOCH FROM COALESCE(MAX(${itemLinks.updatedAt}), TIMESTAMP 'epoch'))::bigint
         FROM ${itemLinks}
         INNER JOIN ${items} ON ${items.id} = ${itemLinks.sourceItemId}
         WHERE ${items.spaceId} IN (SELECT id FROM brane_spaces)) AS links_max,
      (SELECT EXTRACT(EPOCH FROM COALESCE(MAX(${entityMentions.updatedAt}), TIMESTAMP 'epoch'))::bigint
         FROM ${entityMentions}
         WHERE ${entityMentions.braneId} = ${braneId}) AS mentions_max
  `);
  const row =
    ((result as unknown as { rows?: Record<string, unknown>[] }).rows ??
      [])[0] ?? {};
  const token = [
    String(row.items_max ?? 0),
    String(row.items_count ?? 0),
    String(row.links_max ?? 0),
    String(row.mentions_max ?? 0),
  ].join(":");
  return token;
}

function buildEtag(
  braneId: string,
  revisionToken: string,
  params: Record<string, unknown>
): string {
  const digest = createHash("sha256")
    .update(`${braneId}|${revisionToken}|${JSON.stringify(params)}`)
    .digest("hex")
    .slice(0, 24);
  return `W/"brane-${digest}"`;
}

async function loadNodesByIds(
  db: VigilDb,
  ids: string[],
  depthByItemId: Map<string, number>,
  braneId: string
): Promise<BraneGraphNode[]> {
  if (ids.length === 0) {
    return [];
  }
  const rows = await db
    .select({
      braneId: spaces.braneId,
      entityType: items.entityType,
      id: items.id,
      itemType: items.itemType,
      spaceId: items.spaceId,
      title: items.title,
    })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(and(inArray(items.id, ids), eq(spaces.braneId, braneId)));
  return rows.map((r) => ({
    depth: depthByItemId.get(r.id) ?? 0,
    entityType: r.entityType,
    id: r.id,
    itemType: r.itemType,
    spaceId: r.spaceId,
    title: r.title,
  }));
}

async function expandFrontier(
  db: VigilDb,
  frontierIds: string[],
  braneId: string
): Promise<{
  explicit: BraneGraphEdge[];
  implicit: BraneGraphEdge[];
  neighborIds: Set<string>;
}> {
  const explicit: BraneGraphEdge[] = [];
  const implicit: BraneGraphEdge[] = [];
  const neighborIds = new Set<string>();
  if (frontierIds.length === 0) {
    return { explicit, implicit, neighborIds };
  }

  const explicitRows = await db
    .select({
      color: itemLinks.color,
      id: itemLinks.id,
      linkType: itemLinks.linkType,
      source: itemLinks.sourceItemId,
      sourcePin: itemLinks.sourcePin,
      target: itemLinks.targetItemId,
      targetPin: itemLinks.targetPin,
    })
    .from(itemLinks)
    .where(
      or(
        inArray(itemLinks.sourceItemId, frontierIds),
        inArray(itemLinks.targetItemId, frontierIds)
      )
    );
  for (const r of explicitRows) {
    explicit.push({
      color: r.color,
      edgeKind: "explicit",
      id: r.id,
      linkType: r.linkType,
      matchedTerm: null,
      source: r.source,
      sourcePin: r.sourcePin,
      target: r.target,
      targetPin: r.targetPin,
    });
    neighborIds.add(r.source);
    neighborIds.add(r.target);
  }

  const implicitRows = await db
    .select({
      id: entityMentions.id,
      matchedTerm: entityMentions.matchedTerm,
      source: entityMentions.sourceItemId,
      target: entityMentions.targetItemId,
    })
    .from(entityMentions)
    .where(
      and(
        eq(entityMentions.braneId, braneId),
        or(
          inArray(entityMentions.sourceItemId, frontierIds),
          inArray(entityMentions.targetItemId, frontierIds)
        )
      )
    );
  for (const r of implicitRows) {
    implicit.push({
      color: null,
      edgeKind: "implicit",
      id: r.id,
      linkType: null,
      matchedTerm: r.matchedTerm,
      source: r.source,
      sourcePin: null,
      target: r.target,
      targetPin: null,
    });
    neighborIds.add(r.source);
    neighborIds.add(r.target);
  }

  return { explicit, implicit, neighborIds };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: GET dispatches across full/neighborhood modes plus auth, ETag/304, and BFS traversal — splitting helpers would only relocate complexity
export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) {
    return denied;
  }

  const url = new URL(req.url);
  const braneId = parseSpaceIdParam(url.searchParams.get("braneId"));
  if (!braneId) {
    return Response.json(
      { error: "Valid braneId is required", ok: false },
      { status: 400 }
    );
  }
  if (!(await gmMayReadBraneIdAsync(db, bootCtx, braneId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const seedItemId = parseSpaceIdParam(url.searchParams.get("seedItemId"));
  const modeRaw = url.searchParams.get("mode");
  const mode: "full" | "neighborhood" =
    modeRaw === "full" ? "full" : "neighborhood";
  const limit = clampInt(
    url.searchParams.get("limit"),
    DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const maxDepth = clampInt(url.searchParams.get("maxDepth"), 1, MAX_DEPTH);

  if (mode === "neighborhood" && !seedItemId) {
    return Response.json(
      {
        error:
          "seedItemId is required for neighborhood mode (or pass mode=full to load the whole brane up to limit).",
        ok: false,
      },
      { status: 400 }
    );
  }

  const revisionToken = await fetchBraneRevision(db, braneId);
  const etag = buildEtag(braneId, revisionToken, {
    limit,
    maxDepth,
    mode,
    seedItemId,
  });
  const ifNoneMatch = req.headers.get("if-none-match")?.trim();
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      headers: { "Cache-Control": "private, max-age=15", ETag: etag },
      status: 304,
    });
  }

  if (mode === "full") {
    // Whole-brane mode, bounded by `limit`. Sorted by recent updates so the
    // truncated slice is the freshest part of the brane.
    const allNodes = await db
      .select({
        entityType: items.entityType,
        id: items.id,
        itemType: items.itemType,
        spaceId: items.spaceId,
        title: items.title,
      })
      .from(items)
      .innerJoin(spaces, eq(spaces.id, items.spaceId))
      .where(eq(spaces.braneId, braneId))
      .orderBy(sql`${items.updatedAt} DESC`)
      .limit(limit + 1);
    const truncated = allNodes.length > limit;
    const nodesSlice = truncated ? allNodes.slice(0, limit) : allNodes;
    const nodeIds = nodesSlice.map((n) => n.id);
    if (nodeIds.length === 0) {
      return Response.json(
        {
          edges: [],
          mode,
          nodes: [],
          ok: true,
          totals: { edges: 0, nodes: 0 },
          truncated: false,
        },
        { headers: { "Cache-Control": "private, max-age=15", ETag: etag } }
      );
    }

    const [explicitEdges, implicitEdges] = await Promise.all([
      db
        .select({
          color: itemLinks.color,
          id: itemLinks.id,
          linkType: itemLinks.linkType,
          source: itemLinks.sourceItemId,
          sourcePin: itemLinks.sourcePin,
          target: itemLinks.targetItemId,
          targetPin: itemLinks.targetPin,
        })
        .from(itemLinks)
        .where(
          and(
            inArray(itemLinks.sourceItemId, nodeIds),
            inArray(itemLinks.targetItemId, nodeIds)
          )
        ),
      db
        .select({
          id: entityMentions.id,
          matchedTerm: entityMentions.matchedTerm,
          source: entityMentions.sourceItemId,
          target: entityMentions.targetItemId,
        })
        .from(entityMentions)
        .where(
          and(
            eq(entityMentions.braneId, braneId),
            inArray(entityMentions.sourceItemId, nodeIds),
            inArray(entityMentions.targetItemId, nodeIds)
          )
        ),
    ]);

    const edges: BraneGraphEdge[] = [
      ...explicitEdges.map((r) => ({
        color: r.color,
        edgeKind: "explicit" as const,
        id: r.id,
        linkType: r.linkType,
        matchedTerm: null,
        source: r.source,
        sourcePin: r.sourcePin,
        target: r.target,
        targetPin: r.targetPin,
      })),
      ...implicitEdges.map((r) => ({
        color: null,
        edgeKind: "implicit" as const,
        id: r.id,
        linkType: null,
        matchedTerm: r.matchedTerm,
        source: r.source,
        sourcePin: null,
        target: r.target,
        targetPin: null,
      })),
    ];

    return Response.json(
      {
        edges,
        limit,
        mode,
        nodes: nodesSlice.map((n) => ({ ...n, depth: 0 })),
        ok: true,
        totals: { edges: edges.length, nodes: nodesSlice.length },
        truncated,
      },
      { headers: { "Cache-Control": "private, max-age=15", ETag: etag } }
    );
  }

  // Neighborhood mode: BFS from `seedItemId` up to `maxDepth` hops, capped at
  // `limit` nodes total. Frontier truncation is reported separately so the UI
  // can prompt for "load more depth" or "raise limit".
  const seedRow = await db
    .select({
      braneId: spaces.braneId,
      id: items.id,
      spaceId: items.spaceId,
    })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(eq(items.id, seedItemId!))
    .limit(1)
    .then((rows) => rows[0]);
  if (!seedRow || seedRow.braneId !== braneId) {
    return Response.json(
      { error: "seedItemId is not in this brane", ok: false },
      { status: 404 }
    );
  }

  const visitedIds = new Set<string>([seedItemId!]);
  const depthByItemId = new Map<string, number>([[seedItemId!, 0]]);
  const collectedEdges = new Map<string, BraneGraphEdge>();
  let frontier: string[] = [seedItemId!];
  let frontierTruncated = false;
  let visitedTruncated = false;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (frontier.length === 0) {
      break;
    }
    const { explicit, implicit, neighborIds } = await expandFrontier(
      db,
      frontier,
      braneId
    );
    for (const e of [...explicit, ...implicit]) {
      // Edges referencing items outside the brane (legacy data) are dropped:
      // BFS only descends through items in `braneId`.
      collectedEdges.set(e.id, e);
    }
    const nextFrontier: string[] = [];
    for (const id of neighborIds) {
      if (visitedIds.has(id)) {
        continue;
      }
      if (visitedIds.size >= limit) {
        visitedTruncated = true;
        break;
      }
      visitedIds.add(id);
      depthByItemId.set(id, depth + 1);
      nextFrontier.push(id);
    }
    if (visitedIds.size >= limit && neighborIds.size > nextFrontier.length) {
      frontierTruncated = true;
    }
    frontier = nextFrontier;
  }

  const nodes = await loadNodesByIds(
    db,
    [...visitedIds],
    depthByItemId,
    braneId
  );
  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const finalEdges = [...collectedEdges.values()].filter(
    (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
  );

  return Response.json(
    {
      edges: finalEdges,
      frontierTruncated,
      limit,
      maxDepth,
      mode,
      nodes,
      ok: true,
      seedItemId,
      totals: { edges: finalEdges.length, nodes: nodes.length },
      truncated: visitedTruncated || frontierTruncated,
    },
    { headers: { "Cache-Control": "private, max-age=15", ETag: etag } }
  );
}
