import { describe, expect, it } from "vitest";

import {
  formatLoreImportFailureReport,
  loreImportSummaryLine,
  parseLoreImportJsonBody,
  type LoreImportFailureDetail,
} from "@/src/lib/lore-import-diagnostic";

describe("lore-import-diagnostic", () => {
  it("parses JSON body when valid", () => {
    const parsed = parseLoreImportJsonBody('{"ok":false,"error":"Bad input"}');
    expect(parsed.error).toBe("Bad input");
  });

  it("returns empty object for invalid JSON", () => {
    const parsed = parseLoreImportJsonBody("{not valid");
    expect(parsed).toEqual({});
  });

  it("truncates long summary lines", () => {
    const detail: LoreImportFailureDetail = {
      attemptId: "attempt-a",
      stage: "parse",
      operation: "POST /api/lore/import/parse",
      message: "x".repeat(180),
      occurredAtIso: "2026-01-01T00:00:00.000Z",
    };
    const summary = loreImportSummaryLine(detail);
    expect(summary.length).toBeLessThanOrEqual(73);
  });

  it("formats a copyable support report", () => {
    const detail: LoreImportFailureDetail = {
      attemptId: "attempt-123",
      stage: "job_poll",
      operation: "GET /api/lore/import/jobs/[jobId]",
      message: "Import job failed",
      responseSnippet: '{"ok":false,"error":"Import job failed"}',
      httpStatus: 500,
      jobId: "123e4567-e89b-12d3-a456-426614174000",
      phase: "outline",
      errorCode: "outline_llm_failed",
      fileName: "chapter-1.md",
      spaceId: "123e4567-e89b-12d3-a456-426614174001",
      recommendedAction: "Retry with a smaller source file.",
      occurredAtIso: "2026-01-01T00:00:00.000Z",
    };
    const report = formatLoreImportFailureReport(detail);
    expect(report).toContain("attemptId: attempt-123");
    expect(report).toContain("stage: job_poll");
    expect(report).toContain("httpStatus: 500");
    expect(report).toContain("recommendedAction: Retry with a smaller source file.");
  });
});

