import { tryGetDb } from "@/src/db/index";
import { parseSpaceIdParam } from "@/src/lib/space-id";
import { getOrCreateOwnerUser, resolveActiveSpace } from "@/src/lib/vigil-owner";

export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({
      ok: true,
      demo: true,
      spaceId: null,
      userId: null,
      snapshot: null,
      spaces: [] as { id: string; name: string; updatedAt: string }[],
    });
  }

  const url = new URL(req.url);
  const requested = parseSpaceIdParam(url.searchParams.get("space"));

  const user = await getOrCreateOwnerUser(db);
  const { activeSpace, allSpaces } = await resolveActiveSpace(
    db,
    user.id,
    requested,
  );

  return Response.json({
    ok: true,
    demo: false,
    spaceId: activeSpace.id,
    userId: user.id,
    snapshot: activeSpace.canvasState ?? null,
    spaces: allSpaces.map((s) => ({
      id: s.id,
      name: s.name,
      updatedAt:
        s.updatedAt instanceof Date
          ? s.updatedAt.toISOString()
          : String(s.updatedAt),
    })),
  });
}
