import { and, eq, lt, or } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { loreImportJobs } from "@/src/db/schema";
import { buildLoreImportPlan } from "@/src/lib/lore-import-plan-build";
import type { LoreImportProgress } from "@/src/lib/lore-import-progress";
import { computeLoreImportPipelinePercent } from "@/src/lib/lore-import-pipeline-progress";
import { persistImportReviewQueueFromPlan } from "@/src/lib/lore-import-persist-review";
import { loreImportPlanSchema } from "@/src/lib/lore-import-plan-types";
import type { VigilDb } from "@/src/lib/spaces";

/** Re-queue jobs stuck in `processing` after a crash or serverless timeout. */
export const STALE_LORE_IMPORT_PROCESSING_MS = 15 * 60 * 1000;
const LORE_IMPORT_JOB_CANCELLED_CODE = "lore_import_job_cancelled";

class LoreImportJobCancelledError extends Error {
  code = LORE_IMPORT_JOB_CANCELLED_CODE;
  constructor(jobId: string) {
    super(`Lore import job cancelled (${jobId})`);
    this.name = "LoreImportJobCancelledError";
  }
}

function isMissingProgressColumnsError(error: unknown): boolean {
  const source =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = String(source.code ?? "").trim();
  const column = String(source.column ?? "").toLowerCase();
  const fallbackMessage = error instanceof Error ? error.message : "";
  const message = String(source.message ?? fallbackMessage).toLowerCase();
  const mentionsProgressColumn =
    column.startsWith("progress_") ||
    column === "last_progress_at" ||
    message.includes("progress_") ||
    message.includes("last_progress_at");
  if (!mentionsProgressColumn) return false;
  if (!code) return true;
  if (code === "42703") return true;
  if (code === "42P01" && message.includes("lore_import_jobs")) return true;
  return false;
}

async function updateLoreImportJobProgress(
  db: VigilDb,
  jobId: string,
  progress: LoreImportProgress,
): Promise<void> {
  const now = new Date();
  try {
    await db
      .update(loreImportJobs)
      .set({
        progressPhase: progress.phase || null,
        progressStep: typeof progress.step === "number" ? progress.step : null,
        progressTotal: typeof progress.total === "number" ? progress.total : null,
        progressMessage: progress.message || null,
        progressMeta: progress.meta ?? null,
        lastProgressAt: now,
        updatedAt: now,
      })
      .where(eq(loreImportJobs.id, jobId));
  } catch (error) {
    if (!isMissingProgressColumnsError(error)) throw error;
    await db
      .update(loreImportJobs)
      .set({
        updatedAt: now,
      })
      .where(eq(loreImportJobs.id, jobId));
  }
}

async function updateLoreImportJobFailed(
  db: VigilDb,
  jobId: string,
  args: { error: string; errorCode: string; lastPhase: string },
): Promise<void> {
  const now = new Date();
  try {
    await db
      .update(loreImportJobs)
      .set({
        status: "failed",
        error: args.error,
        progressPhase: "failed",
        progressMessage: args.error,
        progressMeta: {
          errorCode: args.errorCode,
          lastPhase: args.lastPhase,
        },
        lastProgressAt: now,
        updatedAt: now,
      })
      .where(eq(loreImportJobs.id, jobId));
  } catch (error) {
    if (!isMissingProgressColumnsError(error)) throw error;
    await db
      .update(loreImportJobs)
      .set({
        status: "failed",
        error: args.error,
        updatedAt: now,
      })
      .where(eq(loreImportJobs.id, jobId));
  }
}

async function assertLoreImportJobNotCancelled(db: VigilDb, jobId: string): Promise<void> {
  const [row] = await db
    .select({ status: loreImportJobs.status })
    .from(loreImportJobs)
    .where(eq(loreImportJobs.id, jobId))
    .limit(1);
  if (!row) {
    throw new LoreImportJobCancelledError(jobId);
  }
  if (row.status === "cancelled") {
    throw new LoreImportJobCancelledError(jobId);
  }
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
    .returning({
      id: loreImportJobs.id,
      spaceId: loreImportJobs.spaceId,
      importBatchId: loreImportJobs.importBatchId,
      sourceText: loreImportJobs.sourceText,
      fileName: loreImportJobs.fileName,
    });

  if (!job) {
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    await updateLoreImportJobFailed(db as VigilDb, jobId, {
      error: "ANTHROPIC_API_KEY is not configured",
      errorCode: "anthropic_api_key_missing",
      lastPhase: "config",
    });
    return;
  }

  const model =
    process.env.ANTHROPIC_LORE_MODEL?.trim() || "claude-sonnet-4-20250514";
  let lastPhase = "queued";

  try {
    await assertLoreImportJobNotCancelled(db as VigilDb, jobId);
    const plan = await buildLoreImportPlan({
      db: db as VigilDb,
      apiKey: key,
      model,
      fullText: job.sourceText,
      importBatchId: job.importBatchId,
      fileName: job.fileName ?? undefined,
      onProgress: async (progress) => {
        await assertLoreImportJobNotCancelled(db as VigilDb, jobId);
        lastPhase = progress.phase || lastPhase;
        await updateLoreImportJobProgress(db as VigilDb, jobId, progress);
      },
    });

    const parsedPlan = loreImportPlanSchema.safeParse(plan);
    if (!parsedPlan.success) {
      await updateLoreImportJobFailed(db as VigilDb, jobId, {
        error: `Plan validation failed: ${parsedPlan.error.message}`,
        errorCode: "lore_import_plan_validation_failed",
        lastPhase,
      });
      return;
    }

    await updateLoreImportJobProgress(db as VigilDb, jobId, {
      phase: "persist_review",
      message: "Persisting review queue and final plan",
      meta: {
        pipelinePercent:
          computeLoreImportPipelinePercent("persist_review", { phaseFraction: 0.4 }) ?? 97,
      },
    });
    await assertLoreImportJobNotCancelled(db as VigilDb, jobId);
    await persistImportReviewQueueFromPlan(db as VigilDb, job.spaceId, parsedPlan.data, true);
    await assertLoreImportJobNotCancelled(db as VigilDb, jobId);

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
    if (
      e instanceof LoreImportJobCancelledError ||
      (e instanceof Error &&
        (e as { code?: string }).code === LORE_IMPORT_JOB_CANCELLED_CODE)
    ) {
      return;
    }
    const msg = e instanceof Error ? e.message : "Plan failed";
    await updateLoreImportJobFailed(db as VigilDb, jobId, {
      error: msg,
      errorCode: "lore_import_job_failed",
      lastPhase,
    });
  }
}
