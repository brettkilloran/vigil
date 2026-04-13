import { and, eq, isNull } from "drizzle-orm";
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
import { publishHeartgardenSpaceInvalidation } from "@/src/lib/heartgarden-realtime-invalidation";
import { clampLinkMetaSlackMultiplier } from "@/src/lib/item-link-meta";
import { validateLinkTargetsInSourceSpace } from "@/src/lib/item-links-validation";

function normalizeItemLinkMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const next = { ...meta };
  if ("slackMultiplier" in next && typeof next.slackMultiplier === "number") {
    next.slackMultiplier = clampLinkMetaSlackMultiplier(next.slackMultiplier);
  }
  return next;
}

const bodySchema = z.object({
  sourceItemId: z.string().uuid(),
  targetItemId: z.string().uuid(),
  linkType: z.string().max(64).optional(),
  label: z.string().max(500).optional(),
  sourcePin: z.string().max(64).optional(),
  targetPin: z.string().max(64).optional(),
  color: z.string().max(128).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const patchBodySchema = z.object({
  id: z.string().uuid(),
  color: z.string().max(128).optional(),
  label: z.string().max(500).nullable().optional(),
  linkType: z.string().max(64).optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

const deleteBodySchema = z.object({
  id: z.string().uuid(),
});

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
  const { sourceItemId, targetItemId, linkType, label, sourcePin, targetPin, color, meta } = parsed.data;
  if (sourceItemId === targetItemId) {
    return Response.json({ ok: false, error: "Self-link not allowed" }, { status: 400 });
  }
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
  const validated = await validateLinkTargetsInSourceSpace(db, sourceItemId, [targetItemId]);
  if (!validated.ok) {
    return Response.json({ ok: false, error: validated.error }, { status: validated.status });
  }
  const metaForRow = meta ? normalizeItemLinkMeta(meta) : null;
  const [row] = await db
    .insert(itemLinks)
    .values({
      sourceItemId,
      targetItemId,
      linkType: linkType ?? "reference",
      label: label ?? null,
      sourcePin: sourcePin ?? null,
      targetPin: targetPin ?? null,
      color: color ?? null,
      meta: metaForRow,
    })
    .onConflictDoNothing({
      target: [itemLinks.sourceItemId, itemLinks.targetItemId, itemLinks.sourcePin, itemLinks.targetPin],
    })
    .returning();
  if (!row) {
    const pinClause = and(
      sourcePin != null && sourcePin !== ""
        ? eq(itemLinks.sourcePin, sourcePin)
        : isNull(itemLinks.sourcePin),
      targetPin != null && targetPin !== ""
        ? eq(itemLinks.targetPin, targetPin)
        : isNull(itemLinks.targetPin),
    );
    const [existing] = await db
      .select()
      .from(itemLinks)
      .where(
        and(eq(itemLinks.sourceItemId, sourceItemId), eq(itemLinks.targetItemId, targetItemId), pinClause),
      )
      .limit(1);
    return Response.json({
      ok: true,
      deduped: true,
      ...(existing ? { link: existing } : {}),
    });
  }
  await publishHeartgardenSpaceInvalidation(db, {
    originSpaceId: srcItem.spaceId,
    reason: "item-links.changed",
    itemId: sourceItemId,
    lookupSpaceIds: [srcItem.spaceId],
  });
  return Response.json({ ok: true, link: row });
}

export async function PATCH(req: Request) {
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
  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { id, color, label, linkType, meta } = parsed.data;

  const [linkMeta] = await db
    .select({ sourceItemId: itemLinks.sourceItemId })
    .from(itemLinks)
    .where(eq(itemLinks.id, id))
    .limit(1);
  if (!linkMeta) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ ok: false, error: "Link not found" }, { status: 404 }),
    );
  }
  const [srcForLink] = await db
    .select({ spaceId: items.spaceId })
    .from(items)
    .where(eq(items.id, linkMeta.sourceItemId))
    .limit(1);
  if (!(await playerMayAccessItemSpaceAsync(db, bootCtx, srcForLink?.spaceId ?? ""))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (
    srcForLink &&
    !(await gmMayAccessItemSpaceAsync(db, bootCtx, srcForLink.spaceId))
  ) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const [existing] = await db
    .select({ meta: itemLinks.meta })
    .from(itemLinks)
    .where(eq(itemLinks.id, id))
    .limit(1);
  if (!existing) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ ok: false, error: "Link not found" }, { status: 404 }),
    );
  }

  const updates: {
    color?: string;
    label?: string | null;
    linkType?: string;
    meta?: Record<string, unknown> | null;
  } = {};
  if (color !== undefined) updates.color = color;
  if (label !== undefined) updates.label = label;
  if (linkType !== undefined) updates.linkType = linkType;
  if (meta !== undefined) {
    if (meta === null) {
      updates.meta = null;
    } else {
      const prev =
        existing.meta && typeof existing.meta === "object" && !Array.isArray(existing.meta)
          ? { ...(existing.meta as Record<string, unknown>) }
          : {};
      updates.meta = normalizeItemLinkMeta({ ...prev, ...meta });
    }
  }
  if (Object.keys(updates).length < 1) {
    return Response.json({ ok: false, error: "No updates provided" }, { status: 400 });
  }
  const [updated] = await db
    .update(itemLinks)
    .set(updates)
    .where(eq(itemLinks.id, id))
    .returning();
  if (!updated) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ ok: false, error: "Link not found" }, { status: 404 }),
    );
  }
  if (srcForLink?.spaceId) {
    await publishHeartgardenSpaceInvalidation(db, {
      originSpaceId: srcForLink.spaceId,
      reason: "item-links.changed",
      itemId: linkMeta.sourceItemId,
      lookupSpaceIds: [srcForLink.spaceId],
    });
  }
  return Response.json({ ok: true, link: updated });
}

export async function DELETE(req: Request) {
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
  const parsed = deleteBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { id } = parsed.data;
  const [linkMeta] = await db
    .select({ sourceItemId: itemLinks.sourceItemId })
    .from(itemLinks)
    .where(eq(itemLinks.id, id))
    .limit(1);
  if (!linkMeta) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ ok: false, error: "Link not found" }, { status: 404 }),
    );
  }
  const [srcForLink] = await db
    .select({ spaceId: items.spaceId })
    .from(items)
    .where(eq(items.id, linkMeta.sourceItemId))
    .limit(1);
  if (!(await playerMayAccessItemSpaceAsync(db, bootCtx, srcForLink?.spaceId ?? ""))) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (
    srcForLink &&
    !(await gmMayAccessItemSpaceAsync(db, bootCtx, srcForLink.spaceId))
  ) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const deleted = await db
    .delete(itemLinks)
    .where(eq(itemLinks.id, id))
    .returning();
  if (deleted.length < 1) {
    return heartgardenMaskNotFoundForPlayer(
      bootCtx,
      Response.json({ ok: false, error: "Link not found" }, { status: 404 }),
    );
  }
  if (srcForLink?.spaceId) {
    await publishHeartgardenSpaceInvalidation(db, {
      originSpaceId: srcForLink.spaceId,
      reason: "item-links.changed",
      itemId: linkMeta.sourceItemId,
      lookupSpaceIds: [srcForLink.spaceId],
    });
  }
  return Response.json({ ok: true });
}
