import { beforeEach, describe, expect, it, vi } from "vitest";

const tryGetDbMock = vi.fn();
const assertSpaceExistsMock = vi.fn();
const gmMayAccessSpaceIdAsyncMock = vi.fn();
const applyLoreImportPlanMock = vi.fn();

vi.mock("@/src/db/index", () => ({
  tryGetDb: tryGetDbMock,
}));

vi.mock("@/src/lib/spaces", () => ({
  assertSpaceExists: assertSpaceExistsMock,
}));

vi.mock("@/src/lib/heartgarden-api-boot-context", () => ({
  getHeartgardenApiBootContext: vi.fn().mockResolvedValue({ role: "gm" }),
  enforceGmOnlyBootContext: vi.fn().mockReturnValue(null),
  gmMayAccessSpaceIdAsync: gmMayAccessSpaceIdAsyncMock,
  heartgardenApiForbiddenJsonResponse: vi.fn(),
}));

vi.mock("@/src/lib/lore-import-apply", () => ({
  loreImportApplyBodySchema: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
  applyLoreImportPlan: applyLoreImportPlanMock,
}));

const BASE_BODY = {
  spaceId: "11111111-1111-4111-8111-111111111111",
  importBatchId: "22222222-2222-4222-8222-222222222222",
  plan: {
    importBatchId: "22222222-2222-4222-8222-222222222222",
    sourceCharCount: 12,
    chunks: [],
    folders: [],
    notes: [],
    links: [],
    mergeProposals: [],
    contradictions: [],
    clarifications: [],
    userContext: {
      granularity: "many",
      orgMode: "nearby",
      importScope: "current_subtree",
    },
  },
  acceptedMergeProposalIds: [],
  clarificationAnswers: [],
};

describe("POST /api/lore/import/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tryGetDbMock.mockReturnValue({});
    assertSpaceExistsMock.mockResolvedValue({ id: BASE_BODY.spaceId });
    gmMayAccessSpaceIdAsyncMock.mockResolvedValue(true);
  });

  it("returns 400 when apply plan throws server scope mismatch", async () => {
    applyLoreImportPlanMock.mockRejectedValue(
      new Error("Import scope mismatch with server job metadata")
    );
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/lore/import/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(BASE_BODY),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { ok: boolean; error?: string };
    expect(res.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("scope mismatch");
  });

  it("returns 400 when server import metadata is missing", async () => {
    applyLoreImportPlanMock.mockRejectedValue(
      new Error(
        "Missing server import metadata for this batch; re-run planning before apply."
      )
    );
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/lore/import/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(BASE_BODY),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { ok: boolean; error?: string };
    expect(res.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("re-run planning");
  });
});
