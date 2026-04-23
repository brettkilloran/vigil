import { and, eq, lt, or, sql } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { loreImportJobs } from "@/src/db/schema";
import { buildLoreImportPlan } from "@/src/lib/lore-import-plan-build";
import type { LoreImportProgress } from "@/src/lib/lore-import-progress";
import { computeLoreImportPipelinePercent } from "@/src/lib/lore-import-pipeline-progress";
import { persistImportReviewQueueFromPlan } from "@/src/lib/lore-import-persist-review";
import {
  loreImportPlanSchema,
  loreImportUserContextSchema,
} from "@/src/lib/lore-import-plan-types";
import type { VigilDb } from "@/src/lib/spaces";

/** Re-queue jobs stuck in `processing` after a crash or serverless timeout. */
export const STALE_LORE_IMPORT_PROCESSING_MS = 15 * 60 * 1000;
const LORE_IMPORT_JOB_CANCELLED_CODE = "lore_import_job_cancelled";
const LORE_IMPORT_EVENT_CAP = 500;
const LORE_IMPORT_EVENT_FLUSH_BATCH = 6;
const LORE_IMPORT_RESPONSE_SNIPPET_MAX = 2_000;

export type LoreImportJobEvent = {
  ts?: string;
  phase?: string;
  kind:
    | "phase_start"
    | "phase_end"
    | "llm_call"
    | "vault_search"
    | "warning"
    | "note";
  durationMs?: number;
  model?: string;
  tokensIn?: number | null;
  tokensOut?: number | null;
  stopReason?: string | null;
  responseSnippet?: string;
  text?: string;
  ref?: string;
};

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
    column === "progress_events" ||
    column === "user_context" ||
    message.includes("progress_") ||
    message.includes("last_progress_at") ||
    message.includes("progress_events") ||
    message.includes("user_context");
  if (!mentionsProgressColumn) return false;
  if (!code) return true;
  if (code === "42703") return true;
  if (code === "42P01" && message.includes("lore_import_jobs")) return true;
  return false;
}

function coerceOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.trunc(value);
}

function clipEventText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function normalizeLoreImportJobEvent(event: LoreImportJobEvent): LoreImportJobEvent {
  return {
    ts: clipEventText(event.ts, 64) ?? new Date().toISOString(),
    phase: clipEventText(event.phase, 64),
    kind: event.kind,
    durationMs: coerceOptionalNumber(event.durationMs),
    model: clipEventText(event.model, 128),
    tokensIn:
      typeof event.tokensIn === "number" && Number.isFinite(event.tokensIn)
        ? Math.max(0, Math.trunc(event.tokensIn))
        : null,
    tokensOut:
      typeof event.tokensOut === "number" && Number.isFinite(event.tokensOut)
        ? Math.max(0, Math.trunc(event.tokensOut))
        : null,
    stopReason: clipEventText(event.stopReason, 64) ?? null,
    responseSnippet: clipEventText(event.responseSnippet, LORE_IMPORT_RESPONSE_SNIPPET_MAX),
    text: clipEventText(event.text, 280),
    ref: clipEventText(event.ref, 128),
  };
}

export async function appendLoreImportJobEventsBatch(
  db: VigilDb,
  jobId: string,
  events: LoreImportJobEvent[],
): Promise<void> {
  if (typeof (db as { execute?: unknown }).execute !== "function") return;
  if (events.length === 0) return;
  const now = new Date();
  const normalized = events.map(normalizeLoreImportJobEvent);
  const batchJson = JSON.stringify(normalized);
  try {
    await db.execute(sql`
      update "lore_import_jobs"
      set
        "progress_events" = (
          select coalesce(jsonb_agg(value), '[]'::jsonb)
          from (
            select value
            from jsonb_array_elements(
              coalesce("lore_import_jobs"."progress_events", '[]'::jsonb) || ${batchJson}::jsonb
            ) with ordinality as e(value, ord)
            order by ord desc
            limit ${LORE_IMPORT_EVENT_CAP}
          ) recent
        ),
        "updated_at" = ${now}
      where "id" = ${jobId}
    `);
  } catch (error) {
    if (!isMissingProgressColumnsError(error)) throw error;
  }
}

export async function appendLoreImportJobEvent(
  db: VigilDb,
  jobId: string,
  event: LoreImportJobEvent,
): Promise<void> {
  await appendLoreImportJobEventsBatch(db, jobId, [event]);
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
    let userContextRaw: unknown = null;
    if (typeof (db as { execute?: unknown }).execute === "function") {
      try {
        const rows = await db.execute(sql`
          select user_context
          from lore_import_jobs
          where id = ${jobId}
          limit 1
        `);
        userContextRaw = (rows as { rows?: Array<{ user_context?: unknown }> }).rows?.[0]
          ?.user_context;
      } catch (error) {
        if (!isMissingProgressColumnsError(error)) {
          throw error;
        }
      }
    }
    const parsedUserContext = loreImportUserContextSchema.safeParse(userContextRaw);
    const eventBuffer: LoreImportJobEvent[] = [];
    const flushEventBuffer = async () => {
      if (eventBuffer.length === 0) return;
      await assertLoreImportJobNotCancelled(db as VigilDb, jobId);
      const chunk = eventBuffer.splice(0, eventBuffer.length);
      await appendLoreImportJobEventsBatch(db as VigilDb, jobId, chunk);
    };
    let plan: Awaited<ReturnType<typeof buildLoreImportPlan>> | undefined;
    let buildError: unknown;
    let flushError: unknown;
    try {
      plan = await buildLoreImportPlan({
        db: db as VigilDb,
        spaceId: job.spaceId,
        apiKey: key,
        model,
        fullText: job.sourceText,
        importBatchId: job.importBatchId,
        fileName: job.fileName ?? undefined,
        userContext: parsedUserContext.success ? parsedUserContext.data : undefined,
        onProgress: async (progress) => {
          await assertLoreImportJobNotCancelled(db as VigilDb, jobId);
          lastPhase = progress.phase || lastPhase;
          await updateLoreImportJobProgress(db as VigilDb, jobId, progress);
        },
        onEvent: async (event) => {
          eventBuffer.push(event);
          if (eventBuffer.length >= LORE_IMPORT_EVENT_FLUSH_BATCH) {
            await flushEventBuffer();
          }
        },
      });
    } catch (e) {
      buildError = e;
    } finally {
      try {
        await flushEventBuffer();
      } catch (e) {
        flushError = e;
      }
    }
    if (buildError) {
      if (flushError) {
        console.error("[lore-import] event flush also failed after build error", {
          jobId,
          flushError: flushError instanceof Error ? flushError.message : String(flushError),
        });
      }
      throw buildError;
    }
    if (flushError) {
      throw flushError;
    }

    if (plan === undefined) {
      throw new Error("lore import plan missing after build");
    }

    const parsedPlan = loreImportPlanSchema.safeParse(plan);
    if (!parsedPlan.success) {
      await updateLoreImportJobFailed(db as VigilDb, jobId, {
        error: "Generated import plan failed validation",
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
    const [readyWrite] = await db
      .update(loreImportJobs)
      .set({
        status: "ready",
        plan: parsedPlan.data as unknown as Record<string, unknown>,
        error: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(loreImportJobs.id, jobId),
          eq(loreImportJobs.status, "processing"),
        ),
      )
      .returning({ id: loreImportJobs.id });
    if (!readyWrite) {
      await appendLoreImportJobEvent(db as VigilDb, jobId, {
        kind: "warning",
        phase: "persist_review",
        text: "Finalization skipped because job was cancelled before ready write",
      });
      return;
    }
  } catch (e) {
    if (
      e instanceof LoreImportJobCancelledError ||
      (e instanceof Error &&
        (e as { code?: string }).code === LORE_IMPORT_JOB_CANCELLED_CODE)
    ) {
      return;
    }
    const msg = e instanceof Error ? e.message : "Plan failed";
    console.error("[lore-import] job process failed", {
      jobId,
      lastPhase,
      error: msg,
    });
    await updateLoreImportJobFailed(db as VigilDb, jobId, {
      error: "Import planning failed. Try again or split the document.",
      errorCode: "lore_import_job_failed",
      lastPhase,
    });
  }
}
