/**
 * Shared helpers for inserting into `lore_import_jobs` when the DB may be on an
 * older schema (optional columns, legacy deployments).
 */
export type LoreImportJobInsertErrorDiag = {
  message?: string;
  code?: string;
  column?: string;
  detail?: string;
};

function clipped(value: unknown, max = 280): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function readLoreImportJobInsertError(error: unknown): LoreImportJobInsertErrorDiag {
  const source =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  return {
    message:
      clipped(source.message) ||
      (error instanceof Error ? clipped(error.message) : clipped(String(error))),
    code: clipped(source.code, 24),
    column: clipped(source.column, 128),
    detail: clipped(source.detail),
  };
}

/**
 * True when a full Drizzle insert into `lore_import_jobs` failed because optional
 * columns (progress, `user_context`, etc.) or the table is missing in part.
 * Matches the heuristic used in `app/api/lore/import/jobs/route.ts`.
 */
export function isLoreImportJobSchemaLagError(diag: LoreImportJobInsertErrorDiag): boolean {
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
  if (!mentionsOptionalColumn) return false;
  if (!code) return true;
  if (code === "42703") return true;
  if (code === "42P01" && text.includes("lore_import_jobs")) return true;
  return false;
}
