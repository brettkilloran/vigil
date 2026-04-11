import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { itemLinks, items } from "@/src/db/schema";
import { getHeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";
import { parseSlackMultiplierFromLinkMeta } from "@/src/lib/item-link-meta";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";

export async function GET(
  req: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured", nodes: [], edges: [] },
      { status: 503 },
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) return access.response;

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  if (limitRaw == null && offset > 0) {
    return Response.json(
      {
        ok: false,
        error: "offset requires limit",
        nodes: [] as GraphNode[],
        edges: [] as GraphEdge[],
      },
      { status: 400 },
    );
  }

  const [totalRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(items)
    .where(eq(items.spaceId, spaceId));
  const totalNodes = totalRow?.c ?? 0;

  let rows;
  let pageLimit: number | undefined;
  if (limitRaw == null) {
    rows = await db
      .select({
        id: items.id,
        title: items.title,
        itemType: items.itemType,
        entityType: items.entityType,
      })
      .from(items)
      .where(eq(items.spaceId, spaceId))
      .orderBy(asc(items.zIndex), asc(items.createdAt));
  } else {
    pageLimit = Math.min(Math.max(1, parseInt(limitRaw, 10) || 500), 2000);
    rows = await db
      .select({
        id: items.id,
        title: items.title,
        itemType: items.itemType,
        entityType: items.entityType,
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
      ok: true,
      nodes: [] as GraphNode[],
      edges: [] as GraphEdge[],
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

  const linkRows = await db
    .select({
      id: itemLinks.id,
      source: itemLinks.sourceItemId,
      target: itemLinks.targetItemId,
      color: itemLinks.color,
      sourcePin: itemLinks.sourcePin,
      targetPin: itemLinks.targetPin,
      linkType: itemLinks.linkType,
      meta: itemLinks.meta,
    })
    .from(itemLinks)
    .where(
      and(
        inArray(itemLinks.sourceItemId, idList),
        inArray(itemLinks.targetItemId, idList),
      ),
    );

  const nodes: GraphNode[] = rows.map((r) => ({
    id: r.id,
    title: r.title || "Untitled",
    itemType: r.itemType,
    entityType: r.entityType ?? null,
  }));

  const edges: GraphEdge[] = linkRows.map((l) => ({
    id: l.id,
    source: l.source,
    target: l.target,
    color: l.color ?? null,
    sourcePin: l.sourcePin ?? null,
    targetPin: l.targetPin ?? null,
    linkType: l.linkType ?? null,
    slackMultiplier: parseSlackMultiplierFromLinkMeta(l.meta),
  }));

  const payload: Record<string, unknown> = {
    ok: true,
    nodes,
    edges,
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
