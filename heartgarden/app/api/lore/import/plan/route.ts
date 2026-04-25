import { randomUUID } from "node:crypto";

import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { replaceImportReviewQueueForPlan } from "@/src/lib/lore-import-persist-review";
import { buildLoreImportPlan } from "@/src/lib/lore-import-plan-build";
import { loreImportPlanPostBodySchema } from "@/src/lib/lore-import-plan-post-body";
import { insertLoreImportJobForCompletedSyncPlan } from "@/src/lib/lore-import-sync-plan-job";
import { assertSpaceExists, type VigilDb } from "@/src/lib/spaces";

export const runtime = "nodejs";

export const maxDuration = 300;

export async function POST(req: Request) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) {
    return denied;
  }

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return Response.json(
      { ok: false, error: "ANTHROPIC_API_KEY is not configured" },
      { status: 503 }
    );
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
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loreImportPlanPostBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

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

  const importBatchId = randomUUID();
  const model =
    process.env.ANTHROPIC_LORE_MODEL?.trim() || "claude-sonnet-4-20250514";

  try {
    const plan = await buildLoreImportPlan({
      db,
      spaceId: parsed.data.spaceId,
      apiKey: key,
      model,
      fullText: parsed.data.text,
      importBatchId,
      fileName: parsed.data.fileName,
      userContext: parsed.data.userContext,
    });

    const persistReview = parsed.data.persistReview !== false;
    if (persistReview) {
      await db.transaction(async (tx) => {
        const txDb = tx as unknown as VigilDb;
        await insertLoreImportJobForCompletedSyncPlan({
          db: txDb,
          spaceId: parsed.data.spaceId,
          importBatchId: plan.importBatchId,
          sourceText: parsed.data.text,
          fileName: parsed.data.fileName,
          userContext: parsed.data.userContext,
          plan,
        });
        await replaceImportReviewQueueForPlan(txDb, parsed.data.spaceId, plan);
      });
    } else {
      await insertLoreImportJobForCompletedSyncPlan({
        db: db as VigilDb,
        spaceId: parsed.data.spaceId,
        importBatchId: plan.importBatchId,
        sourceText: parsed.data.text,
        fileName: parsed.data.fileName,
        userContext: parsed.data.userContext,
        plan,
      });
    }

    return Response.json({ ok: true, plan });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Plan failed";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
