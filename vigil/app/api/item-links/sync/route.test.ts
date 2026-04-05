import { beforeEach, describe, expect, it, vi } from "vitest";

const tryGetDbMock = vi.fn();
const validateLinkTargetsInSourceSpaceMock = vi.fn();

vi.mock("@/src/db/index", () => ({
  tryGetDb: tryGetDbMock,
}));

vi.mock("@/src/lib/item-links-validation", () => ({
  validateLinkTargetsInSourceSpace: validateLinkTargetsInSourceSpaceMock,
}));

vi.mock("@/src/lib/heartgarden-api-boot-context", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/src/lib/heartgarden-api-boot-context")>();
  return {
    ...mod,
    getHeartgardenApiBootContext: vi.fn(() => Promise.resolve({ role: "gm" })),
  };
});

describe("POST /api/item-links/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies delete+insert inside a transaction", async () => {
    const tx = {
      delete: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => undefined),
        })),
      })),
    };

    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ spaceId: "space-a" }]),
          })),
        })),
      })),
      transaction: vi.fn(async (run: (txn: typeof tx) => Promise<void>) => run(tx)),
    };

    tryGetDbMock.mockReturnValue(db);
    validateLinkTargetsInSourceSpaceMock.mockResolvedValue({
      ok: true,
      sourceSpaceId: "space-a",
      targetIds: [
        "00000000-0000-4000-8000-000000000002",
        "00000000-0000-4000-8000-000000000003",
      ],
    });
    const { POST } = await import("./route");

    const res = await POST(
      new Request("http://localhost/api/item-links/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceItemId: "00000000-0000-4000-8000-000000000001",
          targetIds: [
            "00000000-0000-4000-8000-000000000002",
            "00000000-0000-4000-8000-000000000003",
          ],
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.delete).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });
});
