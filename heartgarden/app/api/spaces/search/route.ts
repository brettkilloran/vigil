import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  heartgardenApiForbiddenJsonResponse,
  isHeartgardenPlayerBlocked,
} from "@/src/lib/heartgarden-api-boot-context";
import {
  buildSpacePath,
  resolveLoreImportAllowedSpaceIds,
} from "@/src/lib/lore-import-space-scope";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().max(200).optional(),
  rootSpaceId: z.string().uuid().optional(),
  scope: z.enum(["current_subtree", "gm_workspace"]).optional(),
});

export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false, spaces: [] },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    rootSpaceId: url.searchParams.get("rootSpaceId") ?? undefined,
    scope: url.searchParams.get("scope") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten(), ok: false, spaces: [] },
      { status: 400 }
    );
  }
  const scope = parsed.data.scope ?? "current_subtree";
  if (scope === "current_subtree" && !parsed.data.rootSpaceId) {
    return Response.json(
      {
        error: "rootSpaceId is required for current_subtree scope",
        ok: false,
        spaces: [],
      },
      { status: 400 }
    );
  }
  const allowed = await resolveLoreImportAllowedSpaceIds({
    bootCtx,
    db,
    rootSpaceId: parsed.data.rootSpaceId,
    scope,
  }).catch(() => null);
  if (!allowed) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const rows = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      parentSpaceId: spaces.parentSpaceId,
    })
    .from(spaces);
  const byId = new Map(
    rows.map((row) => [
      row.id,
      { name: row.name, parentSpaceId: row.parentSpaceId ?? null },
    ])
  );
  const q = (parsed.data.q ?? "").trim().toLowerCase();
  if (q.length > 0 && q.length < 2) {
    return Response.json({ ok: true, scope, spaces: [] });
  }
  const limit = parsed.data.limit ?? 30;
  const spaceList = rows
    .filter((row) => allowed.has(row.id))
    .map((row) => ({
      path: buildSpacePath(row.id, byId),
      spaceId: row.id,
      title: row.name,
    }))
    .filter((row) => {
      if (!q) {
        return true;
      }
      return (
        row.title.toLowerCase().includes(q) ||
        row.path.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, limit);
  return Response.json({ ok: true, scope, spaces: spaceList });
}
