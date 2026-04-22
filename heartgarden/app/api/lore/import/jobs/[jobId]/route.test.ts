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
      progress?: { phase?: string; message?: string };
    };
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("failed");
    expect(payload.error).toBe("Outline model timed out");
    expect(payload.code).toBe("lore_import_job_failed");
    expect(payload.errorCode).toBe("outline_llm_failed");
    expect(payload.lastPhase).toBe("outline");
    expect(payload.progress?.phase).toBe("failed");
    expect(payload.progress?.message).toBe("Import job failed");
  });
});

describe("DELETE /api/lore/import/jobs/[jobId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gmMayAccessSpaceIdAsyncMock.mockResolvedValue(true);
  });

  it("marks queued/processing jobs as cancelled", async () => {
    const updateWhereMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: "11111111-1111-4111-8111-111111111111",
                spaceId: "22222222-2222-4222-8222-222222222222",
                status: "processing",
              },
            ],
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: updateWhereMock,
        }),
      }),
    };
    tryGetDbMock.mockReturnValue(db);

    const { DELETE } = await import("./route");
    const req = new Request(
      "http://localhost/api/lore/import/jobs/11111111-1111-4111-8111-111111111111?spaceId=22222222-2222-4222-8222-222222222222",
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ jobId: "11111111-1111-4111-8111-111111111111" }),
    });
    const payload = (await res.json()) as {
      ok: boolean;
      status: string;
      cancelled: boolean;
      mutable: boolean;
    };
    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("cancelled");
    expect(payload.cancelled).toBe(true);
    expect(payload.mutable).toBe(true);
    expect(updateWhereMock).toHaveBeenCalledTimes(1);
  });

  it("returns immutable for already-ready jobs", async () => {
    const updateWhereMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: "11111111-1111-4111-8111-111111111111",
                spaceId: "22222222-2222-4222-8222-222222222222",
                status: "ready",
              },
            ],
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: updateWhereMock,
        }),
      }),
    };
    tryGetDbMock.mockReturnValue(db);

    const { DELETE } = await import("./route");
    const req = new Request(
      "http://localhost/api/lore/import/jobs/11111111-1111-4111-8111-111111111111?spaceId=22222222-2222-4222-8222-222222222222",
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ jobId: "11111111-1111-4111-8111-111111111111" }),
    });
    const payload = (await res.json()) as {
      ok: boolean;
      status: string;
      cancelled: boolean;
      mutable: boolean;
    };
    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("ready");
    expect(payload.cancelled).toBe(false);
    expect(payload.mutable).toBe(false);
    expect(updateWhereMock).not.toHaveBeenCalled();
  });
});

