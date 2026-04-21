import { beforeEach, describe, expect, it, vi } from "vitest";

import { items, spaces } from "@/src/db/schema";

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

vi.mock("@/src/lib/heartgarden-space-route-access", () => ({
  requireHeartgardenSpaceApiAccess: vi.fn(async () => ({
    ok: true as const,
    space: { id: "space-root", name: "Root", parentSpaceId: null },
  })),
}));

vi.mock("@/src/lib/spaces", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/src/lib/spaces")>();
  return {
    ...mod,
    listGmWorkspaceSpaces: vi.fn(() =>
      Promise.resolve([{ id: "space-root", name: "Root", parentSpaceId: null }]),
    ),
  };
});

vi.mock("@/src/lib/item-links-space-revision", () => ({
  computeItemLinksRevisionForSpace: vi.fn(async () => "0:0:test"),
}));

describe("GET /api/spaces/[spaceId]/changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when since is not a valid date", async () => {
    tryGetDbMock.mockReturnValue({});
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/spaces/space-root/changes?since=not-a-date"),
      { params: Promise.resolve({ spaceId: "space-root" }) },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Invalid since");
  });

  it("when nothing changed since cursor, still returns itemIds snapshot and cursor equal to since", async () => {
    const since = "2024-01-15T10:00:00.000Z";
    let selectN = 0;
    const db = {
      select: vi.fn(() => {
        selectN += 1;
        if (selectN === 1) {
          return {
            from: vi.fn(() => ({
              where: vi.fn(async () => [{ id: "only-id" }]),
            })),
          };
        }
        if (selectN === 2) {
          return {
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(async () => []),
                })),
              })),
            })),
          };
        }
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(async () => []),
              })),
            })),
          })),
        };
      }),
    };
    tryGetDbMock.mockReturnValue(db);

    const { GET } = await import("./route");
    const res = await GET(
      new Request(
        `http://localhost/api/spaces/space-root/changes?since=${encodeURIComponent(since)}&includeItemIds=1`,
      ),
      { params: Promise.resolve({ spaceId: "space-root" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      items: unknown[];
      itemIds: string[];
      cursor: string;
    };
    expect(body.ok).toBe(true);
    expect(body.items).toEqual([]);
    expect(body.itemIds).toEqual(["only-id"]);
    expect(body.cursor).toBe(since);
  });

  it("includes itemIds when includeItemIds=1 and merges cursor from items and spaces", async () => {
    const itemTime = new Date("2024-06-02T12:00:00.000Z");
    const spaceTime = new Date("2024-06-03T15:30:00.000Z");
    let selectN = 0;
    const db = {
      select: vi.fn(() => {
        selectN += 1;
        if (selectN === 1) {
          return {
            from: vi.fn((table: unknown) => {
              expect(table).toBe(items);
              return {
                where: vi.fn(async () => [{ id: "item-a" }, { id: "item-b" }]),
              };
            }),
          };
        }
        if (selectN === 2) {
          return {
            from: vi.fn((table: unknown) => {
              expect(table).toBe(items);
              return {
                where: vi.fn(() => ({
                  orderBy: vi.fn(() => ({
                    limit: vi.fn(async () => [
                      {
                        id: "item-a",
                        spaceId: "space-root",
                        itemType: "note",
                        x: 0,
                        y: 0,
                        width: 280,
                        height: 200,
                        zIndex: 1,
                        title: "A",
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
                        updatedAt: itemTime,
                      },
                    ]),
                  })),
                })),
              };
            }),
          };
        }
        return {
          from: vi.fn((table: unknown) => {
            expect(table).toBe(spaces);
            return {
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(async () => [
                    {
                      id: "space-root",
                      name: "Root",
                      parentSpaceId: null,
                      updatedAt: spaceTime,
                    },
                  ]),
                })),
              })),
            };
          }),
        };
      }),
    };
    tryGetDbMock.mockReturnValue(db);

    const { GET } = await import("./route");
    const res = await GET(
      new Request(
        "http://localhost/api/spaces/space-root/changes?since=2024-01-01T00:00:00.000Z&includeItemIds=1",
      ),
      { params: Promise.resolve({ spaceId: "space-root" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      itemIds: string[];
      cursor: string;
      items: { id: string }[];
      spaces?: { id: string }[];
    };
    expect(body.ok).toBe(true);
    expect(body.itemIds.sort()).toEqual(["item-a", "item-b"]);
    expect(body.cursor).toBe(spaceTime.toISOString());
    expect(body.items.map((i) => i.id)).toEqual(["item-a"]);
    expect(body.spaces?.map((s) => s.id)).toEqual(["space-root"]);
  });

  it("omits itemIds key when includeItemIds is not requested", async () => {
    let selectN = 0;
    const db = {
      select: vi.fn(() => {
        selectN += 1;
        if (selectN === 1) {
          return {
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(async () => []),
                })),
              })),
            })),
          };
        }
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(async () => []),
              })),
            })),
          })),
        };
      }),
    };
    tryGetDbMock.mockReturnValue(db);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/spaces/space-root/changes?since=2024-01-01T00:00:00.000Z"),
      { params: Promise.resolve({ spaceId: "space-root" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect("itemIds" in body).toBe(false);
  });
});
