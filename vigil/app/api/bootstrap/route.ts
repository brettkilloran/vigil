import { tryGetDb } from "@/src/db/index";
import { parseSpaceIdParam } from "@/src/lib/space-id";
import {
  listItemsForSpace,
  parseCameraFromRow,
  resolveActiveSpace,
} from "@/src/lib/spaces";
import { rowToCanvasItem } from "@/src/lib/item-mapper";

export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({
      ok: true,
      demo: true,
      spaceId: null,
      spaces: [] as { id: string; name: string; updatedAt: string }[],
      items: [],
      camera: { x: 0, y: 0, zoom: 1 },
    });
  }

  const url = new URL(req.url);
  const requested = parseSpaceIdParam(url.searchParams.get("space"));

  const { activeSpace, allSpaces } = await resolveActiveSpace(db, requested);

  const itemRows = await listItemsForSpace(db, activeSpace.id);
  const items = itemRows.map(rowToCanvasItem);
  const camera = parseCameraFromRow(activeSpace.canvasState);

  return Response.json({
    ok: true,
    demo: false,
    spaceId: activeSpace.id,
    spaces: allSpaces.map((s) => ({
      id: s.id,
      name: s.name,
      updatedAt:
        s.updatedAt instanceof Date
          ? s.updatedAt.toISOString()
          : String(s.updatedAt),
    })),
    items,
    camera,
  });
}
