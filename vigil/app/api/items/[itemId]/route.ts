import { eq } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { scheduleItemEmbeddingRefresh } from "@/src/lib/item-embedding";
import { rowToCanvasItem } from "@/src/lib/item-mapper";

const patchBody = z.object({
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
    stackId?: string | null;
    stackOrder?: number | null;
  } = {
    updatedAt: new Date(),
  };
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
  if (p.entityMeta !== undefined) updates.entityMeta = p.entityMeta;
  if (p.stackId !== undefined) updates.stackId = p.stackId;
  if (p.stackOrder !== undefined) updates.stackOrder = p.stackOrder;

  const [row] = await db
    .update(items)
    .set(updates)
    .where(eq(items.id, itemId))
    .returning();

  const contentDirty =
    p.title !== undefined ||
    p.contentText !== undefined ||
    p.contentJson !== undefined;
  if (contentDirty && row) {
    scheduleItemEmbeddingRefresh(db, row);
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
