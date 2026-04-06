import { eq } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessSpaceId,
  heartgardenApiForbiddenJsonResponse,
  isHeartgardenPlayerBlocked,
} from "@/src/lib/heartgarden-api-boot-context";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { assertSpaceReparentAllowed, deleteSpaceSubtree } from "@/src/lib/spaces";

const patchBody = z.object({
  camera: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number().positive().max(8),
    })
    .optional(),
  name: z.string().min(1).max(255).optional(),
  /** When set, moves this space under a new parent (folder inner space ↔ canvas space). GM-only. */
  parentSpaceId: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }

  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) return access.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.parentSpaceId !== undefined) {
    if (bootCtx.role === "player") {
      return heartgardenApiForbiddenJsonResponse();
    }
    const nextParent = parsed.data.parentSpaceId;
    if (nextParent !== null && !gmMayAccessSpaceId(bootCtx, nextParent)) {
      return heartgardenApiForbiddenJsonResponse();
    }
    const reparent = await assertSpaceReparentAllowed(db, spaceId, nextParent);
    if (!reparent.ok) {
      if (reparent.error === "parent_not_found") {
        return Response.json({ ok: false, error: "Parent space not found" }, { status: 404 });
      }
      if (reparent.error === "would_create_cycle") {
        return Response.json({ ok: false, error: "Invalid parent (cycle)" }, { status: 400 });
      }
      return Response.json({ ok: false, error: "Space not found" }, { status: 404 });
    }
  }

  const setPayload: {
    name?: string;
    parentSpaceId?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) {
    setPayload.name = parsed.data.name;
  }
  if (parsed.data.parentSpaceId !== undefined) {
    setPayload.parentSpaceId = parsed.data.parentSpaceId;
  }

  await db.update(spaces).set(setPayload).where(eq(spaces.id, spaceId));

  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx) || bootCtx.role === "player") {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) return access.response;
  const result = await deleteSpaceSubtree(db, spaceId);
  if (!result.ok) {
    const status = result.error === "Space not found" ? 404 : 400;
    return Response.json({ ok: false, error: result.error }, { status });
  }
  return Response.json({ ok: true, deletedSpaceIds: result.deletedIds });
}
