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
  q: z.string().max(200).optional(),
  scope: z.enum(["current_subtree", "gm_workspace"]).optional(),
  rootSpaceId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured", spaces: [] },
      { status: 503 },
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    scope: url.searchParams.get("scope") ?? undefined,
    rootSpaceId: url.searchParams.get("rootSpaceId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten(), spaces: [] },
      { status: 400 },
    );
  }
  const scope = parsed.data.scope ?? "current_subtree";
  if (scope === "current_subtree" && !parsed.data.rootSpaceId) {
    return Response.json(
      { ok: false, error: "rootSpaceId is required for current_subtree scope", spaces: [] },
      { status: 400 },
    );
  }
  const allowed = await resolveLoreImportAllowedSpaceIds({
    db,
    rootSpaceId: parsed.data.rootSpaceId,
    scope,
    bootCtx,
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
    rows.map((row) => [row.id, { name: row.name, parentSpaceId: row.parentSpaceId ?? null }]),
  );
  const q = (parsed.data.q ?? "").trim().toLowerCase();
  if (q.length > 0 && q.length < 2) {
    return Response.json({ ok: true, spaces: [], scope });
  }
  const limit = parsed.data.limit ?? 30;
  const spaceList = rows
    .filter((row) => allowed.has(row.id))
    .map((row) => ({
      spaceId: row.id,
      title: row.name,
      path: buildSpacePath(row.id, byId),
    }))
    .filter((row) => {
      if (!q) return true;
      return row.title.toLowerCase().includes(q) || row.path.toLowerCase().includes(q);
    })
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, limit);
  return Response.json({ ok: true, spaces: spaceList, scope });
}

