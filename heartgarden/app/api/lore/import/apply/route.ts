import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { invalidateItemLinksRevisionForSpace } from "@/src/lib/item-links-space-revision";
import {
  applyLoreImportPlan,
  loreImportApplyBodySchema,
} from "@/src/lib/lore-import-apply";
import { assertSpaceExists } from "@/src/lib/spaces";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const attemptId =
    req.headers.get("x-heartgarden-import-attempt")?.trim() || "unknown";
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) {
    return denied;
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch (error) {
    console.error("[lore-import] apply invalid json", {
      attemptId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loreImportApplyBodySchema.safeParse(json);
  if (!parsed.success) {
    const firstIssue =
      parsed.error.issues[0]?.message ?? "Invalid request body";
    return Response.json(
      { ok: false, error: parsed.error.flatten(), hint: firstIssue },
      { status: 400 }
    );
  }
  console.info("[lore-import] apply request", {
    attemptId,
    spaceId: parsed.data.spaceId,
    importBatchId: parsed.data.importBatchId,
    acceptedMergeCount: parsed.data.acceptedMergeProposalIds.length,
    clarificationCount: parsed.data.clarificationAnswers.length,
  });

  const space = await assertSpaceExists(db, parsed.data.spaceId);
  if (!space) {
    return Response.json(
      { ok: false, error: "Space not found" },
      { status: 404 }
    );
  }
  if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, parsed.data.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  try {
    const result = await applyLoreImportPlan(db, parsed.data);
    if (result.status === "needs_follow_up") {
      return Response.json({
        ok: true,
        attemptId,
        status: result.status,
        resolvedClarificationAnswers: result.resolvedClarificationAnswers,
        followUp: result.followUp,
      });
    }
    if (result.linksCreated > 0) {
      invalidateItemLinksRevisionForSpace(parsed.data.spaceId);
    }
    return Response.json({
      ok: true,
      attemptId,
      ...result,
      linkWarnings: result.linkWarnings.length
        ? result.linkWarnings
        : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Apply failed";
    console.error("[lore-import] apply failed", {
      attemptId,
      spaceId: parsed.data.spaceId,
      importBatchId: parsed.data.importBatchId,
      error: msg,
    });
    return Response.json({ ok: false, error: msg }, { status: 400 });
  }
}
