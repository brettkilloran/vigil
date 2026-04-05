import { eq } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForVisitor,
  isHeartgardenVisitorBlocked,
  visitorMayAccessSpaceId,
} from "@/src/lib/heartgarden-api-boot-context";
import { assertSpaceExists, deleteSpaceSubtree } from "@/src/lib/spaces";

const patchBody = z.object({
  camera: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number().positive().max(8),
    })
    .optional(),
  name: z.string().min(1).max(255).optional(),
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
  if (isHeartgardenVisitorBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const { spaceId } = await context.params;
  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return heartgardenMaskNotFoundForVisitor(
      bootCtx,
      Response.json({ ok: false, error: "Space not found" }, { status: 404 }),
    );
  }
  if (!visitorMayAccessSpaceId(bootCtx, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }

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

  await db
    .update(spaces)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.camera !== undefined
        ? {
            canvasState: parsed.data.camera as unknown as Record<string, unknown>,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(spaces.id, spaceId));

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
  if (isHeartgardenVisitorBlocked(bootCtx) || bootCtx.role === "visitor") {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { spaceId } = await context.params;
  const result = await deleteSpaceSubtree(db, spaceId);
  if (!result.ok) {
    const status = result.error === "Space not found" ? 404 : 400;
    return Response.json({ ok: false, error: result.error }, { status });
  }
  return Response.json({ ok: true, deletedSpaceIds: result.deletedIds });
}
