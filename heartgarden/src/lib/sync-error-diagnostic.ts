/** Between summary line and paste block (match in {@link syncErrorSummaryLine}). */
export const SYNC_ERROR_DIAGNOSTIC_SEP = "\n---\n";

export type SyncFailureCause = "http" | "network" | "client";

export type SyncFailureDetail = {
  operation: string;
  /** HTTP status, or omit / 0 when no response (network failure). */
  httpStatus?: number;
  message: string;
  responseSnippet?: string;
  cause: SyncFailureCause;
};

function pageOrigin(): string {
  if (typeof window === "undefined" || !window.location?.origin) return "(ssr)";
  return window.location.origin;
}

/**
 * Full multi-line report for support / debugging (clipboard).
 * First segment (before the `---` block) is the short summary; see {@link syncErrorSummaryLine}.
 */
export function formatSyncFailureReport(
  detail: SyncFailureDetail,
  ctx: { cloudEnabled: boolean },
): string {
  const iso = new Date().toISOString();
  const status =
    detail.httpStatus != null && detail.httpStatus > 0
      ? detail.httpStatus
      : undefined;
  const lines = [
    detail.message.trim() || "Request failed",
    "---",
    "Heartgarden sync diagnostic (paste to support)",
    `time: ${iso}`,
    `page: ${pageOrigin()}`,
    `cloudEnabled: ${ctx.cloudEnabled}`,
    `operation: ${detail.operation}`,
    `cause: ${detail.cause}`,
  ];
  if (status != null) lines.push(`httpStatus: ${status}`);
  lines.push(`message: ${detail.message.trim() || "Request failed"}`);
  if (detail.responseSnippet?.trim()) {
    const s = detail.responseSnippet.trim();
    lines.push(`responseBody: ${s.length > 1200 ? `${s.slice(0, 1200)}…` : s}`);
  }
  return lines.join("\n");
}

/** One-line label for the status strip (before the diagnostic separator, if any). */
export function syncErrorSummaryLine(full: string | null | undefined): string {
  if (full == null || !full.trim()) return "";
  const t = full.trim();
  const idx = t.indexOf(SYNC_ERROR_DIAGNOSTIC_SEP);
  const head = idx >= 0 ? t.slice(0, idx).trim() : t.split("\n")[0]?.trim() ?? t;
  return head.length > 52 ? `${head.slice(0, 50)}…` : head;
}

export function parseJsonBody(rawText: string): Record<string, unknown> {
  try {
    return JSON.parse(rawText || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Build a failure detail from a completed fetch (body already read as `rawText`).
 */
export function syncFailureFromApiResponse(
  operation: string,
  res: Response,
  rawText: string,
  body: Record<string, unknown>,
  logicalOk: boolean,
): SyncFailureDetail | null {
  if (logicalOk) return null;
  let fromJson = "";
  const errField = body.error;
  if (typeof errField === "string" && errField.trim()) fromJson = errField.trim();
  else if (errField != null && typeof errField === "object") {
    try {
      fromJson = JSON.stringify(errField).slice(0, 280);
    } catch {
      fromJson = "";
    }
  }
  const msg =
    fromJson ||
    (rawText.trim() ? rawText.trim().slice(0, 280) : `HTTP ${res.status}`);
  const snippet = rawText.length > 800 ? `${rawText.slice(0, 800)}…` : rawText;
  return {
    operation,
    httpStatus: res.status,
    message: msg,
    responseSnippet: snippet || undefined,
    cause: "http",
  };
}
