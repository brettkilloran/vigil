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
import { publishHeartgardenSpaceInvalidation } from "@/src/lib/heartgarden-realtime-invalidation";
import { invalidateItemLinksRevisionForSpace } from "@/src/lib/item-links-space-revision";
import { validateLinkTargetsInBrane } from "@/src/lib/item-links-validation";

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
  if (!dbGate.ok) {
    return dbGate.response;
  }
  const db = dbGate.db;
  const bootCtx = await getHeartgardenApiBootContext();
  const blocked = heartgardenApiRejectIfPlayerBlocked(bootCtx);
  if (blocked) {
    return blocked;
  }

  const bodyRead = await heartgardenApiReadJsonBody(req);
  if (!bodyRead.ok) {
    return bodyRead.response;
  }

  const parsed = bodySchema.safeParse(bodyRead.json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten(), ok: false },
      { status: 400 }
    );
  }

  const { sourceItemId, targetIds } = parsed.data;
  const [srcItem] = await db
    .select({ spaceId: items.spaceId })
    .from(items)
    .where(eq(items.id, sourceItemId))
    .limit(1);
  if (!srcItem) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json(
        { error: "Source item not found", ok: false },
        { status: 404 }
      )
    );
  }
  if (!(await playerMayAccessItemSpaceAsync(db, bootCtx, srcItem.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (!(await gmMayAccessItemSpaceAsync(db, bootCtx, srcItem.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const validated = await validateLinkTargetsInBrane(
    db,
    sourceItemId,
    targetIds
  );
  if (!validated.ok) {
    return Response.json(
      { error: validated.error, ok: false },
      { status: validated.status }
    );
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
  for (const row of existingTargets) {
    touchedSpaceIds.add(row.spaceId);
  }
  if (uniqueTargets.length > 0) {
    const nextRows = await db
      .select({ spaceId: items.spaceId })
      .from(items)
      .where(inArray(items.id, uniqueTargets));
    for (const row of nextRows) {
      touchedSpaceIds.add(row.spaceId);
    }
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
          notInArray(itemLinks.targetItemId, uniqueTargets)
        )
      );

    await tx
      .insert(itemLinks)
      .values(
        uniqueTargets.map((targetItemId) => ({
          linkType: "pin",
          sourceItemId,
          sourcePin: null,
          targetItemId,
          targetPin: null,
        }))
      )
      .onConflictDoNothing({
        target: [
          itemLinks.sourceItemId,
          itemLinks.targetItemId,
          itemLinks.sourcePin,
          itemLinks.targetPin,
        ],
      });
  });
  for (const spaceId of touchedSpaceIds) {
    invalidateItemLinksRevisionForSpace(spaceId);
  }
  await publishHeartgardenSpaceInvalidation(db, {
    itemId: sourceItemId,
    lookupSpaceIds: [srcItem.spaceId, ...validated.targetSpaceIds],
    originSpaceId: srcItem.spaceId,
    reason: "item-links.changed",
  });

  return Response.json({ ok: true });
}
