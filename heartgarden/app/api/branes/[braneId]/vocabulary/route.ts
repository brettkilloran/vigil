import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { branes } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayReadBraneIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { buildEntityVocabularyForBrane } from "@/src/lib/entity-vocabulary";
import { parseSpaceIdParam } from "@/src/lib/space-id";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  context: { params: Promise<{ braneId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  const { braneId: rawBraneId } = await context.params;
  const braneId = parseSpaceIdParam(rawBraneId);
  if (!braneId) {
    return Response.json({ ok: false, error: "Invalid brane id" }, { status: 400 });
  }
  const [brane] = await db
    .select({ id: branes.id })
    .from(branes)
    .where(eq(branes.id, braneId))
    .limit(1);
  if (!brane) {
    return Response.json({ ok: false, error: "Brane not found" }, { status: 404 });
  }
  if (!(await gmMayReadBraneIdAsync(db, bootCtx, braneId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const payload = await buildEntityVocabularyForBrane(db, braneId);
  const requestEtag = req.headers.get("if-none-match")?.trim();
  if (requestEtag && requestEtag === payload.etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: payload.etag, "Cache-Control": "private, max-age=15" },
    });
  }
  return Response.json(
    {
      ok: true,
      ...payload,
    },
    {
      headers: { ETag: payload.etag, "Cache-Control": "private, max-age=15" },
    },
  );
}
