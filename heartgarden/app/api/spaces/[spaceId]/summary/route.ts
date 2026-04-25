import { and, eq, inArray, sql } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { itemLinks, items } from "@/src/db/schema";
import { getHeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";

export async function GET(
  _req: Request,
  context: { params: Promise<{ spaceId: string }> }
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) {
    return access.response;
  }
  const space = access.space;

  const [itemRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(items)
    .where(eq(items.spaceId, spaceId));

  const idList = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.spaceId, spaceId));
  const ids = idList.map((r) => r.id);

  let linkCount = 0;
  if (ids.length > 0) {
    const [linkRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(itemLinks)
      .where(
        and(
          inArray(itemLinks.sourceItemId, ids),
          inArray(itemLinks.targetItemId, ids)
        )
      );
    linkCount = linkRow?.c ?? 0;
  }

  return Response.json({
    counts: {
      itemLinksInSpace: linkCount,
      items: itemRow?.c ?? 0,
    },
    ok: true,
    space: {
      id: space.id,
      name: space.name,
      parentSpaceId: space.parentSpaceId,
    },
  });
}
