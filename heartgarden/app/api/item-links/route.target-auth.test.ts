import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * REVIEW_2026-04-25_1730 M9: regression coverage for the C1 critical auth
 * ordering fix. The previous implementations of PATCH and DELETE mutated the
 * row before authorizing the target-space side of the link; this suite locks
 * in the new behavior — `403` is returned BEFORE any row touches the database.
 */

const tryGetDbMock = vi.fn();
const validateLinkTargetsInBraneMock = vi.fn();
const gmMayAccessItemSpaceAsyncMock = vi.fn();
const playerMayAccessItemSpaceAsyncMock = vi.fn();
const publishHeartgardenSpaceInvalidationMock = vi.fn(async () => {});

vi.mock("@/src/db/index", () => ({ tryGetDb: tryGetDbMock }));
vi.mock("@/src/lib/item-links-validation", () => ({
  validateLinkTargetsInBrane: validateLinkTargetsInBraneMock,
}));
vi.mock("@/src/lib/heartgarden-realtime-invalidation", () => ({
  publishHeartgardenSpaceInvalidation: publishHeartgardenSpaceInvalidationMock,
}));
vi.mock("@/src/lib/heartgarden-api-boot-context", async (importOriginal) => {
  const mod =
    await importOriginal<
      typeof import("@/src/lib/heartgarden-api-boot-context")
    >();
  return {
    ...mod,
    getHeartgardenApiBootContext: vi.fn(() => Promise.resolve({ role: "gm" })),
    gmMayAccessItemSpaceAsync: gmMayAccessItemSpaceAsyncMock,
    playerMayAccessItemSpaceAsync: playerMayAccessItemSpaceAsyncMock,
  };
});

const SOURCE_ITEM_ID = "00000000-0000-4000-8000-000000000001";
const TARGET_ITEM_ID = "00000000-0000-4000-8000-000000000002";
const SOURCE_SPACE_ID = "00000000-0000-4000-8000-000000000091";
const TARGET_SPACE_ID = "00000000-0000-4000-8000-000000000092";
const LINK_ID = "00000000-0000-4000-8000-0000000000aa";

describe("PATCH /api/item-links target-space auth ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playerMayAccessItemSpaceAsyncMock.mockResolvedValue(true);
  });

  it("returns 403 before mutating when target space is denied", async () => {
    const updateSpy = vi.fn();
    const db = {
      select: vi.fn((shape: Record<string, unknown> | undefined) => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              const keys = shape ? Object.keys(shape) : [];
              if (
                keys.includes("sourceItemId") &&
                keys.includes("targetItemId")
              ) {
                return [
                  {
                    sourceItemId: SOURCE_ITEM_ID,
                    targetItemId: TARGET_ITEM_ID,
                  },
                ];
              }
              return [];
            }),
          })),
          // The endpoint resolution query uses `inArray(items.id, [src,tgt])`
          // with no chained `.limit()`; just resolve to the two endpoints.
          // Drizzle awaits the chain directly when no `.limit()` follows.
        })),
      })),
      transaction: vi.fn(async () => {
        updateSpy();
      }),
    };
    // Override `from(...).where(inArray(...))` to be awaitable directly.
    // Simpler: replace `select` to return the right shape based on call order.
    let call = 0;
    db.select = vi.fn((shape: Record<string, unknown> | undefined) => {
      call += 1;
      const keys = shape ? Object.keys(shape) : [];
      // 1st: linkMeta SELECT (limit-chained)
      if (
        call === 1 &&
        keys.includes("sourceItemId") &&
        keys.includes("targetItemId")
      ) {
        return {
          from: () => ({
            where: () => ({
              limit: async () => [
                { sourceItemId: SOURCE_ITEM_ID, targetItemId: TARGET_ITEM_ID },
              ],
            }),
          }),
        } as unknown as Record<string, unknown>;
      }
      // 2nd: endpoint rows (no limit)
      return {
        from: () => ({
          where: async () => [
            { entityType: null, id: SOURCE_ITEM_ID, spaceId: SOURCE_SPACE_ID },
            { entityType: null, id: TARGET_ITEM_ID, spaceId: TARGET_SPACE_ID },
          ],
        }),
      } as unknown as Record<string, unknown>;
    });

    tryGetDbMock.mockReturnValue(db);
    gmMayAccessItemSpaceAsyncMock.mockImplementation(
      async (_db, _ctx, spaceId) => spaceId !== TARGET_SPACE_ID
    );

    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/api/item-links", {
        body: JSON.stringify({ color: "red", id: LINK_ID }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      })
    );
    expect(res.status).toBe(403);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(publishHeartgardenSpaceInvalidationMock).not.toHaveBeenCalled();
  }, 10_000);
});

describe("DELETE /api/item-links target-space auth ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playerMayAccessItemSpaceAsyncMock.mockResolvedValue(true);
  });

  it("returns 403 before deleting when target space is denied", async () => {
    const deleteSpy = vi.fn();
    let call = 0;
    const db: Record<string, unknown> = {
      select: vi.fn((shape: Record<string, unknown> | undefined) => {
        call += 1;
        const keys = shape ? Object.keys(shape) : [];
        if (
          call === 1 &&
          keys.includes("sourceItemId") &&
          keys.includes("targetItemId")
        ) {
          return {
            from: () => ({
              where: () => ({
                limit: async () => [
                  {
                    sourceItemId: SOURCE_ITEM_ID,
                    targetItemId: TARGET_ITEM_ID,
                  },
                ],
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: async () => [
              { id: SOURCE_ITEM_ID, spaceId: SOURCE_SPACE_ID },
              { id: TARGET_ITEM_ID, spaceId: TARGET_SPACE_ID },
            ],
          }),
        };
      }),
      transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          delete: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn(async () => {
                deleteSpy();
                return [];
              }),
            })),
          })),
        })
      ),
    };
    tryGetDbMock.mockReturnValue(db);
    gmMayAccessItemSpaceAsyncMock.mockImplementation(
      async (_db, _ctx, spaceId) => spaceId !== TARGET_SPACE_ID
    );

    const { DELETE } = await import("./route");
    const res = await DELETE(
      new Request("http://localhost/api/item-links", {
        body: JSON.stringify({ id: LINK_ID }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      })
    );
    expect(res.status).toBe(403);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(publishHeartgardenSpaceInvalidationMock).not.toHaveBeenCalled();
  }, 10_000);
});
