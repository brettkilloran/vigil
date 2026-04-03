import { eq } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { itemLinks, items } from "@/src/db/schema";

const bodySchema = z.object({
  sourceItemId: z.string().uuid(),
  targetItemId: z.string().uuid(),
  linkType: z.string().max(64).optional(),
  label: z.string().max(500).optional(),
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
  const { sourceItemId, targetItemId, linkType, label } = parsed.data;
  if (sourceItemId === targetItemId) {
    return Response.json({ ok: false, error: "Self-link not allowed" }, { status: 400 });
  }
  const [a] = await db.select().from(items).where(eq(items.id, sourceItemId)).limit(1);
  const [b] = await db.select().from(items).where(eq(items.id, targetItemId)).limit(1);
  if (!a || !b) {
    return Response.json({ ok: false, error: "Item not found" }, { status: 404 });
  }
  const [row] = await db
    .insert(itemLinks)
    .values({
      sourceItemId,
      targetItemId,
      linkType: linkType ?? "reference",
      label: label ?? null,
    })
    .onConflictDoNothing({
      target: [itemLinks.sourceItemId, itemLinks.targetItemId],
    })
    .returning();
  if (!row) {
    return Response.json({ ok: true, deduped: true });
  }
  return Response.json({ ok: true, link: row });
}
