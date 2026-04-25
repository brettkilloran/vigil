/**
 * Shared helpers for inserting into `lore_import_jobs` when the DB may be on an
 * older schema (optional columns, legacy deployments).
 *
 * Background-job code (`lore-import-job-process.ts`) reads minimal diagnostics
 * via {@link readLoreImportJobInsertError}. The HTTP route
 * (`app/api/lore/import/jobs/route.ts`) needs richer fields (hint, severity,
 * table, constraint, routine, retryable) to surface in error responses; that
 * superset is exposed via {@link readLoreImportJobInsertDiagnostic}. Schema-lag
 * detection is single-source via {@link isLoreImportJobSchemaLagError}.
 */
export interface LoreImportJobInsertErrorDiag {
  code?: string;
  column?: string;
  detail?: string;
  message?: string;
}

export type LoreImportJobInsertDiagnostic = LoreImportJobInsertErrorDiag & {
  hint?: string;
  severity?: string;
  table?: string;
  constraint?: string;
  routine?: string;
  retryable?: boolean;
};

const LORE_IMPORT_JOB_RETRYABLE_PG_CODES = new Set<string>([
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

function clipped(value: unknown, max = 280): string | undefined {
  if (typeof value !== "string") {
    return;
  }
  const text = value.trim();
  if (!text) {
    return;
  }
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function clipLoreImportJobInsertString(
  value: unknown,
  max = 280
): string | undefined {
  return clipped(value, max);
}

export function readLoreImportJobInsertError(
  error: unknown
): LoreImportJobInsertErrorDiag {
  const source =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  return {
    code: clipped(source.code, 24),
    column: clipped(source.column, 128),
    detail: clipped(source.detail),
    message:
      clipped(source.message) ||
      (error instanceof Error
        ? clipped(error.message)
        : clipped(String(error))),
  };
}

export function readLoreImportJobInsertDiagnostic(
  error: unknown
): LoreImportJobInsertDiagnostic {
  const base = readLoreImportJobInsertError(error);
  const source =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  const code = base.code;
  return {
    ...base,
    constraint: clipped(source.constraint, 128),
    hint: clipped(source.hint),
    retryable: Boolean(code && LORE_IMPORT_JOB_RETRYABLE_PG_CODES.has(code)),
    routine: clipped(source.routine, 128),
    severity: clipped(source.severity, 64),
    table: clipped(source.table, 128),
  };
}

/**
 * True when a full Drizzle insert into `lore_import_jobs` failed because optional
 * columns (progress, `user_context`, etc.) or the table is missing in part.
 * Matches the heuristic used in `app/api/lore/import/jobs/route.ts`.
 */
export function isLoreImportJobSchemaLagError(
  diag: LoreImportJobInsertErrorDiag
): boolean {
  const code = String(diag.code || "").trim();
  const column = String(diag.column || "").toLowerCase();
  const text = `${diag.message || ""} ${diag.detail || ""}`.toLowerCase();
  const mentionsOptionalColumn =
    column.startsWith("progress_") ||
    column === "last_progress_at" ||
    column === "user_context" ||
    column === "progress_events" ||
    text.includes("progress_") ||
    text.includes("last_progress_at") ||
    text.includes("user_context") ||
    text.includes("progress_events");
  if (!mentionsOptionalColumn) {
    return false;
  }
  if (!code) {
    return true;
  }
  if (code === "42703") {
    return true;
  }
  if (code === "42P01" && text.includes("lore_import_jobs")) {
    return true;
  }
  return false;
}
