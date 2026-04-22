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

type LoreImportErrorCode =
  | "missing_anthropic_key"
  | "plan_validation_failed"
  | "outline_llm_failed"
  | "merge_llm_failed"
  | "clarify_llm_failed"
  | "persist_review_failed"
  | "job_failed";

function classifyLoreImportErrorCode(message: string, phase: string): LoreImportErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes("anthropic_api_key")) return "missing_anthropic_key";
  if (lower.includes("validation")) return "plan_validation_failed";
  if (phase === "outline") return "outline_llm_failed";
  if (phase === "merge") return "merge_llm_failed";
  if (phase === "clarify") return "clarify_llm_failed";
  if (phase === "persist_review") return "persist_review_failed";
  return "job_failed";
}

async function updateLoreImportJobProgress(
  db: VigilDb,
  jobId: string,
  progress: LoreImportProgress,
  attemptId?: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(loreImportJobs)
    .set({
      progressPhase: progress.phase,
      progressStep: progress.step ?? null,
      progressTotal: progress.total ?? null,
      progressMessage: progress.message,
      progressMeta: {
        ...(attemptId ? { attemptId } : {}),
        ...(progress.meta ?? {}),
      },
      lastProgressAt: now,
      updatedAt: now,
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
      progressPhase: "claiming",
      progressMessage: "Worker claimed import job",
      progressStep: null,
      progressTotal: null,
      progressMeta: null,
      lastProgressAt: new Date(),
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
  const jobMeta =
    job.progressMeta && typeof job.progressMeta === "object"
      ? (job.progressMeta as Record<string, unknown>)
      : {};
  const attemptId = typeof jobMeta.attemptId === "string" ? jobMeta.attemptId : undefined;
  let lastPhase = typeof job.progressPhase === "string" ? job.progressPhase : "claiming";

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    const errorCode = "missing_anthropic_key";
    await db
      .update(loreImportJobs)
      .set({
        status: "failed",
        error: "ANTHROPIC_API_KEY is not configured",
        progressPhase: "failed",
        progressMessage: "Import failed: missing Anthropic API key",
        progressMeta: {
          ...(attemptId ? { attemptId } : {}),
          errorCode,
          lastPhase,
        },
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
        if (typeof progress.phase === "string" && progress.phase) lastPhase = progress.phase;
        await updateLoreImportJobProgress(db as VigilDb, jobId, progress, attemptId);
      },
    });

    const parsedPlan = loreImportPlanSchema.safeParse(plan);
    if (!parsedPlan.success) {
      const errorCode = "plan_validation_failed";
      await db
        .update(loreImportJobs)
        .set({
          status: "failed",
          error: `Plan validation failed: ${parsedPlan.error.message}`,
          progressPhase: "failed",
          progressMessage: "Import failed: plan did not pass validation",
          progressMeta: {
            ...(attemptId ? { attemptId } : {}),
            errorCode,
            lastPhase: "plan_validation",
          },
          updatedAt: new Date(),
        })
        .where(eq(loreImportJobs.id, jobId));
      return;
    }

    await updateLoreImportJobProgress(db as VigilDb, jobId, {
      phase: "persist_review",
      message: "Persisting review queue and final plan",
    }, attemptId);
    await persistImportReviewQueueFromPlan(db as VigilDb, job.spaceId, parsedPlan.data, true);

    await db
      .update(loreImportJobs)
      .set({
        status: "ready",
        progressPhase: "ready",
        progressStep: null,
        progressTotal: null,
        progressMessage: "Import plan is ready",
        progressMeta: attemptId ? { attemptId } : null,
        plan: parsedPlan.data as unknown as Record<string, unknown>,
        error: null,
        lastProgressAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loreImportJobs.id, jobId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Plan failed";
    const errorCode = classifyLoreImportErrorCode(msg, lastPhase);
    await db
      .update(loreImportJobs)
      .set({
        status: "failed",
        error: msg,
        progressPhase: "failed",
        progressMessage: "Import job failed",
        progressMeta: {
          ...(attemptId ? { attemptId } : {}),
          detail: msg.slice(0, 2000),
          errorCode,
          lastPhase,
        },
        lastProgressAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loreImportJobs.id, jobId));
  }
}
