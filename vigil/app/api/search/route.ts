import { tryGetDb } from "@/src/db/index";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import { assertSpaceExists, searchItemsFTS } from "@/src/lib/spaces";

export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured", items: [] });
  }
  const url = new URL(req.url);
  const spaceId = url.searchParams.get("spaceId");
  const q = url.searchParams.get("q") ?? "";
  if (!spaceId) {
    return Response.json({ ok: false, error: "spaceId required", items: [] }, { status: 400 });
  }
  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return Response.json({ ok: false, error: "Space not found", items: [] }, { status: 404 });
  }
  const rows = await searchItemsFTS(db, spaceId, q);
  return Response.json({ ok: true, items: rows.map(rowToCanvasItem) });
}
