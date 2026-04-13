import { beforeEach, describe, expect, it, vi } from "vitest";

const tryGetDbMock = vi.fn();

vi.mock("@/src/db/index", () => ({
  tryGetDb: tryGetDbMock,
}));

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 503 when database is unavailable", async () => {
    tryGetDbMock.mockReturnValue(undefined);
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/search?spaceId=abc&q=test"));
    expect(res.status).toBe(503);
    const payload = (await res.json()) as { ok: boolean; error: string };
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("Database not configured");
  });
});
