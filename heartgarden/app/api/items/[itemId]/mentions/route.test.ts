import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * REVIEW_2026-04-25_1730 M9 (covers H2):
 * The item-scoped mentions route now checks `gmMayAccessItemSpaceAsync` after
 * loading the item's `spaceId`. This test exercises the deny path so the
 * "GM can read another brane's mentions by knowing the item id" regression
 * does not silently come back.
 */

const tryGetDbMock = vi.fn();
const gmMayAccessItemSpaceAsyncMock = vi.fn();

vi.mock("@/src/db/index", () => ({ tryGetDb: tryGetDbMock }));
vi.mock("@/src/lib/heartgarden-api-boot-context", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/src/lib/heartgarden-api-boot-context")>();
  return {
    ...mod,
    getHeartgardenApiBootContext: vi.fn(() => Promise.resolve({ role: "gm" })),
    gmMayAccessItemSpaceAsync: gmMayAccessItemSpaceAsyncMock,
  };
});

const ITEM_ID = "00000000-0000-4000-8000-000000000010";
const SPACE_ID = "00000000-0000-4000-8000-000000000091";

describe("GET /api/items/[itemId]/mentions auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the caller cannot read the item's space", async () => {
    let mentionsQueryRan = false;
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ id: ITEM_ID, spaceId: SPACE_ID }]),
          })),
          innerJoin: vi.fn(() => ({
            where: vi.fn(async () => {
              mentionsQueryRan = true;
              return [];
            }),
          })),
        })),
      })),
    };
    tryGetDbMock.mockReturnValue(db);
    gmMayAccessItemSpaceAsyncMock.mockResolvedValue(false);

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/items/x/mentions"), {
      params: Promise.resolve({ itemId: ITEM_ID }),
    });
    expect(res.status).toBe(403);
    expect(mentionsQueryRan).toBe(false);
  }, 10_000);

  it("returns 404 when item does not exist (masked not-found shape)", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    };
    tryGetDbMock.mockReturnValue(db);

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/items/x/mentions"), {
      params: Promise.resolve({ itemId: ITEM_ID }),
    });
    expect(res.status).toBe(404);
    expect(gmMayAccessItemSpaceAsyncMock).not.toHaveBeenCalled();
  }, 10_000);
});
