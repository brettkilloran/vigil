import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { loreImportJobs } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { scheduleLoreImportJobProcessing } from "@/src/lib/lore-import-job-after";
import { processLoreImportJob } from "@/src/lib/lore-import-job-process";
import { loreImportUserContextSchema } from "@/src/lib/lore-import-plan-types";
import { assertSpaceExists } from "@/src/lib/spaces";

export const runtime = "nodejs";

/** Smart-import planning runs in `after()`; allow enough time on Vercel for long documents. */
export const maxDuration = 300;

const bodySchema = z.object({
  text: z.string().min(1).max(2_000_000),
  spaceId: z.string().uuid(),
  fileName: z.string().max(512).optional(),
  userContext: loreImportUserContextSchema.optional(),
});

function importAttemptId(req: Request): string {
  return req.headers.get("x-heartgarden-import-attempt")?.trim() || "unknown";
}

type DbInsertDiagnostic = {
  message?: string;
  code?: string;
  detail?: string;
  hint?: string;
  severity?: string;
  table?: string;
  column?: string;
  constraint?: string;
  routine?: string;
  retryable?: boolean;
};

function clipped(value: unknown, max = 280): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function readDbInsertDiagnostic(error: unknown): DbInsertDiagnostic {
  const source =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = clipped(source.code, 24);
  const retryableCodes = new Set([
    "40001", // serialization_failure
    "40P01", // deadlock_detected
    "53300", // too_many_connections
    "57P01", // admin_shutdown
    "57014", // query_canceled
    "08000", // connection_exception
    "08001", // sqlclient_unable_to_establish_sqlconnection
    "08006", // connection_failure
    "08P01", // protocol_violation
  ]);
  return {
    message:
      clipped(source.message) ||
      (error instanceof Error ? clipped(error.message) : clipped(String(error))),
    code,
    detail: clipped(source.detail),
    hint: clipped(source.hint),
    severity: clipped(source.severity, 64),
    table: clipped(source.table, 128),
    column: clipped(source.column, 128),
    constraint: clipped(source.constraint, 128),
    routine: clipped(source.routine, 128),
    retryable: Boolean(code && retryableCodes.has(code)),
  };
}

function isMissingProgressColumnsDiagnostic(diag: DbInsertDiagnostic): boolean {
  const code = String(diag.code || "").trim();
  const column = String(diag.column || "").toLowerCase();
  const text = `${diag.message || ""} ${diag.detail || ""}`.toLowerCase();
  const mentionsProgressColumn =
    column.startsWith("progress_") ||
    column === "last_progress_at" ||
    column === "user_context" ||
    text.includes("progress_") ||
    text.includes("last_progress_at") ||
    text.includes("user_context");
  if (!mentionsProgressColumn) return false;
  if (!code) return true;
  if (code === "42703") return true;
  if (code === "42P01" && text.includes("lore_import_jobs")) return true;
  return false;
}

function loreImportJobsLegacySchemaFallbackEnabled(): boolean {
  const v = (process.env.HEARTGARDEN_IMPORT_JOBS_LEGACY_SCHEMA_FALLBACK ?? "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export async function POST(req: Request) {
  const attemptId = importAttemptId(req);
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
  } catch (error) {
    console.error("[lore-import] jobs invalid json", {
      attemptId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Invalid request body";
    return Response.json(
      { ok: false, error: parsed.error.flatten(), hint: firstIssue },
      { status: 400 },
    );
  }
  console.info("[lore-import] jobs create request", {
    attemptId,
    spaceId: parsed.data.spaceId,
    textChars: parsed.data.text.length,
    fileName: parsed.data.fileName ?? null,
    granularity: parsed.data.userContext?.granularity ?? null,
    orgMode: parsed.data.userContext?.orgMode ?? null,
  });

  const space = await assertSpaceExists(db, parsed.data.spaceId);
  if (!space) {
    return Response.json({ ok: false, error: "Space not found" }, { status: 404 });
  }
  if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, parsed.data.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const jobId = randomUUID();
  const importBatchId = randomUUID();
  const now = new Date();

  try {
    await db.insert(loreImportJobs).values({
      id: jobId,
      spaceId: parsed.data.spaceId,
      importBatchId,
      status: "queued",
      sourceText: parsed.data.text,
      fileName: parsed.data.fileName ?? null,
      userContext:
        parsed.data.userContext != null
          ? (parsed.data.userContext as unknown as Record<string, unknown>)
          : null,
      plan: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    const diag = readDbInsertDiagnostic(error);
    if (isMissingProgressColumnsDiagnostic(diag) && loreImportJobsLegacySchemaFallbackEnabled()) {
      console.warn("[lore-import] jobs insert using legacy schema fallback", {
        attemptId,
        spaceId: parsed.data.spaceId,
        dbCode: diag.code,
        dbColumn: diag.column,
      });
      try {
        await db.execute(sql`
          insert into "lore_import_jobs" (
            "id",
            "space_id",
            "import_batch_id",
            "status",
            "source_text",
            "file_name",
            "plan",
            "error",
            "created_at",
            "updated_at"
          ) values (
            ${jobId},
            ${parsed.data.spaceId},
            ${importBatchId},
            ${"queued"},
            ${parsed.data.text},
            ${parsed.data.fileName ?? null},
            ${null},
            ${null},
            ${now},
            ${now}
          )
        `);
      } catch (legacyError) {
        const legacyDiag = readDbInsertDiagnostic(legacyError);
        console.error("[lore-import] jobs legacy insert failed", {
          attemptId,
          spaceId: parsed.data.spaceId,
          ...legacyDiag,
          stack: legacyError instanceof Error ? clipped(legacyError.stack, 1200) : undefined,
        });
        return Response.json(
          {
            ok: false,
            error: "Could not persist import job",
            errorCode: "lore_import_job_persist_failed",
            detail:
              legacyDiag.detail ||
              legacyDiag.message ||
              "Insert into lore_import_jobs failed before background planning could start.",
            hint: "Run lore-import migrations so progress columns exist, then retry import.",
            operation: "insert lore_import_jobs",
            dbCode: legacyDiag.code,
            dbSeverity: legacyDiag.severity,
            dbTable: legacyDiag.table,
            dbColumn: legacyDiag.column,
            dbConstraint: legacyDiag.constraint,
            dbRoutine: legacyDiag.routine,
            retryable: legacyDiag.retryable ?? false,
            attemptId,
          },
          { status: 500 },
        );
      }
    } else {
    console.error("[lore-import] jobs insert failed", {
      attemptId,
      spaceId: parsed.data.spaceId,
      ...diag,
      stack: error instanceof Error ? clipped(error.stack, 1200) : undefined,
    });
    return Response.json(
      {
        ok: false,
        error: "Could not persist import job",
        errorCode: "lore_import_job_persist_failed",
        detail:
          diag.detail ||
          diag.message ||
          "Insert into lore_import_jobs failed before background planning could start.",
        hint:
          diag.hint ||
          (isMissingProgressColumnsDiagnostic(diag)
            ? "Run lore-import migrations so progress columns exist, or set HEARTGARDEN_IMPORT_JOBS_LEGACY_SCHEMA_FALLBACK=1 as a temporary compatibility escape hatch."
            : "Check migrations/schema for lore import and presence tables."),
        operation: "insert lore_import_jobs",
        dbCode: diag.code,
        dbSeverity: diag.severity,
        dbTable: diag.table,
        dbColumn: diag.column,
        dbConstraint: diag.constraint,
        dbRoutine: diag.routine,
        retryable: diag.retryable ?? false,
        attemptId,
      },
      { status: 500 },
    );
    }
  }

  let queueMode: "after" | "inline_fallback" = "after";
  try {
    scheduleLoreImportJobProcessing(jobId);
  } catch (error) {
    queueMode = "inline_fallback";
    console.error("[lore-import] jobs schedule failed; running inline fallback", {
      attemptId,
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    void processLoreImportJob(jobId).catch((processError) => {
      console.error("[lore-import] inline fallback processing failed", {
        attemptId,
        jobId,
        error: processError instanceof Error ? processError.message : String(processError),
      });
    });
  }

  return Response.json({
    ok: true,
    attemptId,
    jobId,
    importBatchId,
    status: "queued",
    queueMode,
  });
}
