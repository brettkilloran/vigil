export type LoreImportStage =
  | "parse"
  | "job_create"
  | "job_poll"
  | "plan_failed"
  | "apply"
  | "timeout"
  | "unknown";

export type LoreImportFailureDetail = {
  attemptId: string;
  stage: LoreImportStage;
  operation: string;
  message: string;
  responseSnippet?: string;
  httpStatus?: number;
  jobId?: string;
  phase?: string;
  errorCode?: string;
  serverDetail?: string;
  serverHint?: string;
  dbCode?: string;
  dbTable?: string;
  dbColumn?: string;
  dbConstraint?: string;
  retryable?: boolean;
  fileName?: string;
  spaceId?: string;
  recommendedAction?: string;
  occurredAtIso: string;
};

function pageOrigin(): string {
  if (typeof window === "undefined" || !window.location?.origin) {
    return "(ssr)";
  }
  return window.location.origin;
}

export function parseLoreImportJsonBody(
  rawText: string
): Record<string, unknown> {
  try {
    return JSON.parse(rawText || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function loreImportSummaryLine(detail: LoreImportFailureDetail): string {
  const basis = detail.message.trim() || `${detail.operation} failed`;
  return basis.length > 72 ? `${basis.slice(0, 70)}...` : basis;
}

export function formatLoreImportFailureReport(
  detail: LoreImportFailureDetail
): string {
  const lines = [
    loreImportSummaryLine(detail),
    "---",
    "Heartgarden lore import diagnostic (paste to support)",
    `time: ${detail.occurredAtIso}`,
    `page: ${pageOrigin()}`,
    `attemptId: ${detail.attemptId}`,
    `stage: ${detail.stage}`,
    `operation: ${detail.operation}`,
  ];
  if (detail.jobId) {
    lines.push(`jobId: ${detail.jobId}`);
  }
  if (detail.spaceId) {
    lines.push(`spaceId: ${detail.spaceId}`);
  }
  if (detail.fileName) {
    lines.push(`fileName: ${detail.fileName}`);
  }
  if (detail.phase) {
    lines.push(`phase: ${detail.phase}`);
  }
  if (detail.errorCode) {
    lines.push(`errorCode: ${detail.errorCode}`);
  }
  if (detail.dbCode) {
    lines.push(`dbCode: ${detail.dbCode}`);
  }
  if (detail.dbTable) {
    lines.push(`dbTable: ${detail.dbTable}`);
  }
  if (detail.dbColumn) {
    lines.push(`dbColumn: ${detail.dbColumn}`);
  }
  if (detail.dbConstraint) {
    lines.push(`dbConstraint: ${detail.dbConstraint}`);
  }
  if (typeof detail.retryable === "boolean") {
    lines.push(`retryable: ${String(detail.retryable)}`);
  }
  if (typeof detail.httpStatus === "number") {
    lines.push(`httpStatus: ${detail.httpStatus}`);
  }
  lines.push(`message: ${detail.message.trim() || "(empty)"}`);
  if (detail.serverDetail?.trim()) {
    lines.push(`serverDetail: ${detail.serverDetail.trim()}`);
  }
  if (detail.serverHint?.trim()) {
    lines.push(`serverHint: ${detail.serverHint.trim()}`);
  }
  if (detail.recommendedAction?.trim()) {
    lines.push(`recommendedAction: ${detail.recommendedAction.trim()}`);
  }
  if (detail.responseSnippet?.trim()) {
    const snippet = detail.responseSnippet.trim();
    lines.push(
      `responseBody: ${snippet.length > 1500 ? `${snippet.slice(0, 1500)}...` : snippet}`
    );
  }
  return lines.join("\n");
}
