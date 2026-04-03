import { and, eq, inArray } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { itemLinks, items } from "@/src/db/schema";
import { assertSpaceExists } from "@/src/lib/spaces";

export type GraphNode = {
  id: string;
  title: string;
  itemType: string;
  entityType: string | null;
};

export type GraphEdge = { source: string; target: string };

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
  const { spaceId } = await context.params;
  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return Response.json(
      { ok: false, error: "Space not found", nodes: [], edges: [] },
      { status: 404 },
    );
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
      source: itemLinks.sourceItemId,
      target: itemLinks.targetItemId,
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
    source: l.source,
    target: l.target,
  }));

  return Response.json({ ok: true, nodes, edges });
}
