import { eq } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { scheduleItemEmbeddingRefresh } from "@/src/lib/item-embedding";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import { buildSearchBlob } from "@/src/lib/search-blob";
import { scheduleVaultReindexAfterResponse } from "@/src/lib/schedule-vault-index-after";
import { assertSpaceExists } from "@/src/lib/spaces";

function mergeEntityMeta(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base = {
    ...(existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {}),
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
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
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
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);
  if (!existing) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const p = parsed.data;
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
    const space = await assertSpaceExists(db, p.spaceId);
    if (!space) {
      return Response.json({ ok: false, error: "Space not found" }, { status: 400 });
    }
    updates.spaceId = p.spaceId;
  }

  if (p.x !== undefined) updates.x = p.x;
  if (p.y !== undefined) updates.y = p.y;
  if (p.width !== undefined) updates.width = p.width;
  if (p.height !== undefined) updates.height = p.height;
  if (p.zIndex !== undefined) updates.zIndex = p.zIndex;
  if (p.title !== undefined) updates.title = p.title;
  if (p.contentText !== undefined) updates.contentText = p.contentText;
  if (p.contentJson !== undefined) updates.contentJson = p.contentJson;
  if (p.color !== undefined) updates.color = p.color;
  if (p.itemType !== undefined) updates.itemType = p.itemType;
  if (p.entityType !== undefined) updates.entityType = p.entityType;
  if (p.entityMeta !== undefined) {
    updates.entityMeta = p.entityMeta;
  } else if (p.entityMetaMerge !== undefined && Object.keys(p.entityMetaMerge).length > 0) {
    updates.entityMeta = mergeEntityMeta(
      existing.entityMeta as Record<string, unknown> | null | undefined,
      p.entityMetaMerge as Record<string, unknown>,
    );
  }
  if (p.imageUrl !== undefined) updates.imageUrl = p.imageUrl;
  if (p.imageMeta !== undefined) updates.imageMeta = p.imageMeta;
  if (p.stackId !== undefined) updates.stackId = p.stackId;
  if (p.stackOrder !== undefined) updates.stackOrder = p.stackOrder;

  const resolvedEntityMeta =
    updates.entityMeta !== undefined
      ? updates.entityMeta
      : (existing.entityMeta as Record<string, unknown> | null);

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

  const [row] = await db
    .update(items)
    .set(updates)
    .where(eq(items.id, itemId))
    .returning();

  const titleChanged =
    p.title !== undefined && p.title !== existing.title;
  const contentTextChanged =
    p.contentText !== undefined && p.contentText !== existing.contentText;
  const contentDirty = titleChanged || contentTextChanged;
  const metaDirty =
    p.entityMeta !== undefined || p.entityMetaMerge !== undefined;
  if (contentDirty && row) {
    scheduleItemEmbeddingRefresh(db, row);
    scheduleVaultReindexAfterResponse(row.id);
  } else if (metaDirty && row) {
    scheduleVaultReindexAfterResponse(row.id);
  }

  return Response.json({ ok: true, item: rowToCanvasItem(row!) });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }
  const { itemId } = await context.params;
  const deleted = await db.delete(items).where(eq(items.id, itemId)).returning();
  if (deleted.length === 0) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
