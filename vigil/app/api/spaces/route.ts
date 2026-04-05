import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessSpaceId,
  heartgardenApiForbiddenJsonResponse,
  isHeartgardenVisitorBlocked,
} from "@/src/lib/heartgarden-api-boot-context";
import { assertSpaceExists, listGmWorkspaceSpaces } from "@/src/lib/spaces";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  parentSpaceId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured", spaces: [] }, { status: 503 });
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenVisitorBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (bootCtx.role === "visitor") {
    const row = await assertSpaceExists(db, bootCtx.playerSpaceId);
    if (!row) {
      return heartgardenApiForbiddenJsonResponse();
    }
    return Response.json({
      ok: true,
      spaces: [
        {
          id: row.id,
          name: row.name,
          parentSpaceId: row.parentSpaceId,
          updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
        },
      ],
    });
  }
  const rows = await listGmWorkspaceSpaces(db);
  return Response.json({
    ok: true,
    spaces: rows.map((r) => ({
      id: r.id,
      name: r.name,
      parentSpaceId: r.parentSpaceId,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    })),
  });
}

export async function POST(req: Request) {
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

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { name, parentSpaceId } = parsed.data;

  if (parentSpaceId !== undefined && parentSpaceId !== null) {
    if (!gmMayAccessSpaceId(bootCtx, parentSpaceId)) {
      return heartgardenApiForbiddenJsonResponse();
    }
    const parent = await assertSpaceExists(db, parentSpaceId);
    if (!parent) {
      return Response.json(
        { ok: false, error: "Parent space not found" },
        { status: 404 },
      );
    }
  }

  const [created] = await db
    .insert(spaces)
    .values({
      name,
      ...(parentSpaceId !== undefined ? { parentSpaceId } : {}),
    })
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
