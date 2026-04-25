import { beforeEach, describe, expect, it, vi } from "vitest";

const tryGetDbMock = vi.fn();
const validateLinkTargetsInBraneMock = vi.fn();

vi.mock("@/src/db/index", () => ({
  tryGetDb: tryGetDbMock,
}));

vi.mock("@/src/lib/item-links-validation", () => ({
  validateLinkTargetsInBrane: validateLinkTargetsInBraneMock,
}));

vi.mock("@/src/lib/heartgarden-realtime-invalidation", () => ({
  publishHeartgardenSpaceInvalidation: vi.fn(async () => undefined),
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
          innerJoin: vi.fn(() => ({
            where: vi.fn(async () => []),
          })),
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                { braneType: "gm", name: "Test Space" },
              ]),
            })),
          })),
          where: vi.fn(() => {
            const result: {
              limit: ReturnType<typeof vi.fn>;
              then: (
                resolve: (rows: unknown[]) => unknown,
                reject?: (err: unknown) => unknown
              ) => Promise<unknown>;
            } = {
              limit: vi.fn(async () => [{ spaceId: "space-a" }]),
              // biome-ignore lint/suspicious/noThenProperty: intentional thenable shape — mock mirrors Drizzle's query builder which is itself thenable
              then: (resolve, reject) =>
                Promise.resolve([] as unknown[]).then(resolve, reject),
            };
            return result;
          }),
        })),
      })),
      transaction: vi.fn(async (run: (txn: typeof tx) => Promise<void>) =>
        run(tx)
      ),
    };

    tryGetDbMock.mockReturnValue(db);
    validateLinkTargetsInBraneMock.mockResolvedValue({
      ok: true,
      sourceSpaceId: "space-a",
      targetIds: [
        "00000000-0000-4000-8000-000000000002",
        "00000000-0000-4000-8000-000000000003",
      ],
      targetSpaceIds: ["space-a"],
    });
    const { POST } = await import("./route");

    const res = await POST(
      new Request("http://localhost/api/item-links/sync", {
        body: JSON.stringify({
          sourceItemId: "00000000-0000-4000-8000-000000000001",
          targetIds: [
            "00000000-0000-4000-8000-000000000002",
            "00000000-0000-4000-8000-000000000003",
          ],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    );

    expect(res.status).toBe(200);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.delete).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });
});
