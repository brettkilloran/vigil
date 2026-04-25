import { and, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { itemLinks, items } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessItemSpaceAsync,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForPlayer,
  playerMayAccessItemSpaceAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import {
  heartgardenApiReadJsonBody,
  heartgardenApiRejectIfPlayerBlocked,
  heartgardenApiRequireDb,
} from "@/src/lib/heartgarden-api-route-helpers";
import { invalidateItemLinksRevisionForSpace } from "@/src/lib/item-links-space-revision";
import { publishHeartgardenSpaceInvalidation } from "@/src/lib/heartgarden-realtime-invalidation";
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
  const dbGate = heartgardenApiRequireDb(tryGetDb());
  if (!dbGate.ok) return dbGate.response;
  const db = dbGate.db;
  const bootCtx = await getHeartgardenApiBootContext();
  const blocked = heartgardenApiRejectIfPlayerBlocked(bootCtx);
  if (blocked) return blocked;

  const bodyRead = await heartgardenApiReadJsonBody(req);
  if (!bodyRead.ok) return bodyRead.response;

  const parsed = bodySchema.safeParse(bodyRead.json);
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
  for (const targetSpaceId of validated.targetSpaceIds) {
    if (!(await playerMayAccessItemSpaceAsync(db, bootCtx, targetSpaceId))) {
      return heartgardenApiForbiddenJsonResponse();
    }
    if (!(await gmMayAccessItemSpaceAsync(db, bootCtx, targetSpaceId))) {
      return heartgardenApiForbiddenJsonResponse();
    }
  }
  const uniqueTargets = validated.targetIds;
  const touchedSpaceIds = new Set<string>();
  touchedSpaceIds.add(srcItem.spaceId);
  const existingTargets = await db
    .select({ spaceId: items.spaceId })
    .from(itemLinks)
    .innerJoin(items, eq(items.id, itemLinks.targetItemId))
    .where(eq(itemLinks.sourceItemId, sourceItemId));
  for (const row of existingTargets) touchedSpaceIds.add(row.spaceId);
  if (uniqueTargets.length > 0) {
    const nextRows = await db
      .select({ spaceId: items.spaceId })
      .from(items)
      .where(inArray(items.id, uniqueTargets));
    for (const row of nextRows) touchedSpaceIds.add(row.spaceId);
  }

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
          linkType: "pin",
          sourcePin: null,
          targetPin: null,
        })),
      )
      .onConflictDoNothing({
        target: [itemLinks.sourceItemId, itemLinks.targetItemId, itemLinks.sourcePin, itemLinks.targetPin],
      });
  });
  for (const spaceId of touchedSpaceIds) {
    invalidateItemLinksRevisionForSpace(spaceId);
  }
  await publishHeartgardenSpaceInvalidation(db, {
    originSpaceId: srcItem.spaceId,
    reason: "item-links.changed",
    itemId: sourceItemId,
    lookupSpaceIds: [srcItem.spaceId, ...validated.targetSpaceIds],
  });

  return Response.json({ ok: true });
}
