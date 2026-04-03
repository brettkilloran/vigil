import { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";
import { assertSpaceExists } from "@/src/lib/spaces";

type Body = { name?: string; parentSpaceId?: string | null };

export async function POST(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 255) {
    return Response.json(
      { ok: false, error: "Name must be 1–255 characters" },
      { status: 400 },
    );
  }

  let parentSpaceId: string | null | undefined;
  if (body.parentSpaceId !== undefined && body.parentSpaceId !== null) {
    if (typeof body.parentSpaceId !== "string") {
      return Response.json(
        { ok: false, error: "Invalid parentSpaceId" },
        { status: 400 },
      );
    }
    const parent = await assertSpaceExists(db, body.parentSpaceId);
    if (!parent) {
      return Response.json(
        { ok: false, error: "Parent space not found" },
        { status: 404 },
      );
    }
    parentSpaceId = body.parentSpaceId;
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
