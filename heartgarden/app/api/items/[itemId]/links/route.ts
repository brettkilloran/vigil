import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessItemSpaceAsync,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForPlayer,
  isHeartgardenPlayerBlocked,
  playerMayAccessItemSpaceAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { getItemLinksResolved } from "@/src/lib/spaces";

export async function GET(
  _req: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      {
        error: "Database not configured",
        incoming: [],
        ok: false,
        outgoing: [],
      },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { itemId } = await context.params;
  const [row] = await db
    .select()
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);
  if (!row) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ error: "Not found", ok: false }, { status: 404 })
    );
  }
  if (!(await playerMayAccessItemSpaceAsync(db, bootCtx, row.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (!(await gmMayAccessItemSpaceAsync(db, bootCtx, row.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { outgoing, incoming } = await getItemLinksResolved(db, itemId);
  return Response.json({ incoming, ok: true, outgoing });
}
