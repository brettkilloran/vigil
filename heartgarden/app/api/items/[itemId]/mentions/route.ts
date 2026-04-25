import { and, eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { entityMentions, items } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";
import { parseSpaceIdParam } from "@/src/lib/space-id";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  const { itemId: rawItemId } = await context.params;
  const itemId = parseSpaceIdParam(rawItemId);
  if (!itemId) {
    return Response.json({ ok: false, error: "Invalid item id" }, { status: 400 });
  }

  const [itemRow] = await db.select({ id: items.id }).from(items).where(eq(items.id, itemId)).limit(1);
  if (!itemRow) {
    return Response.json({ ok: false, error: "Item not found" }, { status: 404 });
  }

  const [mentionsRows, mentionedByRows] = await Promise.all([
    db
      .select({
        id: entityMentions.id,
        itemId: entityMentions.targetItemId,
        title: items.title,
        matchedTerm: entityMentions.matchedTerm,
        mentionCount: entityMentions.mentionCount,
        snippet: entityMentions.snippet,
        sourceSpaceId: entityMentions.sourceSpaceId,
      })
      .from(entityMentions)
      .innerJoin(items, eq(items.id, entityMentions.targetItemId))
      .where(and(eq(entityMentions.sourceItemId, itemId), eq(entityMentions.sourceKind, "term"))),
    db
      .select({
        id: entityMentions.id,
        itemId: entityMentions.sourceItemId,
        title: items.title,
        matchedTerm: entityMentions.matchedTerm,
        mentionCount: entityMentions.mentionCount,
        snippet: entityMentions.snippet,
        sourceSpaceId: entityMentions.sourceSpaceId,
      })
      .from(entityMentions)
      .innerJoin(items, eq(items.id, entityMentions.sourceItemId))
      .where(and(eq(entityMentions.targetItemId, itemId), eq(entityMentions.sourceKind, "term"))),
  ]);

  return Response.json({
    ok: true,
    mentions: mentionsRows,
    mentionedBy: mentionedByRows,
  });
}
