import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import {
  applyLoreImportPlan,
  loreImportApplyBodySchema,
} from "@/src/lib/lore-import-apply";
import { assertSpaceExists } from "@/src/lib/spaces";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loreImportApplyBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const space = await assertSpaceExists(db, parsed.data.spaceId);
  if (!space) {
    return Response.json({ ok: false, error: "Space not found" }, { status: 404 });
  }
  if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, parsed.data.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  try {
    const result = await applyLoreImportPlan(db, parsed.data);
    return Response.json({
      ok: true,
      ...result,
      linkWarnings: result.linkWarnings.length ? result.linkWarnings : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Apply failed";
    return Response.json({ ok: false, error: msg }, { status: 400 });
  }
}
