import { beforeEach, describe, expect, it, vi } from "vitest";

const tryGetDbMock = vi.fn();
const validateLinkTargetsInBraneMock = vi.fn();

vi.mock("@/src/db/index", () => ({
  tryGetDb: tryGetDbMock,
}));

vi.mock("@/src/lib/item-links-validation", () => ({
  validateLinkTargetsInBrane: validateLinkTargetsInBraneMock,
}));

vi.mock("@/src/lib/heartgarden-api-boot-context", async (importOriginal) => {
  const mod =
    await importOriginal<
      typeof import("@/src/lib/heartgarden-api-boot-context")
    >();
  return {
    ...mod,
    getHeartgardenApiBootContext: vi.fn(() => Promise.resolve({ role: "gm" })),
  };
});

describe("POST /api/item-links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects cross-space links from shared validation", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                { braneType: "gm", name: "Test Space" },
              ]),
            })),
          })),
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              { spaceId: "00000000-0000-4000-8000-000000000099" },
            ]),
          })),
        })),
      })),
    };
    tryGetDbMock.mockReturnValue(db);
    validateLinkTargetsInBraneMock.mockResolvedValue({
      error: "Cross-space links are not allowed",
      ok: false,
      status: 400,
    });
    const { POST } = await import("./route");

    const res = await POST(
      new Request("http://localhost/api/item-links", {
        body: JSON.stringify({
          sourceItemId: "00000000-0000-4000-8000-000000000001",
          targetItemId: "00000000-0000-4000-8000-000000000002",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    );

    expect(res.status).toBe(400);
    const payload = (await res.json()) as { ok: boolean; error: string };
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("Cross-space links are not allowed");
    expect(validateLinkTargetsInBraneMock).toHaveBeenCalledWith(
      db,
      "00000000-0000-4000-8000-000000000001",
      ["00000000-0000-4000-8000-000000000002"]
    );
  }, 15_000);
});
