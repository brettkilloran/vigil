import { beforeEach, describe, expect, it, vi } from "vitest";

const tryGetDbMock = vi.fn();
const resolveLoreImportAllowedSpaceIdsMock = vi.fn();

vi.mock("@/src/db/index", () => ({
  tryGetDb: tryGetDbMock,
}));

vi.mock("@/src/lib/heartgarden-api-boot-context", () => ({
  getHeartgardenApiBootContext: vi.fn().mockResolvedValue({ role: "gm" }),
  heartgardenApiForbiddenJsonResponse: vi.fn(() =>
    Response.json(
      { error: "forbidden", ok: false, spaces: [] },
      { status: 403 }
    )
  ),
  isHeartgardenPlayerBlocked: vi.fn().mockReturnValue(false),
}));

vi.mock("@/src/lib/lore-import-space-scope", () => ({
  buildSpacePath: (
    spaceId: string,
    byId: Map<string, { name: string; parentSpaceId: string | null }>
  ) => {
    const row = byId.get(spaceId);
    return row?.name ?? spaceId;
  },
  resolveLoreImportAllowedSpaceIds: resolveLoreImportAllowedSpaceIdsMock,
}));

describe("GET /api/spaces/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveLoreImportAllowedSpaceIdsMock.mockResolvedValue(
      new Set(["11111111-1111-4111-8111-111111111111"])
    );
    tryGetDbMock.mockReturnValue({
      select: () => ({
        from: () =>
          Promise.resolve([
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Root",
              parentSpaceId: null,
            },
          ]),
      }),
    });
  });

  it("defaults to current_subtree scope", async () => {
    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/spaces/search?rootSpaceId=11111111-1111-4111-8111-111111111111"
    );
    const res = await GET(req);
    const payload = (await res.json()) as { ok: boolean; scope?: string };
    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.scope).toBe("current_subtree");
  });

  it("returns empty results for one-character query", async () => {
    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/spaces/search?rootSpaceId=11111111-1111-4111-8111-111111111111&q=a"
    );
    const res = await GET(req);
    const payload = (await res.json()) as {
      ok: boolean;
      scope?: string;
      spaces?: unknown[];
    };
    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.scope).toBe("current_subtree");
    expect(Array.isArray(payload.spaces)).toBe(true);
    expect(payload.spaces?.length).toBe(0);
  });
});
