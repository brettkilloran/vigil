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
import { STALE_LORE_IMPORT_PROCESSING_MS } from "@/src/lib/lore-import-job-process";
import { loreImportPlanSchema } from "@/src/lib/lore-import-plan-types";

export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{ jobId: string }>;
}

interface LoreImportJobProgressPayload {
  message?: string;
  meta?: Record<string, unknown>;
  phase?: string;
  step?: number;
  total?: number;
  updatedAt?: string;
}

interface LoreImportJobEventPayload {
  durationMs?: number;
  kind:
    | "phase_start"
    | "phase_end"
    | "llm_call"
    | "vault_search"
    | "warning"
    | "note";
  model?: string;
  phase?: string;
  ref?: string;
  responseSnippet?: string;
  stopReason?: string;
  text?: string;
  tokensIn?: number;
  tokensOut?: number;
  ts?: string;
}

interface LoreImportJobView {
  error: string | null;
  id: string;
  lastProgressAt?: Date | null;
  plan: unknown;
  progressEvents?: unknown[] | null;
  progressMessage?: string | null;
  progressMeta?: Record<string, unknown> | null;
  progressPhase?: string | null;
  progressStep?: number | null;
  progressTotal?: number | null;
  spaceId: string;
  status: string;
  updatedAt: Date | null;
}

const LORE_IMPORT_PROGRESS_EVENTS_LIMIT = 500;

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

function normalizeProgressMeta(
  meta: unknown
): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== "object") {
    return;
  }
  const m = { ...(meta as Record<string, unknown>) };
  const p = coerceOptionalInt(m.pipelinePercent);
  if (p === null) {
    m.pipelinePercent = undefined;
  } else {
    m.pipelinePercent = Math.max(0, Math.min(100, p));
  }
  return m;
}

function normalizeJobEvent(event: unknown): LoreImportJobEventPayload | null {
  if (!event || typeof event !== "object") {
    return null;
  }
  const row = event as Record<string, unknown>;
  const kind = String(row.kind ?? "").trim();
  if (
    kind !== "phase_start" &&
    kind !== "phase_end" &&
    kind !== "llm_call" &&
    kind !== "vault_search" &&
    kind !== "warning" &&
    kind !== "note"
  ) {
    return null;
  }
  const out: LoreImportJobEventPayload = { kind };
  const ts = String(row.ts ?? "").trim();
  if (ts) {
    out.ts = ts.slice(0, 64);
  }
  const phase = String(row.phase ?? "").trim();
  if (phase) {
    out.phase = phase.slice(0, 64);
  }
  const model = String(row.model ?? "").trim();
  if (model) {
    out.model = model.slice(0, 128);
  }
  const stopReason = String(row.stopReason ?? "").trim();
  if (stopReason) {
    out.stopReason = stopReason.slice(0, 64);
  }
  const responseSnippet = String(row.responseSnippet ?? "").trim();
  if (responseSnippet) {
    out.responseSnippet = responseSnippet.slice(0, 2000);
  }
  const text = String(row.text ?? "").trim();
  if (text) {
    out.text = text.slice(0, 280);
  }
  const ref = String(row.ref ?? "").trim();
  if (ref) {
    out.ref = ref.slice(0, 128);
  }
  const durationMs = coerceOptionalInt(row.durationMs);
  if (durationMs !== null && durationMs >= 0) {
    out.durationMs = durationMs;
  }
  const tokensIn = coerceOptionalInt(row.tokensIn);
  if (tokensIn !== null && tokensIn >= 0) {
    out.tokensIn = tokensIn;
  }
  const tokensOut = coerceOptionalInt(row.tokensOut);
  if (tokensOut !== null && tokensOut >= 0) {
    out.tokensOut = tokensOut;
  }
  return out;
}

function normalizeJobEvents(
  events: unknown,
  opts?: { running?: boolean }
): LoreImportJobEventPayload[] {
  if (!Array.isArray(events)) {
    return [];
  }
  const normalized = events
    .map((entry) => normalizeJobEvent(entry))
    .filter((entry): entry is LoreImportJobEventPayload => Boolean(entry));
  if (!opts?.running) {
    return normalized;
  }
  if (normalized.length <= LORE_IMPORT_PROGRESS_EVENTS_LIMIT) {
    return normalized;
  }
  return normalized.slice(
    normalized.length - LORE_IMPORT_PROGRESS_EVENTS_LIMIT
  );
}

function isMissingProgressColumnsError(error: unknown): boolean {
  const source =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  const code = String(source.code ?? "").trim();
  const column = String(source.column ?? "").toLowerCase();
  const message = String(source.message ?? "").toLowerCase();
  const mentionsProgressColumn =
    column.startsWith("progress_") ||
    column === "last_progress_at" ||
    column === "progress_events" ||
    message.includes("progress_") ||
    message.includes("last_progress_at") ||
    message.includes("progress_events");
  if (!mentionsProgressColumn) {
    return false;
  }
  return !code || code === "42703" || code === "42P01";
}

function normalizeJobProgress(
  job: LoreImportJobView
): LoreImportJobProgressPayload | undefined {
  const step = coerceOptionalInt(job.progressStep);
  const total = coerceOptionalInt(job.progressTotal);
  const hasProgress =
    Boolean(job.progressPhase) ||
    step !== null ||
    total !== null ||
    Boolean(job.progressMessage) ||
    Boolean(job.progressMeta);
  if (!hasProgress) {
    return;
  }
  return {
    message: job.progressMessage ?? undefined,
    meta: normalizeProgressMeta(job.progressMeta),
    phase: job.progressPhase ?? undefined,
    step: step ?? undefined,
    total: total ?? undefined,
    updatedAt: job.lastProgressAt
      ? job.lastProgressAt.toISOString()
      : undefined,
  };
}

function readFailedMeta(job: LoreImportJobView): {
  errorCode?: string;
  lastPhase?: string;
} {
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
  const attemptId =
    req.headers.get("x-heartgarden-import-attempt")?.trim() || "unknown";
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) {
    return denied;
  }

  const { jobId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return Response.json(
      { error: "Invalid job id", ok: false },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const spaceId = url.searchParams.get("spaceId")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(spaceId)) {
    return Response.json(
      { error: "Query parameter spaceId (uuid) is required", ok: false },
      { status: 400 }
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }

  const [baseJob] = await db
    .select({
      error: loreImportJobs.error,
      id: loreImportJobs.id,
      plan: loreImportJobs.plan,
      progressEvents: loreImportJobs.progressEvents,
      spaceId: loreImportJobs.spaceId,
      status: loreImportJobs.status,
      updatedAt: loreImportJobs.updatedAt,
    })
    .from(loreImportJobs)
    .where(eq(loreImportJobs.id, jobId))
    .limit(1);
  let job: LoreImportJobView | null = baseJob ?? null;
  const canExecuteSql =
    typeof (db as { execute?: unknown }).execute === "function";
  if (job && canExecuteSql) {
    try {
      const progressRows = await db.execute(sql`
        select
          progress_phase,
          progress_step,
          progress_total,
          progress_message,
          progress_meta,
          progress_events,
          last_progress_at
        from "lore_import_jobs"
        where "id" = ${jobId}
        limit 1
      `);
      const row = (progressRows as { rows?: Record<string, unknown>[] })
        ?.rows?.[0];
      if (row) {
        job = {
          ...job,
          lastProgressAt:
            row.last_progress_at instanceof Date ? row.last_progress_at : null,
          progressEvents: Array.isArray(row.progress_events)
            ? (row.progress_events as unknown[])
            : null,
          progressMessage:
            typeof row.progress_message === "string"
              ? row.progress_message
              : null,
          progressMeta:
            row.progress_meta && typeof row.progress_meta === "object"
              ? (row.progress_meta as Record<string, unknown>)
              : null,
          progressPhase:
            typeof row.progress_phase === "string" ? row.progress_phase : null,
          progressStep: coerceOptionalInt(row.progress_step),
          progressTotal: coerceOptionalInt(row.progress_total),
        };
      }
    } catch (error) {
      if (!isMissingProgressColumnsError(error)) {
        throw error;
      }
    }
  }

  if (!job || job.spaceId !== spaceId) {
    return Response.json(
      { error: "Job not found", ok: false },
      { status: 404 }
    );
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
          error: "Stored plan failed validation",
          errorCode: "lore_import_plan_validation_failed",
          events: normalizeJobEvents(job.progressEvents, { running: false }),
          ok: false,
          progress: normalizeJobProgress(job),
          status: "failed",
        },
        { status: 500 }
      );
    }
    return Response.json({
      attemptId,
      events: normalizeJobEvents(job.progressEvents, { running: false }),
      ok: true,
      plan: parsed.data,
      progress: normalizeJobProgress(job),
      status: job.status,
    });
  }

  if (job.status === "ready" && !job.plan) {
    return Response.json(
      {
        error: "Job is ready but plan data is missing",
        errorCode: "lore_import_plan_missing",
        events: normalizeJobEvents(job.progressEvents, { running: false }),
        ok: false,
        progress: normalizeJobProgress(job),
        status: "failed",
      },
      { status: 500 }
    );
  }

  if (job.status === "failed" && job.error) {
    console.error("[lore-import] job failed", {
      attemptId,
      error: job.error,
      jobId: job.id,
      spaceId: job.spaceId,
    });
  }

  const progress = normalizeJobProgress(job);
  const running = job.status === "queued" || job.status === "processing";
  const events = normalizeJobEvents(job.progressEvents, { running });
  const failedMeta = job.status === "failed" ? readFailedMeta(job) : {};
  const exposeFailureDetail = process.env.HEARTGARDEN_DEBUG_ERRORS === "1";
  return Response.json({
    attemptId,
    ok: true,
    status: job.status,
    ...(progress ? { progress } : {}),
    ...(events.length > 0 ? { events } : {}),
    ...(job.status === "failed"
      ? {
          code: "lore_import_job_failed",
          error: exposeFailureDetail
            ? job.error || "Import job failed"
            : "Import job failed",
          errorCode: failedMeta.errorCode,
          lastPhase: failedMeta.lastPhase,
        }
      : {}),
  });
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const attemptId =
    req.headers.get("x-heartgarden-import-attempt")?.trim() || "unknown";
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) {
    return denied;
  }

  const { jobId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return Response.json(
      { error: "Invalid job id", ok: false },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const spaceId = url.searchParams.get("spaceId")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(spaceId)) {
    return Response.json(
      { error: "Query parameter spaceId (uuid) is required", ok: false },
      { status: 400 }
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
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
    return Response.json(
      { error: "Job not found", ok: false },
      { status: 404 }
    );
  }

  if (
    job.status === "ready" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
    return Response.json({
      attemptId,
      cancelled: job.status === "cancelled",
      jobId,
      mutable: false,
      ok: true,
      status: job.status,
    });
  }

  const now = new Date();
  await db
    .update(loreImportJobs)
    .set({
      error: "Cancelled by user",
      status: "cancelled",
      updatedAt: now,
    })
    .where(eq(loreImportJobs.id, jobId));

  return Response.json({
    attemptId,
    cancelled: true,
    jobId,
    mutable: true,
    ok: true,
    status: "cancelled",
  });
}
