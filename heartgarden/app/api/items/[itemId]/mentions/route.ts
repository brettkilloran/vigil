import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { entityMentions, items } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessItemSpaceAsync,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForPlayer,
} from "@/src/lib/heartgarden-api-boot-context";
import { parseSpaceIdParam } from "@/src/lib/space-id";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ itemId: string }> }
) {
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

  const { itemId: rawItemId } = await context.params;
  const itemId = parseSpaceIdParam(rawItemId);
  if (!itemId) {
    return Response.json(
      { error: "Invalid item id", ok: false },
      { status: 400 }
    );
  }

  const [itemRow] = await db
    .select({ id: items.id, spaceId: items.spaceId })
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);
  if (!itemRow) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ error: "Item not found", ok: false }, { status: 404 })
    );
  }
  if (!(await gmMayAccessItemSpaceAsync(db, bootCtx, itemRow.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const [mentionsRows, mentionedByRows] = await Promise.all([
    db
      .select({
        headingPath: entityMentions.headingPath,
        id: entityMentions.id,
        itemId: entityMentions.targetItemId,
        matchedTerm: entityMentions.matchedTerm,
        mentionCount: entityMentions.mentionCount,
        snippet: entityMentions.snippet,
        sourceKind: entityMentions.sourceKind,
        sourceSpaceId: entityMentions.sourceSpaceId,
        title: items.title,
      })
      .from(entityMentions)
      .innerJoin(items, eq(items.id, entityMentions.targetItemId))
      .where(eq(entityMentions.sourceItemId, itemId)),
    db
      .select({
        headingPath: entityMentions.headingPath,
        id: entityMentions.id,
        itemId: entityMentions.sourceItemId,
        matchedTerm: entityMentions.matchedTerm,
        mentionCount: entityMentions.mentionCount,
        snippet: entityMentions.snippet,
        sourceKind: entityMentions.sourceKind,
        sourceSpaceId: entityMentions.sourceSpaceId,
        title: items.title,
      })
      .from(entityMentions)
      .innerJoin(items, eq(items.id, entityMentions.sourceItemId))
      .where(eq(entityMentions.targetItemId, itemId)),
  ]);

  return Response.json({
    mentionedBy: mentionedByRows,
    mentions: mentionsRows,
    ok: true,
  });
}
