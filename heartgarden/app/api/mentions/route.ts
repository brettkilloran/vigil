import { and, desc, eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { entityMentions, items } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayReadBraneIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { parseSpaceIdParam } from "@/src/lib/space-id";

export const runtime = "nodejs";

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
  const term = url.searchParams.get("term")?.trim().toLowerCase();
  const braneId = parseSpaceIdParam(url.searchParams.get("braneId"));
  if (!term || term.length < 2) {
    return Response.json(
      { error: "term is required (min 2 chars)", ok: false },
      { status: 400 }
    );
  }
  if (!braneId) {
    return Response.json(
      { error: "Valid braneId is required", ok: false },
      { status: 400 }
    );
  }
  if (!(await gmMayReadBraneIdAsync(db, bootCtx, braneId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const rows = await db
    .select({
      id: entityMentions.id,
      itemId: entityMentions.sourceItemId,
      matchedTerm: entityMentions.matchedTerm,
      mentionCount: entityMentions.mentionCount,
      snippet: entityMentions.snippet,
      sourceSpaceId: entityMentions.sourceSpaceId,
      title: items.title,
    })
    .from(entityMentions)
    .innerJoin(items, eq(items.id, entityMentions.sourceItemId))
    .where(
      and(
        eq(entityMentions.braneId, braneId),
        eq(entityMentions.sourceKind, "term"),
        eq(entityMentions.matchedTerm, term)
      )
    )
    .orderBy(desc(entityMentions.mentionCount), desc(entityMentions.updatedAt))
    .limit(200);

  return Response.json({ items: rows, ok: true });
}
