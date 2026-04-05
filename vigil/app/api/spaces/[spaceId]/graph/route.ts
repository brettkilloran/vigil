import { and, eq, inArray } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { itemLinks, items } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessSpaceId,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForVisitor,
  isHeartgardenVisitorBlocked,
  visitorMayAccessSpaceId,
} from "@/src/lib/heartgarden-api-boot-context";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";
import { parseSlackMultiplierFromLinkMeta } from "@/src/lib/item-link-meta";
import { assertSpaceExists } from "@/src/lib/spaces";

export async function GET(
  _req: Request,
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
  if (isHeartgardenVisitorBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { spaceId } = await context.params;
  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return heartgardenMaskNotFoundForVisitor(
      bootCtx,
      Response.json(
        { ok: false, error: "Space not found", nodes: [], edges: [] },
        { status: 404 },
      ),
    );
  }
  if (!visitorMayAccessSpaceId(bootCtx, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (bootCtx.role === "gm" && !gmMayAccessSpaceId(bootCtx, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      itemType: items.itemType,
      entityType: items.entityType,
    })
    .from(items)
    .where(eq(items.spaceId, spaceId));

  const idList = rows.map((r) => r.id);
  if (idList.length === 0) {
    return Response.json({
      ok: true,
      nodes: [] as GraphNode[],
      edges: [] as GraphEdge[],
    });
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

  return Response.json({ ok: true, nodes, edges });
}
