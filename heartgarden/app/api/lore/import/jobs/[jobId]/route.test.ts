import { beforeEach, describe, expect, it, vi } from "vitest";

const tryGetDbMock = vi.fn();
const gmMayAccessSpaceIdAsyncMock = vi.fn();
const scheduleLoreImportJobProcessingMock = vi.fn();

vi.mock("@/src/db/index", () => ({
  tryGetDb: tryGetDbMock,
}));

vi.mock("@/src/lib/heartgarden-api-boot-context", () => ({
  getHeartgardenApiBootContext: vi.fn().mockResolvedValue({ role: "gm" }),
  enforceGmOnlyBootContext: vi.fn().mockReturnValue(null),
  gmMayAccessSpaceIdAsync: gmMayAccessSpaceIdAsyncMock,
  heartgardenApiForbiddenJsonResponse: vi.fn(),
}));

vi.mock("@/src/lib/lore-import-job-after", () => ({
  scheduleLoreImportJobProcessing: scheduleLoreImportJobProcessingMock,
}));

describe("GET /api/lore/import/jobs/[jobId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gmMayAccessSpaceIdAsyncMock.mockResolvedValue(true);
  });

  it("returns structured failure fields for failed jobs", async () => {
    const failedJob = {
      id: "11111111-1111-4111-8111-111111111111",
      spaceId: "22222222-2222-4222-8222-222222222222",
      status: "failed",
      error: "Outline model timed out",
      plan: null,
      updatedAt: new Date(),
      progressPhase: "failed",
      progressStep: null,
      progressTotal: null,
      progressMessage: "Import job failed",
      progressMeta: { errorCode: "outline_llm_failed", lastPhase: "outline" },
      lastProgressAt: new Date(),
    };
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [failedJob],
          }),
        }),
      }),
    };
    tryGetDbMock.mockReturnValue(db);

    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/lore/import/jobs/11111111-1111-4111-8111-111111111111?spaceId=22222222-2222-4222-8222-222222222222",
    );
    const res = await GET(req, {
      params: Promise.resolve({ jobId: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      ok: boolean;
      status: string;
      error?: string;
      code?: string;
      errorCode?: string;
      lastPhase?: string;
    };
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("failed");
    expect(payload.error).toBe("Outline model timed out");
    expect(payload.code).toBe("lore_import_job_failed");
    expect(payload.errorCode).toBe("outline_llm_failed");
    expect(payload.lastPhase).toBe("outline");
  });
});

