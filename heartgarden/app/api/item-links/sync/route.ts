import { and, eq, notInArray } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { itemLinks, items } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessItemSpaceAsync,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForPlayer,
  isHeartgardenPlayerBlocked,
  playerMayAccessItemSpaceAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { validateLinkTargetsInSourceSpace } from "@/src/lib/item-links-validation";

const bodySchema = z.object({
  sourceItemId: z.string().uuid(),
  targetIds: z.array(z.string().uuid()),
});

/**
 * Batch writer for keeping a source item's outgoing links in sync.
 * Kept for external/script clients; app UI writes per-link via `/api/item-links`.
 */
export async function POST(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { sourceItemId, targetIds } = parsed.data;
  const [srcItem] = await db.select({ spaceId: items.spaceId }).from(items).where(eq(items.id, sourceItemId)).limit(1);
  if (!srcItem) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ ok: false, error: "Source item not found" }, { status: 404 }),
    );
  }
  if (!(await playerMayAccessItemSpaceAsync(db, bootCtx, srcItem.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (!(await gmMayAccessItemSpaceAsync(db, bootCtx, srcItem.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const validated = await validateLinkTargetsInSourceSpace(db, sourceItemId, targetIds);
  if (!validated.ok) {
    return Response.json({ ok: false, error: validated.error }, { status: validated.status });
  }
  const uniqueTargets = validated.targetIds;

  await db.transaction(async (tx) => {
    if (uniqueTargets.length === 0) {
      await tx
        .delete(itemLinks)
        .where(eq(itemLinks.sourceItemId, sourceItemId));
      return;
    }

    await tx
      .delete(itemLinks)
      .where(
        and(
          eq(itemLinks.sourceItemId, sourceItemId),
          notInArray(itemLinks.targetItemId, uniqueTargets),
        ),
      );

    await tx
      .insert(itemLinks)
      .values(
        uniqueTargets.map((targetItemId) => ({
          sourceItemId,
          targetItemId,
          linkType: "reference",
          sourcePin: null,
          targetPin: null,
        })),
      )
      .onConflictDoNothing({
        target: [itemLinks.sourceItemId, itemLinks.targetItemId, itemLinks.sourcePin, itemLinks.targetPin],
      });
  });

  return Response.json({ ok: true });
}
