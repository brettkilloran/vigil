import { beforeEach, describe, expect, it, vi } from "vitest";

const tryGetDbMock = vi.fn();
const loadItemRowForHeartgardenApiMock = vi.fn();

vi.mock("@/src/db/index", () => ({
  tryGetDb: tryGetDbMock,
}));

vi.mock("@/src/lib/heartgarden-api-item-loaders", () => ({
  loadItemRowForHeartgardenApi: loadItemRowForHeartgardenApiMock,
}));

vi.mock("@/src/lib/heartgarden-api-boot-context", () => ({
  getHeartgardenApiBootContext: vi.fn().mockResolvedValue({ role: "gm" }),
  isHeartgardenPlayerBlocked: vi.fn().mockReturnValue(false),
}));

describe("GET /api/v1/items/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 503 when database is unavailable", async () => {
    tryGetDbMock.mockReturnValue(undefined);
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/v1/items/x"), {
      params: Promise.resolve({ itemId: "00000000-0000-4000-8000-000000000001" }),
    });
    expect(res.status).toBe(503);
    const payload = (await res.json()) as { error: string };
    expect(payload.error).toBe("Database not configured");
  });

  it("returns legacy v1 success shape", async () => {
    tryGetDbMock.mockReturnValue({});
    loadItemRowForHeartgardenApiMock.mockResolvedValue({
      kind: "ok",
      row: {
        id: "00000000-0000-4000-8000-000000000001",
        spaceId: "00000000-0000-4000-8000-000000000002",
        title: "Hi",
        contentText: "",
        contentJson: null,
        itemType: "note",
        entityType: null,
        entityMeta: null,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 1,
        color: null,
        imageUrl: null,
        imageMeta: null,
        stackId: null,
        stackOrder: null,
        createdAt: new Date("2020-01-01"),
        updatedAt: new Date("2020-01-01"),
        loreSummary: null,
        loreAliases: null,
        loreIndexedAt: null,
        loreMetaSourceHash: null,
        searchBlob: null,
      },
    });

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/v1/items/00000000-0000-4000-8000-000000000001"), {
      params: Promise.resolve({ itemId: "00000000-0000-4000-8000-000000000001" }),
    });
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { version: number; item: { title: string } };
    expect(payload.version).toBe(1);
    expect(payload.item.title).toBe("Hi");
  });

  it("returns 404 Not found for missing item when gm", async () => {
    tryGetDbMock.mockReturnValue({});
    loadItemRowForHeartgardenApiMock.mockResolvedValue({ kind: "absent" });
    const { getHeartgardenApiBootContext, isHeartgardenPlayerBlocked } = await import(
      "@/src/lib/heartgarden-api-boot-context"
    );
    vi.mocked(getHeartgardenApiBootContext).mockResolvedValue({ role: "gm" });
    vi.mocked(isHeartgardenPlayerBlocked).mockReturnValue(false);

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/v1/items/missing"), {
      params: Promise.resolve({ itemId: "00000000-0000-4000-8000-000000000099" }),
    });
    expect(res.status).toBe(404);
    const payload = (await res.json()) as { error: string };
    expect(payload.error).toBe("Not found");
    expect(payload).not.toHaveProperty("ok");
  });
});
