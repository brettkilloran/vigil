import { and, eq, lt, or } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { loreImportJobs } from "@/src/db/schema";
import { buildLoreImportPlan } from "@/src/lib/lore-import-plan-build";
import type { LoreImportProgress } from "@/src/lib/lore-import-progress";
import { persistImportReviewQueueFromPlan } from "@/src/lib/lore-import-persist-review";
import { loreImportPlanSchema } from "@/src/lib/lore-import-plan-types";
import type { VigilDb } from "@/src/lib/spaces";

/** Re-queue jobs stuck in `processing` after a crash or serverless timeout. */
export const STALE_LORE_IMPORT_PROCESSING_MS = 15 * 60 * 1000;

async function updateLoreImportJobProgress(
  db: VigilDb,
  jobId: string,
  progress: LoreImportProgress,
): Promise<void> {
  void progress;
  await db
    .update(loreImportJobs)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(loreImportJobs.id, jobId));
}

export async function processLoreImportJob(jobId: string): Promise<void> {
  const db = tryGetDb();
  if (!db) {
    return;
  }

  const staleBefore = new Date(Date.now() - STALE_LORE_IMPORT_PROCESSING_MS);

  const [job] = await db
    .update(loreImportJobs)
    .set({
      status: "processing",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(loreImportJobs.id, jobId),
        or(
          eq(loreImportJobs.status, "queued"),
          and(
            eq(loreImportJobs.status, "processing"),
            lt(loreImportJobs.updatedAt, staleBefore),
          ),
        ),
      ),
    )
    .returning();

  if (!job) {
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    await db
      .update(loreImportJobs)
      .set({
        status: "failed",
        error: "ANTHROPIC_API_KEY is not configured",
        updatedAt: new Date(),
      })
      .where(eq(loreImportJobs.id, jobId));
    return;
  }

  const model =
    process.env.ANTHROPIC_LORE_MODEL?.trim() || "claude-sonnet-4-20250514";

  try {
    const plan = await buildLoreImportPlan({
      db: db as VigilDb,
      apiKey: key,
      model,
      fullText: job.sourceText,
      importBatchId: job.importBatchId,
      fileName: job.fileName ?? undefined,
      onProgress: async (progress) => {
        await updateLoreImportJobProgress(db as VigilDb, jobId, progress);
      },
    });

    const parsedPlan = loreImportPlanSchema.safeParse(plan);
    if (!parsedPlan.success) {
      await db
        .update(loreImportJobs)
        .set({
          status: "failed",
          error: `Plan validation failed: ${parsedPlan.error.message}`,
          updatedAt: new Date(),
        })
        .where(eq(loreImportJobs.id, jobId));
      return;
    }

    await updateLoreImportJobProgress(db as VigilDb, jobId, {
      phase: "persist_review",
      message: "Persisting review queue and final plan",
    });
    await persistImportReviewQueueFromPlan(db as VigilDb, job.spaceId, parsedPlan.data, true);

    await db
      .update(loreImportJobs)
      .set({
        status: "ready",
        plan: parsedPlan.data as unknown as Record<string, unknown>,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(loreImportJobs.id, jobId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Plan failed";
    await db
      .update(loreImportJobs)
      .set({
        status: "failed",
        error: msg,
        updatedAt: new Date(),
      })
      .where(eq(loreImportJobs.id, jobId));
  }
}
