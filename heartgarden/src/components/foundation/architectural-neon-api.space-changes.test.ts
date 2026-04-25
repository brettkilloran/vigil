import { beforeEach, describe, expect, it, vi } from "vitest";

describe("fetchSpaceChanges", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("unmocked fetch")))
    );
  });

  it("returns parse failure when includeItemIds is true but itemIds is missing", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    );
    const { fetchSpaceChanges } = await import("./architectural-neon-api");
    const out = await fetchSpaceChanges("space-1", "2020-01-01T00:00:00.000Z", {
      includeItemIds: true,
    });
    expect(out).toEqual({
      cause: "parse",
      error: "Space changes payload missing required fields",
      httpStatus: 200,
      ok: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/spaces/space-1/changes?"),
      expect.objectContaining({ signal: undefined })
    );
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("includeItemIds=1");
  });

  it("returns parsed payload when contract is satisfied", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          cursor: "2024-02-01T00:00:00.000Z",
          itemIds: ["a", "b"],
          items: [],
          ok: true,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    );
    const { fetchSpaceChanges } = await import("./architectural-neon-api");
    const out = await fetchSpaceChanges("space-1", "2020-01-01T00:00:00.000Z", {
      includeItemIds: true,
    });
    expect(out).toEqual({
      cursor: "2024-02-01T00:00:00.000Z",
      itemIds: ["a", "b"],
      items: [],
      ok: true,
    });
  });

  it("returns structured failure on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Database not configured", ok: false }),
        { status: 503 }
      )
    );
    const { fetchSpaceChanges } = await import("./architectural-neon-api");
    const out = await fetchSpaceChanges("space-1", "2020-01-01T00:00:00.000Z", {
      includeItemIds: true,
    });
    expect(out).toEqual({
      cause: "http",
      error: "Database not configured",
      httpStatus: 503,
      ok: false,
    });
  });
});
