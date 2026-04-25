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
      { error: "ANTHROPIC_API_KEY is not configured", ok: false },
      { status: 503 }
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON", ok: false }, { status: 400 });
  }

  const parsed = loreImportPlanPostBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten(), ok: false },
      { status: 400 }
    );
  }

  const space = await assertSpaceExists(db, parsed.data.spaceId);
  if (!space) {
    return Response.json(
      { error: "Space not found", ok: false },
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
      apiKey: key,
      db,
      fileName: parsed.data.fileName,
      fullText: parsed.data.text,
      importBatchId,
      model,
      spaceId: parsed.data.spaceId,
      userContext: parsed.data.userContext,
    });

    const persistReview = parsed.data.persistReview !== false;
    if (persistReview) {
      await db.transaction(async (tx) => {
        const txDb = tx as unknown as VigilDb;
        await insertLoreImportJobForCompletedSyncPlan({
          db: txDb,
          fileName: parsed.data.fileName,
          importBatchId: plan.importBatchId,
          plan,
          sourceText: parsed.data.text,
          spaceId: parsed.data.spaceId,
          userContext: parsed.data.userContext,
        });
        await replaceImportReviewQueueForPlan(txDb, parsed.data.spaceId, plan);
      });
    } else {
      await insertLoreImportJobForCompletedSyncPlan({
        db: db as VigilDb,
        fileName: parsed.data.fileName,
        importBatchId: plan.importBatchId,
        plan,
        sourceText: parsed.data.text,
        spaceId: parsed.data.spaceId,
        userContext: parsed.data.userContext,
      });
    }

    return Response.json({ ok: true, plan });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Plan failed";
    return Response.json({ error: msg, ok: false }, { status: 500 });
  }
}
