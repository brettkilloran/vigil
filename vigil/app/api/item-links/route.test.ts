import { beforeEach, describe, expect, it, vi } from "vitest";

const tryGetDbMock = vi.fn();
const validateLinkTargetsInSourceSpaceMock = vi.fn();

vi.mock("@/src/db/index", () => ({
  tryGetDb: tryGetDbMock,
}));

vi.mock("@/src/lib/item-links-validation", () => ({
  validateLinkTargetsInSourceSpace: validateLinkTargetsInSourceSpaceMock,
}));

describe("POST /api/item-links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects cross-space links from shared validation", async () => {
    tryGetDbMock.mockReturnValue({});
    validateLinkTargetsInSourceSpaceMock.mockResolvedValue({
      ok: false,
      status: 400,
      error: "Cross-space links are not allowed",
    });
    const { POST } = await import("./route");

    const res = await POST(
      new Request("http://localhost/api/item-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceItemId: "00000000-0000-4000-8000-000000000001",
          targetItemId: "00000000-0000-4000-8000-000000000002",
        }),
      }),
    );

    expect(res.status).toBe(400);
    const payload = (await res.json()) as { ok: boolean; error: string };
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("Cross-space links are not allowed");
    expect(validateLinkTargetsInSourceSpaceMock).toHaveBeenCalledWith(
      {},
      "00000000-0000-4000-8000-000000000001",
      ["00000000-0000-4000-8000-000000000002"],
    );
  });
});
