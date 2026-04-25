import { eq } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import {
  heartgardenApiReadJsonBody,
  heartgardenApiRejectIfPlayerBlocked,
  heartgardenApiRequireDb,
} from "@/src/lib/heartgarden-api-route-helpers";
import { isHeartgardenImplicitPlayerRootSpaceName } from "@/src/lib/heartgarden-implicit-player-space";
import { publishHeartgardenSpaceInvalidation } from "@/src/lib/heartgarden-realtime-invalidation";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import {
  assertSpaceReparentAllowed,
  deleteSpaceSubtree,
} from "@/src/lib/spaces";

const patchBody = z
  .object({
    name: z.string().min(1).max(255).optional(),
    /** When set, moves this space under a new parent (folder inner space ↔ canvas space). GM-only. */
    parentSpaceId: z.string().uuid().nullable().optional(),
  })
  .strict();

export async function PATCH(
  req: Request,
  context: { params: Promise<{ spaceId: string }> }
) {
  const dbGate = heartgardenApiRequireDb(tryGetDb());
  if (!dbGate.ok) {
    return dbGate.response;
  }
  const db = dbGate.db;

  const bootCtx = await getHeartgardenApiBootContext();
  const blocked = heartgardenApiRejectIfPlayerBlocked(bootCtx);
  if (blocked) {
    return blocked;
  }
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) {
    return access.response;
  }

  const bodyRead = await heartgardenApiReadJsonBody(req);
  if (!bodyRead.ok) {
    return bodyRead.response;
  }
  const json = bodyRead.json;

  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (
    parsed.data.name === undefined &&
    parsed.data.parentSpaceId === undefined
  ) {
    return Response.json(
      {
        ok: false,
        error: "No supported fields provided (allowed: name, parentSpaceId)",
      },
      { status: 400 }
    );
  }

  if (parsed.data.name !== undefined) {
    const fromName = access.space.name;
    const toName = parsed.data.name.trim();
    if (
      isHeartgardenImplicitPlayerRootSpaceName(toName) &&
      !isHeartgardenImplicitPlayerRootSpaceName(fromName)
    ) {
      return Response.json(
        { ok: false, error: "Invalid space name" },
        { status: 400 }
      );
    }
    if (
      isHeartgardenImplicitPlayerRootSpaceName(fromName) &&
      !isHeartgardenImplicitPlayerRootSpaceName(toName)
    ) {
      return Response.json(
        { ok: false, error: "Invalid space name" },
        { status: 400 }
      );
    }
  }

  if (parsed.data.parentSpaceId !== undefined) {
    if (bootCtx.role === "player") {
      return heartgardenApiForbiddenJsonResponse();
    }
    const nextParent = parsed.data.parentSpaceId;
    if (
      nextParent !== null &&
      !(await gmMayAccessSpaceIdAsync(db, bootCtx, nextParent))
    ) {
      return heartgardenApiForbiddenJsonResponse();
    }
    // REVIEW_2026-04-25_1730 H1: Reject cross-brane reparents. Folder
    // subtrees must remain inside a single brane so links/mentions stay
    // valid; a deliberate cross-brane migration helper can be added later.
    if (nextParent !== null) {
      const [parentRow] = await db
        .select({ braneId: spaces.braneId })
        .from(spaces)
        .where(eq(spaces.id, nextParent))
        .limit(1);
      if (!parentRow) {
        return Response.json(
          { ok: false, error: "Parent space not found" },
          { status: 404 }
        );
      }
      if (
        parentRow.braneId &&
        access.space.braneId &&
        parentRow.braneId !== access.space.braneId
      ) {
        return Response.json(
          { ok: false, error: "Cross-brane folder reparents are not allowed" },
          { status: 400 }
        );
      }
    }
    const reparent = await assertSpaceReparentAllowed(db, spaceId, nextParent);
    if (!reparent.ok) {
      if (reparent.error === "parent_not_found") {
        return Response.json(
          { ok: false, error: "Parent space not found" },
          { status: 404 }
        );
      }
      if (reparent.error === "would_create_cycle") {
        return Response.json(
          { ok: false, error: "Invalid parent (cycle)" },
          { status: 400 }
        );
      }
      return Response.json(
        { ok: false, error: "Space not found" },
        { status: 404 }
      );
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

  const previousParentSpaceId = access.space.parentSpaceId ?? null;
  await db.update(spaces).set(setPayload).where(eq(spaces.id, spaceId));

  const reason =
    parsed.data.parentSpaceId === undefined ? "space.updated" : "space.moved";
  const lookupSpaceIds = [spaceId];
  if (
    parsed.data.parentSpaceId !== undefined &&
    parsed.data.parentSpaceId !== null
  ) {
    lookupSpaceIds.push(parsed.data.parentSpaceId);
  }
  if (previousParentSpaceId) {
    lookupSpaceIds.push(previousParentSpaceId);
  }
  await publishHeartgardenSpaceInvalidation(db, {
    originSpaceId: spaceId,
    reason,
    lookupSpaceIds,
    directSpaceIds: previousParentSpaceId ? [previousParentSpaceId] : undefined,
  });

  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ spaceId: string }> }
) {
  const dbGate = heartgardenApiRequireDb(tryGetDb());
  if (!dbGate.ok) {
    return dbGate.response;
  }
  const db = dbGate.db;
  const bootCtx = await getHeartgardenApiBootContext();
  const blocked = heartgardenApiRejectIfPlayerBlocked(bootCtx);
  if (blocked || bootCtx.role === "player") {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) {
    return access.response;
  }
  const result = await deleteSpaceSubtree(db, spaceId);
  if (!result.ok) {
    const status = result.error === "Space not found" ? 404 : 400;
    return Response.json({ ok: false, error: result.error }, { status });
  }
  await publishHeartgardenSpaceInvalidation(db, {
    originSpaceId: spaceId,
    reason: "space.deleted",
    lookupSpaceIds: [spaceId],
    directSpaceIds: access.space.parentSpaceId
      ? [access.space.parentSpaceId]
      : undefined,
  });
  return Response.json({ ok: true, deletedSpaceIds: result.deletedIds });
}
