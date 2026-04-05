import { eq } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { itemLinks } from "@/src/db/schema";
import { validateLinkTargetsInSourceSpace } from "@/src/lib/item-links-validation";

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
  const validated = await validateLinkTargetsInSourceSpace(db, sourceItemId, [targetItemId]);
  if (!validated.ok) {
    return Response.json({ ok: false, error: validated.error }, { status: validated.status });
  }
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
      meta: meta ?? null,
    })
    .onConflictDoNothing({
      target: [itemLinks.sourceItemId, itemLinks.targetItemId, itemLinks.sourcePin, itemLinks.targetPin],
    })
    .returning();
  if (!row) {
    return Response.json({ ok: true, deduped: true });
  }
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

  const [existing] = await db.select().from(itemLinks).where(eq(itemLinks.id, id)).limit(1);
  if (!existing) {
    return Response.json({ ok: false, error: "Link not found" }, { status: 404 });
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
      updates.meta = { ...prev, ...meta };
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
    return Response.json({ ok: false, error: "Link not found" }, { status: 404 });
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
  const deleted = await db
    .delete(itemLinks)
    .where(eq(itemLinks.id, id))
    .returning();
  if (deleted.length < 1) {
    return Response.json({ ok: false, error: "Link not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
