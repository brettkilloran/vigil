import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";
import { syncVigilItemsFromStore } from "@/src/lib/sync-vigil-items";
import {
  assertSpaceOwnedByUser,
  getOrCreateOwnerUser,
} from "@/src/lib/vigil-owner";

type SnapshotBody = {
  snapshot?: {
    document?: { store?: Record<string, unknown> };
  };
};

export async function POST(
  req: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  const { spaceId } = await context.params;
  let body: SnapshotBody;
  try {
    body = (await req.json()) as SnapshotBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const store = body.snapshot?.document?.store;
  if (!store || typeof store !== "object") {
    return Response.json({ ok: false, error: "Invalid snapshot" }, { status: 400 });
  }

  const owner = await getOrCreateOwnerUser(db);
  const space = await assertSpaceOwnedByUser(db, spaceId, owner.id);

  if (!space) {
    return Response.json({ ok: false, error: "Space not found" }, { status: 404 });
  }

  await db
    .update(spaces)
    .set({
      canvasState: body.snapshot as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(spaces.id, spaceId));

  await syncVigilItemsFromStore(db, spaceId, store);

  return Response.json({ ok: true });
}
