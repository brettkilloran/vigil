import { tryGetDb } from "@/src/db/index";
import { getHeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { computeItemLinksRevisionForSpace } from "@/src/lib/item-links-space-revision";

/** Cheap `item_links` fingerprint for one space (matches `GET …/graph` scope). */
export async function GET(
  _req: Request,
  context: { params: Promise<{ spaceId: string }> }
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) {
    return access.response;
  }

  const itemLinksRevision = await computeItemLinksRevisionForSpace(db, spaceId);
  return Response.json({ itemLinksRevision, ok: true });
}
