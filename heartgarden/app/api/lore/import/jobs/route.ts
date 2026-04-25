import { randomUUID } from "node:crypto";

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
import {
  clipLoreImportJobInsertString,
  isLoreImportJobSchemaLagError,
  type LoreImportJobInsertDiagnostic,
  readLoreImportJobInsertDiagnostic,
} from "@/src/lib/lore-import-job-db-insert-helpers";
import { processLoreImportJob } from "@/src/lib/lore-import-job-process";
import { loreImportUserContextSchema } from "@/src/lib/lore-import-plan-types";
import { assertSpaceExists } from "@/src/lib/spaces";

export const runtime = "nodejs";

/** Smart-import planning runs in `after()`; allow enough time on Vercel for long documents. */
export const maxDuration = 300;

const bodySchema = z.object({
  fileName: z.string().max(512).optional(),
  spaceId: z.string().uuid(),
  text: z.string().min(1).max(2_000_000),
  userContext: loreImportUserContextSchema.optional(),
});

function importAttemptId(req: Request): string {
  return req.headers.get("x-heartgarden-import-attempt")?.trim() || "unknown";
}

type DbInsertDiagnostic = LoreImportJobInsertDiagnostic;

function clipped(value: unknown, max = 280): string | undefined {
  return clipLoreImportJobInsertString(value, max);
}

function readDbInsertDiagnostic(error: unknown): DbInsertDiagnostic {
  return readLoreImportJobInsertDiagnostic(error);
}

function isMissingProgressColumnsDiagnostic(diag: DbInsertDiagnostic): boolean {
  return isLoreImportJobSchemaLagError(diag);
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
  if (denied) {
    return denied;
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
  } catch (error) {
    console.error("[lore-import] jobs invalid json", {
      attemptId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Invalid JSON", ok: false }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const firstIssue =
      parsed.error.issues[0]?.message ?? "Invalid request body";
    return Response.json(
      { error: parsed.error.flatten(), hint: firstIssue, ok: false },
      { status: 400 }
    );
  }
  console.info("[lore-import] jobs create request", {
    attemptId,
    fileName: parsed.data.fileName ?? null,
    granularity: parsed.data.userContext?.granularity ?? null,
    orgMode: parsed.data.userContext?.orgMode ?? null,
    spaceId: parsed.data.spaceId,
    textChars: parsed.data.text.length,
  });

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

  const jobId = randomUUID();
  const importBatchId = randomUUID();
  const now = new Date();

  try {
    await db.insert(loreImportJobs).values({
      createdAt: now,
      error: null,
      fileName: parsed.data.fileName ?? null,
      id: jobId,
      importBatchId,
      plan: null,
      sourceText: parsed.data.text,
      spaceId: parsed.data.spaceId,
      status: "queued",
      updatedAt: now,
      userContext:
        parsed.data.userContext == null
          ? null
          : (parsed.data.userContext as unknown as Record<string, unknown>),
    });
  } catch (error) {
    const diag = readDbInsertDiagnostic(error);
    if (
      isMissingProgressColumnsDiagnostic(diag) &&
      loreImportJobsLegacySchemaFallbackEnabled()
    ) {
      console.warn("[lore-import] jobs insert using legacy schema fallback", {
        attemptId,
        dbCode: diag.code,
        dbColumn: diag.column,
        spaceId: parsed.data.spaceId,
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
          stack:
            legacyError instanceof Error
              ? clipped(legacyError.stack, 1200)
              : undefined,
        });
        return Response.json(
          {
            attemptId,
            dbCode: legacyDiag.code,
            dbColumn: legacyDiag.column,
            dbConstraint: legacyDiag.constraint,
            dbRoutine: legacyDiag.routine,
            dbSeverity: legacyDiag.severity,
            dbTable: legacyDiag.table,
            detail:
              legacyDiag.detail ||
              legacyDiag.message ||
              "Insert into lore_import_jobs failed before background planning could start.",
            error: "Could not persist import job",
            errorCode: "lore_import_job_persist_failed",
            hint: "Run lore-import migrations so progress columns exist, then retry import.",
            ok: false,
            operation: "insert lore_import_jobs",
            retryable: legacyDiag.retryable ?? false,
          },
          { status: 500 }
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
          attemptId,
          dbCode: diag.code,
          dbColumn: diag.column,
          dbConstraint: diag.constraint,
          dbRoutine: diag.routine,
          dbSeverity: diag.severity,
          dbTable: diag.table,
          detail:
            diag.detail ||
            diag.message ||
            "Insert into lore_import_jobs failed before background planning could start.",
          error: "Could not persist import job",
          errorCode: "lore_import_job_persist_failed",
          hint:
            diag.hint ||
            (isMissingProgressColumnsDiagnostic(diag)
              ? "Run lore-import migrations so progress columns exist, or set HEARTGARDEN_IMPORT_JOBS_LEGACY_SCHEMA_FALLBACK=1 as a temporary compatibility escape hatch."
              : "Check migrations/schema for lore import and presence tables."),
          ok: false,
          operation: "insert lore_import_jobs",
          retryable: diag.retryable ?? false,
        },
        { status: 500 }
      );
    }
  }

  let queueMode: "after" | "inline_fallback" = "after";
  try {
    scheduleLoreImportJobProcessing(jobId);
  } catch (error) {
    queueMode = "inline_fallback";
    console.error(
      "[lore-import] jobs schedule failed; running inline fallback",
      {
        attemptId,
        error: error instanceof Error ? error.message : String(error),
        jobId,
      }
    );
    void processLoreImportJob(jobId).catch((processError) => {
      console.error("[lore-import] inline fallback processing failed", {
        attemptId,
        error:
          processError instanceof Error
            ? processError.message
            : String(processError),
        jobId,
      });
    });
  }

  return Response.json({
    attemptId,
    importBatchId,
    jobId,
    ok: true,
    queueMode,
    status: "queued",
  });
}
