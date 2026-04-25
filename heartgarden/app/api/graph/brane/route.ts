import { and, eq, inArray, or, sql } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { entityMentions, itemLinks, items, spaces } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";
import { parseSpaceIdParam } from "@/src/lib/space-id";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  const url = new URL(req.url);
  const braneId = parseSpaceIdParam(url.searchParams.get("braneId"));
  if (!braneId) {
    return Response.json({ ok: false, error: "Valid braneId is required" }, { status: 400 });
  }

  const nodes = await db
    .select({
      id: items.id,
      title: items.title,
      itemType: items.itemType,
      entityType: items.entityType,
      spaceId: items.spaceId,
    })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(eq(spaces.braneId, braneId));
  const nodeIds = nodes.map((n) => n.id);
  if (nodeIds.length === 0) {
    return Response.json({ ok: true, nodes: [], edges: [] });
  }

  const explicitEdges = await db
    .select({
      id: itemLinks.id,
      source: itemLinks.sourceItemId,
      target: itemLinks.targetItemId,
      linkType: itemLinks.linkType,
      sourcePin: itemLinks.sourcePin,
      targetPin: itemLinks.targetPin,
      color: itemLinks.color,
      edgeKind: sql<"explicit">`'explicit'`,
      matchedTerm: sql<string | null>`null`,
    })
    .from(itemLinks)
    .where(and(inArray(itemLinks.sourceItemId, nodeIds), inArray(itemLinks.targetItemId, nodeIds)));
  const implicitEdges = await db
    .select({
      id: entityMentions.id,
      source: entityMentions.sourceItemId,
      target: entityMentions.targetItemId,
      linkType: sql<string | null>`null`,
      sourcePin: sql<string | null>`null`,
      targetPin: sql<string | null>`null`,
      color: sql<string | null>`null`,
      edgeKind: sql<"implicit">`'implicit'`,
      matchedTerm: entityMentions.matchedTerm,
    })
    .from(entityMentions)
    .where(
      and(
        eq(entityMentions.braneId, braneId),
        or(inArray(entityMentions.sourceItemId, nodeIds), inArray(entityMentions.targetItemId, nodeIds)),
      ),
    );

  return Response.json({
    ok: true,
    nodes,
    edges: [...explicitEdges, ...implicitEdges],
  });
}
