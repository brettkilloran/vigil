import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { itemEmbeddings, itemLinks, items, spaces } from "@/src/db/schema";
import { scheduleEntityMentionRescanOnVocabularyChange } from "@/src/lib/entity-mentions";
import { deriveVocabularyTermsFromSeed } from "@/src/lib/entity-vocabulary";
import {
  getHeartgardenApiBootContext,
  gmMayAccessItemSpaceAsync,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForPlayer,
  isHeartgardenPlayerBlocked,
  playerMayAccessItemSpaceAsync,
  playerMayApplySpaceIdPatchAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { validateItemWriteJsonPayload } from "@/src/lib/heartgarden-item-json-schema";
import { publishHeartgardenSpaceInvalidation } from "@/src/lib/heartgarden-realtime-invalidation";
import { jsonValidationError } from "@/src/lib/heartgarden-validation-error";
import { scrubHgArchRefsAfterItemDelete } from "@/src/lib/hg-arch-orphan-repair";
import { invalidateItemLinksRevisionForSpace } from "@/src/lib/item-links-space-revision";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import { jsonValuesEqualForPatch } from "@/src/lib/json-value-equal";
import {
  playersMayCreateItemType,
  playersMayPatchItemType,
  playersPatchBodyViolatesPolicy,
  stripGmOnlyEntityMetaPatch,
} from "@/src/lib/player-item-policy";
import { scheduleVaultReindexAfterResponse } from "@/src/lib/schedule-vault-index-after";
import { buildSearchBlob } from "@/src/lib/search-blob";
import { assertSpaceExists } from "@/src/lib/spaces";

function mergeEntityMeta(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base = {
    ...(existing && typeof existing === "object" && !Array.isArray(existing)
      ? existing
      : {}),
  };
  for (const [k, v] of Object.entries(patch)) {
    if (k === "loreReviewTags" && Array.isArray(v)) {
      const prev = Array.isArray(base.loreReviewTags)
        ? (base.loreReviewTags as unknown[]).map(String)
        : [];
      const add = v.map(String).filter(Boolean);
      base.loreReviewTags = [...new Set([...prev, ...add])];
    } else {
      base[k] = v;
    }
  }
  return base;
}

const patchBody = z.object({
  /** Move item to another canvas space (e.g. into / out of a folder). */
  spaceId: z.string().uuid().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().max(4000).optional(),
  height: z.number().positive().max(4000).optional(),
  zIndex: z.number().int().optional(),
  title: z.string().max(255).optional(),
  contentText: z.string().optional(),
  contentJson: z.record(z.string(), z.any()).nullable().optional(),
  color: z.string().max(64).nullable().optional(),
  itemType: z
    .enum(["note", "sticky", "image", "checklist", "webclip", "folder"])
    .optional(),
  entityType: z.string().max(64).nullable().optional(),
  entityMeta: z.record(z.string(), z.any()).nullable().optional(),
  /** Shallow merge into existing entity_meta; `loreReviewTags` arrays are unioned. */
  entityMetaMerge: z.record(z.string(), z.unknown()).optional(),
  imageUrl: z.string().max(8192).nullable().optional(),
  imageMeta: z.record(z.string(), z.any()).nullable().optional(),
  stackId: z.string().uuid().nullable().optional(),
  stackOrder: z.number().int().nullable().optional(),
  /** ISO timestamp from last known server row; mismatch → 409 + current item. */
  baseUpdatedAt: z.string().optional(),
});

function rowUpdatedAtMs(existing: { updatedAt: unknown }): number | null {
  const u = existing.updatedAt;
  const ms =
    u instanceof Date
      ? u.getTime()
      : new Date(u as string | number | Date).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Title/body/entity/image fields — optimistic lock required (see CODE_HEALTH_AUDIT). */
function patchRequiresBaseOptimisticLock(
  p: z.infer<typeof patchBody>
): boolean {
  if (p.title !== undefined) {
    return true;
  }
  if (p.contentText !== undefined) {
    return true;
  }
  if (p.contentJson !== undefined) {
    return true;
  }
  if (p.entityMeta !== undefined) {
    return true;
  }
  if (
    p.entityMetaMerge !== undefined &&
    Object.keys(p.entityMetaMerge).length > 0
  ) {
    return true;
  }
  if (p.entityType !== undefined) {
    return true;
  }
  if (p.imageUrl !== undefined) {
    return true;
  }
  if (p.imageMeta !== undefined) {
    return true;
  }
  return false;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { itemId } = await context.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }
  const jsonValidation = validateItemWriteJsonPayload({
    entityType: parsed.data.entityType,
    entityMeta: parsed.data.entityMeta,
    contentJson: parsed.data.contentJson,
    imageMeta: parsed.data.imageMeta,
    routeTag: "PATCH /api/items/[itemId]",
  });
  if (!jsonValidation.ok) {
    return Response.json(
      { ok: false, error: jsonValidation.error },
      { status: 400 }
    );
  }

  if (bootCtx.role === "player") {
    if (playersPatchBodyViolatesPolicy(parsed.data)) {
      return heartgardenApiForbiddenJsonResponse();
    }
    if (!playersMayPatchItemType(parsed.data.itemType)) {
      return heartgardenApiForbiddenJsonResponse();
    }
  }

  const [existing] = await db
    .select()
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);
  if (!existing) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ ok: false, error: "Not found" }, { status: 404 })
    );
  }
  if (!(await playerMayAccessItemSpaceAsync(db, bootCtx, existing.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (
    bootCtx.role === "player" &&
    !playersMayCreateItemType(existing.itemType)
  ) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (!(await gmMayAccessItemSpaceAsync(db, bootCtx, existing.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const p = parsed.data;
  const rowMs = rowUpdatedAtMs(existing);
  if (rowMs === null) {
    return Response.json(
      { ok: false, error: "Item row has invalid updatedAt" },
      { status: 500 }
    );
  }

  const needsOptimisticLock = patchRequiresBaseOptimisticLock(p);
  if (needsOptimisticLock && !p.baseUpdatedAt?.trim()) {
    return Response.json(
      {
        ok: false,
        error:
          "baseUpdatedAt is required when changing title, body, or entity fields",
      },
      { status: 400 }
    );
  }

  const effectiveBase = p.baseUpdatedAt?.trim();
  if (needsOptimisticLock || effectiveBase) {
    const baseMs = Date.parse(effectiveBase ?? "");
    if (!Number.isFinite(baseMs)) {
      return Response.json(
        { ok: false, error: "Invalid baseUpdatedAt" },
        { status: 400 }
      );
    }
    if (rowMs !== baseMs) {
      return Response.json(
        { ok: false, error: "conflict", item: rowToCanvasItem(existing) },
        { status: 409 }
      );
    }
  }
  const updates: {
    updatedAt: Date;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    zIndex?: number;
    title?: string;
    contentText?: string;
    contentJson?: Record<string, unknown> | null;
    color?: string | null;
    itemType?: string;
    entityType?: string | null;
    entityMeta?: Record<string, unknown> | null;
    imageUrl?: string | null;
    imageMeta?: Record<string, unknown> | null;
    stackId?: string | null;
    stackOrder?: number | null;
    searchBlob?: string;
    spaceId?: string;
  } = {
    updatedAt: new Date(),
  };

  if (p.spaceId !== undefined) {
    if (
      !(await playerMayApplySpaceIdPatchAsync(
        db,
        bootCtx,
        existing.spaceId,
        p.spaceId
      ))
    ) {
      return heartgardenApiForbiddenJsonResponse();
    }
    const space = await assertSpaceExists(db, p.spaceId);
    if (!space) {
      return heartgardenMaskNotFoundForPlayer(
        bootCtx,
        Response.json({ ok: false, error: "Space not found" }, { status: 400 })
      );
    }
    if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, p.spaceId))) {
      return heartgardenApiForbiddenJsonResponse();
    }
    // REVIEW_2026-04-25_1730 H1: Reject cross-brane item moves. The link and
    // entity-mention layers assume "links/mentions stay inside one brane"
    // (validated at write time by `validateLinkTargetsInBrane`); silently
    // moving an item to a different brane would leave stale links and
    // mention rows pointing across brane boundaries. A deliberate
    // cross-brane migration helper can be added later if needed.
    if (p.spaceId !== existing.spaceId) {
      const branePair = await db
        .select({ id: spaces.id, braneId: spaces.braneId })
        .from(spaces)
        .where(or(eq(spaces.id, existing.spaceId), eq(spaces.id, p.spaceId)));
      const fromBraneId =
        branePair.find((row) => row.id === existing.spaceId)?.braneId ?? null;
      const toBraneId =
        branePair.find((row) => row.id === p.spaceId)?.braneId ?? null;
      if (fromBraneId && toBraneId && fromBraneId !== toBraneId) {
        return Response.json(
          {
            ok: false,
            error: "Cross-brane item moves are not allowed",
          },
          { status: 400 }
        );
      }
    }
    updates.spaceId = p.spaceId;
  }

  if (p.x !== undefined) {
    updates.x = p.x;
  }
  if (p.y !== undefined) {
    updates.y = p.y;
  }
  if (p.width !== undefined) {
    updates.width = p.width;
  }
  if (p.height !== undefined) {
    updates.height = p.height;
  }
  if (p.zIndex !== undefined) {
    updates.zIndex = p.zIndex;
  }
  if (p.title !== undefined) {
    updates.title = p.title;
  }
  if (p.contentText !== undefined) {
    updates.contentText = p.contentText;
  }
  if (p.contentJson !== undefined) {
    updates.contentJson = p.contentJson;
  }
  if (p.color !== undefined) {
    updates.color = p.color;
  }
  if (p.itemType !== undefined) {
    updates.itemType = p.itemType;
  }
  if (p.entityType !== undefined) {
    updates.entityType = p.entityType;
  }
  if (p.entityMeta !== undefined) {
    if (bootCtx.role === "player") {
      if (p.entityMeta === null) {
        updates.entityMeta = null;
      } else {
        const stripped = stripGmOnlyEntityMetaPatch(
          p.entityMeta as Record<string, unknown>
        );
        updates.entityMeta =
          stripped && Object.keys(stripped).length > 0 ? stripped : null;
      }
    } else {
      updates.entityMeta = p.entityMeta;
    }
  } else if (
    p.entityMetaMerge !== undefined &&
    Object.keys(p.entityMetaMerge).length > 0
  ) {
    const mergePatch =
      bootCtx.role === "player"
        ? (stripGmOnlyEntityMetaPatch(
            p.entityMetaMerge as Record<string, unknown>
          ) ?? {})
        : (p.entityMetaMerge as Record<string, unknown>);
    updates.entityMeta = mergeEntityMeta(
      existing.entityMeta as Record<string, unknown> | null | undefined,
      mergePatch
    );
  }
  if (p.imageUrl !== undefined) {
    updates.imageUrl = p.imageUrl;
  }
  if (p.imageMeta !== undefined) {
    updates.imageMeta = p.imageMeta;
  }
  if (p.stackId !== undefined) {
    updates.stackId = p.stackId;
  }
  if (p.stackOrder !== undefined) {
    updates.stackOrder = p.stackOrder;
  }

  const resolvedEntityMeta =
    updates.entityMeta === undefined
      ? (existing.entityMeta as Record<string, unknown> | null)
      : updates.entityMeta;

  updates.searchBlob = buildSearchBlob({
    title: p.title ?? existing.title,
    contentText: p.contentText ?? existing.contentText,
    contentJson: p.contentJson ?? existing.contentJson,
    entityType: p.entityType ?? existing.entityType,
    entityMeta: resolvedEntityMeta ?? undefined,
    imageUrl: p.imageUrl ?? existing.imageUrl,
    imageMeta: p.imageMeta ?? existing.imageMeta,
    loreSummary: existing.loreSummary,
    loreAliases: existing.loreAliases ?? undefined,
  });

  // REVIEW_2026-04-22-2 C2: atomic optimistic-lock. When the caller supplied a
  // `baseUpdatedAt`, the UPDATE predicate pins the row's current `updated_at` so
  // a concurrent writer between the SELECT above and this UPDATE cannot silently
  // overwrite newer state. If `returning()` comes back empty, the row has moved
  // since we read it and we re-read to return a 409 with the freshest row.
  const updatePredicate =
    needsOptimisticLock || effectiveBase
      ? and(
          eq(items.id, itemId),
          existing.updatedAt == null
            ? isNull(items.updatedAt)
            : eq(items.updatedAt, existing.updatedAt)
        )
      : eq(items.id, itemId);
  const [row] = await db
    .update(items)
    .set(updates)
    .where(updatePredicate)
    .returning();
  if (!row) {
    const [latest] = await db
      .select()
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);
    if (!latest) {
      return heartgardenMaskNotFoundForPlayer(
        bootCtx,
        Response.json({ ok: false, error: "Not found" }, { status: 404 })
      );
    }
    return Response.json(
      { ok: false, error: "conflict", item: rowToCanvasItem(latest) },
      { status: 409 }
    );
  }

  const titleChanged = p.title !== undefined && p.title !== existing.title;
  const contentTextChanged =
    p.contentText !== undefined && p.contentText !== existing.contentText;
  const contentJsonChanged =
    p.contentJson !== undefined &&
    !jsonValuesEqualForPatch(p.contentJson, existing.contentJson);
  const contentDirty = titleChanged || contentTextChanged || contentJsonChanged;
  const metaDirty =
    p.entityMeta !== undefined || p.entityMetaMerge !== undefined;
  if (row && (contentDirty || metaDirty)) {
    scheduleVaultReindexAfterResponse(row.id);
    if (titleChanged) {
      const [spaceRow] = await db
        .select({ braneId: spaces.braneId })
        .from(spaces)
        .where(eq(spaces.id, row.spaceId))
        .limit(1);
      if (spaceRow?.braneId) {
        // REVIEW_2026-04-25_1730 H3: incremental rescan. Only items whose
        // search_blob contains the OLD or NEW title can have their term
        // mentions affected by this rename, so scope the brane-wide work
        // to that candidate set + only those vocab terms.
        const affectedTerms = Array.from(
          new Set([
            ...deriveVocabularyTermsFromSeed(existing.title),
            ...deriveVocabularyTermsFromSeed(p.title),
          ])
        );
        scheduleEntityMentionRescanOnVocabularyChange(db, spaceRow.braneId, {
          affectedTerms,
        });
      }
    }
  }

  if (!row) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ ok: false, error: "Not found" }, { status: 404 })
    );
  }

  {
    const moved =
      updates.spaceId !== undefined && updates.spaceId !== existing.spaceId;
    const changedSpaceIds = moved
      ? [existing.spaceId, updates.spaceId as string]
      : [row.spaceId];
    if (moved) {
      // REVIEW_2026-04-25_1730 M6: Bump link-revision caches for BOTH
      // origin and destination spaces; otherwise other clients keep
      // serving stale link snapshots for the space the item left.
      invalidateItemLinksRevisionForSpace(existing.spaceId);
      invalidateItemLinksRevisionForSpace(updates.spaceId as string);
    }
    await publishHeartgardenSpaceInvalidation(db, {
      originSpaceId: row.spaceId,
      reason: moved ? "space.moved" : "item.updated",
      itemId: row.id,
      lookupSpaceIds: changedSpaceIds,
    });
  }

  return Response.json({ ok: true, item: rowToCanvasItem(row) });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { itemId } = await context.params;
  const [existing] = await db
    .select()
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);
  if (!existing) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ ok: false, error: "Not found" }, { status: 404 })
    );
  }
  if (!(await playerMayAccessItemSpaceAsync(db, bootCtx, existing.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (!(await gmMayAccessItemSpaceAsync(db, bootCtx, existing.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const deleted = await db.transaction(async (tx) => {
    invalidateItemLinksRevisionForSpace(existing.spaceId);
    // Defensive cleanup for older deployments where FK cascades may be absent.
    await tx
      .delete(itemLinks)
      .where(
        or(
          eq(itemLinks.sourceItemId, itemId),
          eq(itemLinks.targetItemId, itemId)
        )
      );
    await tx.delete(itemEmbeddings).where(eq(itemEmbeddings.itemId, itemId));
    return tx.delete(items).where(eq(items.id, itemId)).returning();
  });
  if (deleted.length === 0) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ ok: false, error: "Not found" }, { status: 404 })
    );
  }
  const scrubbedIds = await scrubHgArchRefsAfterItemDelete(db, {
    spaceId: existing.spaceId,
    deadItemId: itemId,
  });
  for (const sid of scrubbedIds) {
    scheduleVaultReindexAfterResponse(sid);
    await publishHeartgardenSpaceInvalidation(db, {
      originSpaceId: existing.spaceId,
      reason: "item.updated",
      itemId: sid,
      lookupSpaceIds: [existing.spaceId],
    });
  }
  await publishHeartgardenSpaceInvalidation(db, {
    originSpaceId: existing.spaceId,
    reason: "item.deleted",
    itemId,
    lookupSpaceIds: [existing.spaceId],
  });
  return Response.json({ ok: true });
}
