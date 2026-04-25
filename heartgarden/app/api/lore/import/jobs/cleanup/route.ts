import { and, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { loreImportJobs } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";

export const runtime = "nodejs";

/**
 * `lore_import_jobs` retains the entire `source_text` (up to ~2MB per row) and the
 * full plan JSON for every import attempt forever. Power users importing daily
 * would balloon this table to gigabytes within months. This route provides a
 * GM-gated TTL prune that:
 *
 * 1. Redacts large columns (`source_text`, `plan`, `progress_events`,
 *    `progress_meta`) on terminal jobs older than `redactAfterDays` (default 7).
 *    The job row stays so the UI can still show "this import existed".
 * 2. Deletes terminal jobs entirely once they exceed `purgeAfterDays`
 *    (default 30) — past this point they are no longer audit-useful.
 *
 * Auth: GM-only via the standard boot context (or the
 * `Authorization: Bearer <MCP_SERVICE_KEY>` admin path). Safe to call
 * idempotently from cron or by hand.
 *
 * (`REVIEW_2026-04-25_1835` H11.)
 */

const TERMINAL_STATUSES = ["applied", "cancelled", "failed"] as const;
const DEFAULT_REDACT_DAYS = 7;
const DEFAULT_PURGE_DAYS = 30;
/** Hard ceiling on a single sweep so we never lock the table for minutes. */
const MAX_ROWS_PER_SWEEP = 5000;

const bodySchema = z.object({
  /** Days after a terminal job's `updated_at` to redact large columns. */
  redactAfterDays: z.number().int().min(1).max(365).optional(),
  /** Days after a terminal job's `updated_at` to delete the row entirely. */
  purgeAfterDays: z.number().int().min(1).max(3650).optional(),
  /** When true, return what would change without writing. */
  dryRun: z.boolean().optional(),
});

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function POST(req: Request) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) {
    return denied;
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  let json: unknown = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) {
      json = JSON.parse(text);
    }
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "Invalid JSON",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const redactAfterDays = parsed.data.redactAfterDays ?? DEFAULT_REDACT_DAYS;
  const purgeAfterDays = parsed.data.purgeAfterDays ?? DEFAULT_PURGE_DAYS;
  if (redactAfterDays > purgeAfterDays) {
    return Response.json(
      {
        ok: false,
        error: "redactAfterDays must be <= purgeAfterDays",
      },
      { status: 400 }
    );
  }
  const dryRun = parsed.data.dryRun === true;

  const redactCutoff = daysAgo(redactAfterDays);
  const purgeCutoff = daysAgo(purgeAfterDays);

  const purgeCandidates = await db
    .select({ id: loreImportJobs.id })
    .from(loreImportJobs)
    .where(
      and(
        inArray(loreImportJobs.status, [...TERMINAL_STATUSES]),
        lt(loreImportJobs.updatedAt, purgeCutoff)
      )
    )
    .limit(MAX_ROWS_PER_SWEEP);

  const redactCandidates = await db
    .select({ id: loreImportJobs.id })
    .from(loreImportJobs)
    .where(
      and(
        inArray(loreImportJobs.status, [...TERMINAL_STATUSES]),
        lt(loreImportJobs.updatedAt, redactCutoff),
        // Only redact rows that still hold non-empty source text — otherwise
        // we churn updated_at on already-pruned rows.
        sql`length(${loreImportJobs.sourceText}) > 0`
      )
    )
    .limit(MAX_ROWS_PER_SWEEP);

  if (dryRun) {
    return Response.json({
      ok: true,
      dryRun: true,
      redactAfterDays,
      purgeAfterDays,
      redactCandidates: redactCandidates.length,
      purgeCandidates: purgeCandidates.length,
    });
  }

  let purged = 0;
  if (purgeCandidates.length > 0) {
    const ids = purgeCandidates.map((r) => r.id);
    const result = await db.execute(sql`
      DELETE FROM "lore_import_jobs"
      WHERE "id" = ANY(${ids}::uuid[])
    `);
    const rowCount =
      (result as unknown as { rowCount?: number | null }).rowCount ?? null;
    purged = typeof rowCount === "number" ? rowCount : ids.length;
  }

  let redacted = 0;
  if (redactCandidates.length > 0) {
    const ids = redactCandidates.map((r) => r.id);
    const result = await db.execute(sql`
      UPDATE "lore_import_jobs"
      SET
        "source_text" = '',
        "plan" = NULL,
        "progress_events" = NULL,
        "progress_meta" = NULL
      WHERE "id" = ANY(${ids}::uuid[])
    `);
    const rowCount =
      (result as unknown as { rowCount?: number | null }).rowCount ?? null;
    redacted = typeof rowCount === "number" ? rowCount : ids.length;
  }

  console.info("[lore-import] jobs cleanup", {
    redactAfterDays,
    purgeAfterDays,
    redacted,
    purged,
  });

  return Response.json({
    ok: true,
    dryRun: false,
    redactAfterDays,
    purgeAfterDays,
    redacted,
    purged,
  });
}
