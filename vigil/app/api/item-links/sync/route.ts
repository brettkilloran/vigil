import { and, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { itemLinks, items } from "@/src/db/schema";

const bodySchema = z.object({
  sourceItemId: z.string().uuid(),
  targetIds: z.array(z.string().uuid()),
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

  const { sourceItemId, targetIds } = parsed.data;
  const uniqueTargets = [...new Set(targetIds)].filter((id) => id !== sourceItemId);

  const [src] = await db
    .select()
    .from(items)
    .where(eq(items.id, sourceItemId))
    .limit(1);
  if (!src) {
    return Response.json({ ok: false, error: "Source item not found" }, { status: 404 });
  }

  if (uniqueTargets.length > 0) {
    const peerRows = await db
      .select({ id: items.id, spaceId: items.spaceId })
      .from(items)
      .where(inArray(items.id, uniqueTargets));
    if (peerRows.length !== uniqueTargets.length) {
      return Response.json(
        { ok: false, error: "One or more target items not found" },
        { status: 400 },
      );
    }
    for (const p of peerRows) {
      if (p.spaceId !== src.spaceId) {
        return Response.json(
          { ok: false, error: "Cross-space links are not allowed" },
          { status: 400 },
        );
      }
    }
  }

  if (uniqueTargets.length === 0) {
    await db
      .delete(itemLinks)
      .where(eq(itemLinks.sourceItemId, sourceItemId));
  } else {
    await db
      .delete(itemLinks)
      .where(
        and(
          eq(itemLinks.sourceItemId, sourceItemId),
          notInArray(itemLinks.targetItemId, uniqueTargets),
        ),
      );
    for (const tid of uniqueTargets) {
      await db
        .insert(itemLinks)
        .values({
          sourceItemId,
          targetItemId: tid,
          linkType: "reference",
        })
        .onConflictDoNothing({
          target: [itemLinks.sourceItemId, itemLinks.targetItemId],
        });
    }
  }

  return Response.json({ ok: true });
}
