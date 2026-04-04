import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";
import { assertSpaceExists } from "@/src/lib/spaces";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  parentSpaceId: z.string().uuid().nullable().optional(),
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
  const { name, parentSpaceId } = parsed.data;

  if (parentSpaceId !== undefined && parentSpaceId !== null) {
    const parent = await assertSpaceExists(db, parentSpaceId);
    if (!parent) {
      return Response.json(
        { ok: false, error: "Parent space not found" },
        { status: 404 },
      );
    }
  }

  const [created] = await db
    .insert(spaces)
    .values({
      name,
      ...(parentSpaceId !== undefined ? { parentSpaceId } : {}),
    })
    .returning();

  return Response.json({
    ok: true,
    space: {
      id: created!.id,
      name: created!.name,
      updatedAt:
        created!.updatedAt instanceof Date
          ? created!.updatedAt.toISOString()
          : String(created!.updatedAt),
    },
  });
}
