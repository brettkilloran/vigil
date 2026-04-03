import { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";
import { getOrCreateOwnerUser } from "@/src/lib/vigil-owner";

type Body = { name?: string };

export async function POST(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
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

  const user = await getOrCreateOwnerUser(db);
  const [created] = await db
    .insert(spaces)
    .values({ userId: user.id, name })
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
