import { beforeEach, describe, expect, it, vi } from "vitest";

const tryGetDbMock = vi.fn();

vi.mock("@/src/db/index", () => ({
  tryGetDb: tryGetDbMock,
}));

vi.mock("@/src/lib/heartgarden-api-boot-context", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/src/lib/heartgarden-api-boot-context")>();
  return {
    ...mod,
    getHeartgardenApiBootContext: vi.fn(() => Promise.resolve({ role: "gm" })),
  };
});

vi.mock("@/src/lib/item-vault-index", () => ({
  scheduleItemEmbeddingRefresh: vi.fn(),
}));

vi.mock("@/src/lib/schedule-vault-index-after", () => ({
  scheduleVaultReindexAfterResponse: vi.fn(),
}));

vi.mock("@/src/lib/heartgarden-realtime-invalidation", () => ({
  publishHeartgardenSpaceInvalidation: vi.fn().mockResolvedValue(undefined),
}));

const ITEM_ID = "00000000-0000-4000-8000-0000000000aa";
const SPACE_ID = "00000000-0000-4000-8000-0000000000bb";

function mockExistingRow(updatedAt: Date) {
  return {
    id: ITEM_ID,
    spaceId: SPACE_ID,
    itemType: "note",
    x: 0,
    y: 0,
    width: 280,
    height: 200,
    zIndex: 1,
    title: "T",
    contentText: "",
    searchBlob: "",
    contentJson: null,
    imageUrl: null,
    imageMeta: null,
    color: null,
    entityType: null,
    entityMeta: null,
    stackId: null,
    stackOrder: null,
    loreSummary: null,
    loreAliases: null,
    loreIndexedAt: null,
    createdAt: new Date("2019-01-01"),
    updatedAt,
  };
}

describe("PATCH /api/items/[itemId] baseUpdatedAt conflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 409 with server item when baseUpdatedAt mismatches", async () => {
    const serverTime = new Date("2024-06-01T12:00:00.000Z");
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [mockExistingRow(serverTime)]),
          })),
        })),
      })),
    };
    tryGetDbMock.mockReturnValue(db);

    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request(`http://localhost/api/items/${ITEM_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Next",
          baseUpdatedAt: "2020-01-01T00:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ itemId: ITEM_ID }) },
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      ok: boolean;
      error: string;
      item: { id: string; title: string; updatedAt?: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("conflict");
    expect(body.item.id).toBe(ITEM_ID);
    expect(body.item.title).toBe("T");
    expect(body.item.updatedAt).toBe(serverTime.toISOString());
  });

  it("proceeds when baseUpdatedAt matches row updatedAt", async () => {
    const serverTime = new Date("2024-06-01T12:00:00.000Z");
    const updatedRow = {
      ...mockExistingRow(new Date()),
      title: "Next",
    };
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [mockExistingRow(serverTime)]),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [updatedRow]),
          })),
        })),
      })),
    };
    tryGetDbMock.mockReturnValue(db);

    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request(`http://localhost/api/items/${ITEM_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Next",
          baseUpdatedAt: serverTime.toISOString(),
        }),
      }),
      { params: Promise.resolve({ itemId: ITEM_ID }) },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; item?: { title: string } };
    expect(body.ok).toBe(true);
    expect(body.item?.title).toBe("Next");
  });
});
