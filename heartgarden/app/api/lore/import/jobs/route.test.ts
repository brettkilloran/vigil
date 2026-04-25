import { beforeEach, describe, expect, it, vi } from "vitest";

const tryGetDbMock = vi.fn();
const assertSpaceExistsMock = vi.fn();
const gmMayAccessSpaceIdAsyncMock = vi.fn();
const scheduleLoreImportJobProcessingMock = vi.fn();
const processLoreImportJobMock = vi.fn();

vi.mock("@/src/db/index", () => ({
  tryGetDb: tryGetDbMock,
}));

vi.mock("@/src/lib/spaces", () => ({
  assertSpaceExists: assertSpaceExistsMock,
}));

vi.mock("@/src/lib/lore-import-job-after", () => ({
  scheduleLoreImportJobProcessing: scheduleLoreImportJobProcessingMock,
}));

vi.mock("@/src/lib/lore-import-job-process", () => ({
  processLoreImportJob: processLoreImportJobMock,
}));

vi.mock("@/src/lib/heartgarden-api-boot-context", () => ({
  getHeartgardenApiBootContext: vi.fn().mockResolvedValue({ role: "gm" }),
  enforceGmOnlyBootContext: vi.fn().mockReturnValue(null),
  gmMayAccessSpaceIdAsync: gmMayAccessSpaceIdAsyncMock,
  heartgardenApiForbiddenJsonResponse: vi.fn(),
}));

describe("POST /api/lore/import/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HEARTGARDEN_IMPORT_JOBS_LEGACY_SCHEMA_FALLBACK;
    scheduleLoreImportJobProcessingMock.mockImplementation(() => undefined);
    processLoreImportJobMock.mockResolvedValue(undefined);
    tryGetDbMock.mockReturnValue({
      insert: () => ({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    });
    assertSpaceExistsMock.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
    });
    gmMayAccessSpaceIdAsyncMock.mockResolvedValue(true);
  });

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/lore/import/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const payload = (await res.json()) as { ok: boolean; error: string };
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("Invalid JSON");
  });

  it("returns 400 with hint when body fails schema", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/lore/import/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "", spaceId: "not-a-uuid" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const payload = (await res.json()) as {
      ok: boolean;
      error: unknown;
      hint?: string;
    };
    expect(payload.ok).toBe(false);
    expect(typeof payload.hint).toBe("string");
    expect(String(payload.hint).length).toBeGreaterThan(0);
  });

  it("creates a queued job and reports queueMode=after", async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    tryGetDbMock.mockReturnValue({
      insert: () => ({
        values: valuesMock,
      }),
    });
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/lore/import/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "import me",
        spaceId: "11111111-1111-4111-8111-111111111111",
        fileName: "notes.md",
      }),
    });
    const res = await POST(req);
    const payload = (await res.json()) as {
      ok: boolean;
      status: string;
      queueMode: string;
      jobId: string;
    };
    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("queued");
    expect(payload.queueMode).toBe("after");
    expect(typeof payload.jobId).toBe("string");
    expect(scheduleLoreImportJobProcessingMock).toHaveBeenCalledTimes(1);
    expect(processLoreImportJobMock).not.toHaveBeenCalled();
    expect(valuesMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to inline processing when queue scheduling throws", async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    tryGetDbMock.mockReturnValue({
      insert: () => ({
        values: valuesMock,
      }),
    });
    scheduleLoreImportJobProcessingMock.mockImplementation(() => {
      throw new Error("after unavailable");
    });
    processLoreImportJobMock.mockResolvedValue(undefined);
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/lore/import/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "import me",
        spaceId: "11111111-1111-4111-8111-111111111111",
      }),
    });
    const res = await POST(req);
    const payload = (await res.json()) as {
      ok: boolean;
      queueMode: string;
      jobId: string;
    };
    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.queueMode).toBe("inline_fallback");
    expect(scheduleLoreImportJobProcessingMock).toHaveBeenCalledTimes(1);
    expect(processLoreImportJobMock).toHaveBeenCalledTimes(1);
    expect(processLoreImportJobMock).toHaveBeenCalledWith(payload.jobId);
    expect(valuesMock).toHaveBeenCalledTimes(1);
  });

  it("uses legacy insert fallback when progress columns are missing", async () => {
    process.env.HEARTGARDEN_IMPORT_JOBS_LEGACY_SCHEMA_FALLBACK = "1";
    const valuesMock = vi.fn().mockRejectedValue({
      code: "42703",
      column: "progress_phase",
      message: 'column "progress_phase" does not exist',
    });
    const executeMock = vi.fn().mockResolvedValue(undefined);
    tryGetDbMock.mockReturnValue({
      insert: () => ({
        values: valuesMock,
      }),
      execute: executeMock,
    });
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/lore/import/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "legacy schema import",
        spaceId: "11111111-1111-4111-8111-111111111111",
      }),
    });
    const res = await POST(req);
    const payload = (await res.json()) as {
      ok: boolean;
      queueMode: string;
    };
    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.queueMode).toBe("after");
    expect(valuesMock).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(scheduleLoreImportJobProcessingMock).toHaveBeenCalledTimes(1);
  });
});
