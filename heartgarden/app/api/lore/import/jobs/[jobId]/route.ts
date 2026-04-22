import { eq, sql } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { loreImportJobs } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { scheduleLoreImportJobProcessing } from "@/src/lib/lore-import-job-after";
import {
  STALE_LORE_IMPORT_PROCESSING_MS,
} from "@/src/lib/lore-import-job-process";
import { loreImportPlanSchema } from "@/src/lib/lore-import-plan-types";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ jobId: string }> };

type LoreImportJobProgressPayload = {
  phase?: string;
  step?: number;
  total?: number;
  message?: string;
  meta?: Record<string, unknown>;
  updatedAt?: string;
};

type LoreImportJobView = {
  id: string;
  spaceId: string;
  status: string;
  plan: unknown;
  error: string | null;
  updatedAt: Date | null;
  progressPhase?: string | null;
  progressStep?: number | null;
  progressTotal?: number | null;
  progressMessage?: string | null;
  progressMeta?: Record<string, unknown> | null;
  lastProgressAt?: Date | null;
};

function coerceOptionalInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function normalizeProgressMeta(meta: unknown): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = { ...(meta as Record<string, unknown>) };
  const p = coerceOptionalInt(m.pipelinePercent);
  if (p !== null) {
    m.pipelinePercent = Math.max(0, Math.min(100, p));
  } else {
    delete m.pipelinePercent;
  }
  return m;
}

function isMissingProgressColumnsError(error: unknown): boolean {
  const source =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = String(source.code ?? "").trim();
  const column = String(source.column ?? "").toLowerCase();
  const message = String(source.message ?? "").toLowerCase();
  const mentionsProgressColumn =
    column.startsWith("progress_") ||
    column === "last_progress_at" ||
    message.includes("progress_") ||
    message.includes("last_progress_at");
  if (!mentionsProgressColumn) return false;
  return !code || code === "42703" || code === "42P01";
}

function normalizeJobProgress(
  job: LoreImportJobView,
): LoreImportJobProgressPayload | undefined {
  const step = coerceOptionalInt(job.progressStep);
  const total = coerceOptionalInt(job.progressTotal);
  const hasProgress =
    Boolean(job.progressPhase) ||
    step !== null ||
    total !== null ||
    Boolean(job.progressMessage) ||
    Boolean(job.progressMeta);
  if (!hasProgress) return undefined;
  return {
    phase: job.progressPhase ?? undefined,
    step: step ?? undefined,
    total: total ?? undefined,
    message: job.progressMessage ?? undefined,
    meta: normalizeProgressMeta(job.progressMeta),
    updatedAt: job.lastProgressAt ? job.lastProgressAt.toISOString() : undefined,
  };
}

function readFailedMeta(
  job: LoreImportJobView,
): { errorCode?: string; lastPhase?: string } {
  const meta = (job.progressMeta as Record<string, unknown> | null) ?? null;
  return {
    errorCode: typeof meta?.errorCode === "string" ? meta.errorCode : undefined,
    lastPhase:
      typeof meta?.lastPhase === "string"
        ? meta.lastPhase
        : (job.progressPhase ?? undefined),
  };
}

export async function GET(req: Request, ctx: RouteCtx) {
  const attemptId = req.headers.get("x-heartgarden-import-attempt")?.trim() || "unknown";
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  const { jobId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return Response.json({ ok: false, error: "Invalid job id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const spaceId = url.searchParams.get("spaceId")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(spaceId)) {
    return Response.json(
      { ok: false, error: "Query parameter spaceId (uuid) is required" },
      { status: 400 },
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }

  const [baseJob] = await db
    .select({
      id: loreImportJobs.id,
      spaceId: loreImportJobs.spaceId,
      status: loreImportJobs.status,
      plan: loreImportJobs.plan,
      error: loreImportJobs.error,
      updatedAt: loreImportJobs.updatedAt,
    })
    .from(loreImportJobs)
    .where(eq(loreImportJobs.id, jobId))
    .limit(1);
  let job: LoreImportJobView | null = baseJob ?? null;
  const canExecuteSql = typeof (db as { execute?: unknown }).execute === "function";
  if (job && canExecuteSql) {
    try {
      const progressRows = await db.execute(sql`
        select
          progress_phase,
          progress_step,
          progress_total,
          progress_message,
          progress_meta,
          last_progress_at
        from "lore_import_jobs"
        where "id" = ${jobId}
        limit 1
      `);
      const row = (progressRows as { rows?: Record<string, unknown>[] })?.rows?.[0];
      if (row) {
        job = {
          ...job,
          progressPhase:
            typeof row.progress_phase === "string" ? row.progress_phase : null,
          progressStep: coerceOptionalInt(row.progress_step),
          progressTotal: coerceOptionalInt(row.progress_total),
          progressMessage:
            typeof row.progress_message === "string" ? row.progress_message : null,
          progressMeta:
            row.progress_meta && typeof row.progress_meta === "object"
              ? (row.progress_meta as Record<string, unknown>)
              : null,
          lastProgressAt:
            row.last_progress_at instanceof Date
              ? row.last_progress_at
              : null,
        };
      }
    } catch (error) {
      if (!isMissingProgressColumnsError(error)) throw error;
    }
  }

  if (!job || job.spaceId !== spaceId) {
    return Response.json({ ok: false, error: "Job not found" }, { status: 404 });
  }
  if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  if (job.status === "processing" && job.updatedAt) {
    const staleBefore = new Date(Date.now() - STALE_LORE_IMPORT_PROCESSING_MS);
    if (job.updatedAt < staleBefore) {
      scheduleLoreImportJobProcessing(jobId);
    }
  }

  if (job.status === "ready" && job.plan) {
    const parsed = loreImportPlanSchema.safeParse(job.plan);
    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          status: "failed",
          error: "Stored plan failed validation",
          errorCode: "lore_import_plan_validation_failed",
          progress: normalizeJobProgress(job),
        },
        { status: 500 },
      );
    }
    return Response.json({
      ok: true,
      attemptId,
      status: job.status,
      plan: parsed.data,
      progress: normalizeJobProgress(job),
    });
  }

  if (job.status === "ready" && !job.plan) {
    return Response.json(
      {
        ok: false,
        status: "failed",
        error: "Job is ready but plan data is missing",
        errorCode: "lore_import_plan_missing",
        progress: normalizeJobProgress(job),
      },
      { status: 500 },
    );
  }

  if (job.status === "failed" && job.error) {
    console.error("[lore-import] job failed", {
      attemptId,
      jobId: job.id,
      spaceId: job.spaceId,
      error: job.error,
    });
  }

  const progress = normalizeJobProgress(job);
  const failedMeta = job.status === "failed" ? readFailedMeta(job) : {};
  return Response.json({
    ok: true,
    attemptId,
    status: job.status,
    ...(progress ? { progress } : {}),
    ...(job.status === "failed"
      ? {
          error: job.error || "Import job failed",
          code: "lore_import_job_failed",
          errorCode: failedMeta.errorCode,
          lastPhase: failedMeta.lastPhase,
        }
      : {}),
  });
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const attemptId = req.headers.get("x-heartgarden-import-attempt")?.trim() || "unknown";
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  const { jobId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return Response.json({ ok: false, error: "Invalid job id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const spaceId = url.searchParams.get("spaceId")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(spaceId)) {
    return Response.json(
      { ok: false, error: "Query parameter spaceId (uuid) is required" },
      { status: 400 },
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }
  if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const [job] = await db
    .select({
      id: loreImportJobs.id,
      spaceId: loreImportJobs.spaceId,
      status: loreImportJobs.status,
    })
    .from(loreImportJobs)
    .where(eq(loreImportJobs.id, jobId))
    .limit(1);

  if (!job || job.spaceId !== spaceId) {
    return Response.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  if (job.status === "ready" || job.status === "failed" || job.status === "cancelled") {
    return Response.json({
      ok: true,
      attemptId,
      jobId,
      status: job.status,
      cancelled: job.status === "cancelled",
      mutable: false,
    });
  }

  const now = new Date();
  await db
    .update(loreImportJobs)
    .set({
      status: "cancelled",
      error: "Cancelled by user",
      updatedAt: now,
    })
    .where(eq(loreImportJobs.id, jobId));

  return Response.json({
    ok: true,
    attemptId,
    jobId,
    status: "cancelled",
    cancelled: true,
    mutable: true,
  });
}
