import { eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForPlayer,
  isHeartgardenPlayerBlocked,
} from "@/src/lib/heartgarden-api-boot-context";
import {
  heartgardenApiReadJsonBody,
  heartgardenApiRejectIfPlayerBlocked,
  heartgardenApiRequireDb,
} from "@/src/lib/heartgarden-api-route-helpers";
import { isHeartgardenImplicitPlayerRootSpaceName } from "@/src/lib/heartgarden-implicit-player-space";
import { publishHeartgardenSpaceInvalidation } from "@/src/lib/heartgarden-realtime-invalidation";
import {
  fetchPlayerSubtreeSpacesFull,
  spaceIsUnderPlayerRoot,
} from "@/src/lib/heartgarden-space-subtree";
import {
  assertSpaceExists,
  listGmWorkspaceSpaces,
  resolveOrCreateBraneByType,
} from "@/src/lib/spaces";

const bodySchema = z.object({
  /** When set, insert this row id (undo-after-delete folder subtree restore). Must not already exist. */
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(255),
  parentSpaceId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured", spaces: [] },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (bootCtx.role === "player") {
    const rows = await fetchPlayerSubtreeSpacesFull(db, bootCtx.playerSpaceId);
    if (rows.length === 0) {
      return heartgardenApiForbiddenJsonResponse();
    }
    return Response.json({
      ok: true,
      spaces: rows.map((row) => ({
        id: row.id,
        name: row.name,
        parentSpaceId: row.parentSpaceId,
        updatedAt:
          row.updatedAt instanceof Date
            ? row.updatedAt.toISOString()
            : String(row.updatedAt),
      })),
    });
  }
  const rows = await listGmWorkspaceSpaces(db);
  return Response.json({
    ok: true,
    spaces: rows.map((r) => ({
      id: r.id,
      name: r.name,
      parentSpaceId: r.parentSpaceId,
      updatedAt:
        r.updatedAt instanceof Date
          ? r.updatedAt.toISOString()
          : String(r.updatedAt),
    })),
  });
}

export async function POST(req: Request) {
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

  const bodyRead = await heartgardenApiReadJsonBody(req);
  if (!bodyRead.ok) {
    return bodyRead.response;
  }
  const json = bodyRead.json;

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { name, parentSpaceId } = parsed.data;

  if (isHeartgardenImplicitPlayerRootSpaceName(name)) {
    return Response.json(
      { ok: false, error: "Invalid space name" },
      { status: 400 }
    );
  }

  if (bootCtx.role === "player") {
    if (parsed.data.id !== undefined) {
      return heartgardenApiForbiddenJsonResponse();
    }
    if (parentSpaceId === undefined || parentSpaceId === null) {
      return Response.json(
        { ok: false, error: "Parent space required" },
        { status: 400 }
      );
    }
    if (
      !(await spaceIsUnderPlayerRoot(db, bootCtx.playerSpaceId, parentSpaceId))
    ) {
      return heartgardenApiForbiddenJsonResponse();
    }
    const parent = await assertSpaceExists(db, parentSpaceId);
    if (!parent) {
      return heartgardenMaskNotFoundForPlayer(
        bootCtx,
        Response.json(
          { ok: false, error: "Parent space not found" },
          { status: 404 }
        )
      );
    }
    const [created] = await db
      .insert(spaces)
      .values({
        name,
        parentSpaceId,
        braneId: parent.braneId,
      })
      .returning();

    after(async () => {
      await publishHeartgardenSpaceInvalidation(db, {
        originSpaceId: created?.id,
        reason: "space.created",
        lookupSpaceIds: [created?.id, parentSpaceId],
        directSpaceIds: [parentSpaceId],
      });
    });

    return Response.json({
      ok: true,
      space: {
        id: created?.id,
        name: created?.name,
        updatedAt:
          created?.updatedAt instanceof Date
            ? created?.updatedAt.toISOString()
            : String(created?.updatedAt),
      },
    });
  }

  if (bootCtx.role !== "gm") {
    return heartgardenApiForbiddenJsonResponse();
  }

  if (parsed.data.id !== undefined) {
    const [existing] = await db
      .select()
      .from(spaces)
      .where(eq(spaces.id, parsed.data.id))
      .limit(1);
    if (existing) {
      return Response.json(
        { ok: false, error: "Space id already exists" },
        { status: 409 }
      );
    }
  }

  let parentBraneId: string | null = null;
  if (parentSpaceId !== undefined && parentSpaceId !== null) {
    if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, parentSpaceId))) {
      return heartgardenApiForbiddenJsonResponse();
    }
    const parent = await assertSpaceExists(db, parentSpaceId);
    if (!parent) {
      return Response.json(
        { ok: false, error: "Parent space not found" },
        { status: 404 }
      );
    }
    if (isHeartgardenImplicitPlayerRootSpaceName(parent.name)) {
      return Response.json(
        { ok: false, error: "Invalid parent" },
        { status: 400 }
      );
    }
    parentBraneId = parent.braneId;
  }

  const [created] = await db
    .insert(spaces)
    .values({
      braneId: parentBraneId ?? (await resolveOrCreateBraneByType(db, "gm")).id,
      ...(parsed.data.id ? { id: parsed.data.id } : {}),
      name,
      ...(parentSpaceId === undefined ? {} : { parentSpaceId }),
    })
    .returning();

  after(async () => {
    await publishHeartgardenSpaceInvalidation(db, {
      originSpaceId: created?.id,
      reason: "space.created",
      lookupSpaceIds: parentSpaceId
        ? [created?.id, parentSpaceId]
        : [created?.id],
      directSpaceIds: parentSpaceId ? [parentSpaceId] : undefined,
    });
  });

  return Response.json({
    ok: true,
    space: {
      id: created?.id,
      name: created?.name,
      updatedAt:
        created?.updatedAt instanceof Date
          ? created?.updatedAt.toISOString()
          : String(created?.updatedAt),
    },
  });
}
