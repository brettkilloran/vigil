import { beforeEach, describe, expect, it, vi } from "vitest";

const tryGetDbMock = vi.fn();
const assertSpaceExistsMock = vi.fn();
const gmMayAccessSpaceIdAsyncMock = vi.fn();
const scheduleLoreImportJobProcessingMock = vi.fn();

vi.mock("@/src/db/index", () => ({
  tryGetDb: tryGetDbMock,
}));

vi.mock("@/src/lib/spaces", () => ({
  assertSpaceExists: assertSpaceExistsMock,
}));

vi.mock("@/src/lib/lore-import-job-after", () => ({
  scheduleLoreImportJobProcessing: scheduleLoreImportJobProcessingMock,
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
    tryGetDbMock.mockReturnValue({});
    assertSpaceExistsMock.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
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
});

