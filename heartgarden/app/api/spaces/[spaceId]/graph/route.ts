import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { itemLinks, items } from "@/src/db/schema";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";
import { getHeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { parseSlackMultiplierFromLinkMeta } from "@/src/lib/item-link-meta";
import { dedupeLogicalItemLinkRows } from "@/src/lib/item-links-logical-dedupe";
import { computeItemLinksRevisionForSpace } from "@/src/lib/item-links-space-revision";

export async function GET(
  req: Request,
  context: { params: Promise<{ spaceId: string }> }
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { edges: [], error: "Database not configured", nodes: [], ok: false },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) {
    return access.response;
  }

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const offset = Math.max(
    0,
    Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0
  );
  if (limitRaw == null && offset > 0) {
    return Response.json(
      {
        edges: [] as GraphEdge[],
        error: "offset requires limit",
        nodes: [] as GraphNode[],
        ok: false,
      },
      { status: 400 }
    );
  }

  const [totalRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(items)
    .where(eq(items.spaceId, spaceId));
  const totalNodes = totalRow?.c ?? 0;

  const itemLinksRevision = await computeItemLinksRevisionForSpace(db, spaceId);

  let rows;
  let pageLimit: number | undefined;
  if (limitRaw == null) {
    rows = await db
      .select({
        entityType: items.entityType,
        id: items.id,
        itemType: items.itemType,
        title: items.title,
      })
      .from(items)
      .where(eq(items.spaceId, spaceId))
      .orderBy(asc(items.zIndex), asc(items.createdAt));
  } else {
    pageLimit = Math.min(
      Math.max(1, Number.parseInt(limitRaw, 10) || 500),
      2000
    );
    rows = await db
      .select({
        entityType: items.entityType,
        id: items.id,
        itemType: items.itemType,
        title: items.title,
      })
      .from(items)
      .where(eq(items.spaceId, spaceId))
      .orderBy(asc(items.zIndex), asc(items.createdAt))
      .limit(pageLimit)
      .offset(offset);
  }

  const idList = rows.map((r) => r.id);
  if (idList.length === 0) {
    const emptyPayload: Record<string, unknown> = {
      edges: [] as GraphEdge[],
      itemLinksRevision,
      nodes: [] as GraphNode[],
      ok: true,
      total_nodes: totalNodes,
    };
    if (limitRaw != null && pageLimit != null) {
      emptyPayload.limit = pageLimit;
      emptyPayload.offset = offset;
      emptyPayload.note =
        "Edges only connect nodes on this page; cross-page links are omitted when limit is set.";
    }
    return Response.json(emptyPayload);
  }

  const linkRowsRaw = await db
    .select({
      color: itemLinks.color,
      id: itemLinks.id,
      linkType: itemLinks.linkType,
      meta: itemLinks.meta,
      source: itemLinks.sourceItemId,
      sourcePin: itemLinks.sourcePin,
      target: itemLinks.targetItemId,
      targetPin: itemLinks.targetPin,
      updatedAt: itemLinks.updatedAt,
    })
    .from(itemLinks)
    .where(
      and(
        or(
          inArray(itemLinks.sourceItemId, idList),
          inArray(itemLinks.targetItemId, idList)
        )
      )
    );

  const linkRows = dedupeLogicalItemLinkRows(
    linkRowsRaw.map((l) => ({
      color: l.color ?? null,
      id: l.id,
      linkType: l.linkType ?? null,
      meta: l.meta,
      source: l.source,
      sourcePin: l.sourcePin ?? null,
      target: l.target,
      targetPin: l.targetPin ?? null,
      updatedAtMs: l.updatedAt?.getTime() ?? 0,
    }))
  );

  const nodes: GraphNode[] = rows.map((r) => ({
    entityType: r.entityType ?? null,
    id: r.id,
    itemType: r.itemType,
    title: r.title || "Untitled",
  }));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const ghostIds = new Set<string>();
  for (const edge of linkRows) {
    if (!nodeIds.has(edge.source)) {
      ghostIds.add(edge.source);
    }
    if (!nodeIds.has(edge.target)) {
      ghostIds.add(edge.target);
    }
  }
  if (ghostIds.size > 0) {
    const ghostRows = await db
      .select({
        entityType: items.entityType,
        foreignSpaceId: items.spaceId,
        id: items.id,
        itemType: items.itemType,
        title: items.title,
      })
      .from(items)
      .where(inArray(items.id, [...ghostIds]));
    for (const ghost of ghostRows) {
      nodes.push({
        entityType: ghost.entityType ?? null,
        external: true,
        foreignSpaceId: ghost.foreignSpaceId,
        id: ghost.id,
        itemType: ghost.itemType,
        title: ghost.title || "Untitled",
      });
    }
  }

  const edges: GraphEdge[] = linkRows.map((l) => ({
    color: l.color ?? null,
    id: l.id,
    linkType: l.linkType ?? null,
    slackMultiplier: parseSlackMultiplierFromLinkMeta(l.meta),
    source: l.source,
    sourcePin: l.sourcePin ?? null,
    target: l.target,
    targetPin: l.targetPin ?? null,
  }));

  const payload: Record<string, unknown> = {
    edges,
    itemLinksRevision,
    nodes,
    ok: true,
    total_nodes: totalNodes,
  };
  if (limitRaw != null && pageLimit != null) {
    payload.limit = pageLimit;
    payload.offset = offset;
    payload.note =
      "Edges only connect nodes on this page; cross-page links are omitted when limit is set.";
  }
  return Response.json(payload);
}
