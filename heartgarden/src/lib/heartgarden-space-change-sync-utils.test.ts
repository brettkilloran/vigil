import { describe, expect, it } from "vitest";

import {
  buildCanvasGraphFromBootstrap,
  type BootstrapResponse,
} from "@/src/components/foundation/architectural-db-bridge";
import {
  applySpaceChangeGraphMerge,
  buildCollabMergeProtectedContentIds,
  collectItemServerUpdatedAtBumps,
  mergeItemServerUpdatedAtIfNewer,
  mergeLatestIsoCursor,
  parseSpaceChangesResponseJson,
} from "@/src/lib/heartgarden-space-change-sync-utils";
import type { CanvasItem } from "@/src/model/canvas-types";

describe("buildCollabMergeProtectedContentIds", () => {
  it("is empty when focus is closed", () => {
    expect(
      buildCollabMergeProtectedContentIds({
        focusOpen: false,
        focusDirty: true,
        activeNodeId: "a",
        inlineContentDirtyIds: new Set(),
      }).size,
    ).toBe(0);
  });

  it("is empty when focus is open but not dirty", () => {
    expect(
      buildCollabMergeProtectedContentIds({
        focusOpen: true,
        focusDirty: false,
        activeNodeId: "a",
        inlineContentDirtyIds: new Set(),
      }).size,
    ).toBe(0);
  });

  it("is empty when focus is dirty but active node id is null", () => {
    expect(
      buildCollabMergeProtectedContentIds({
        focusOpen: true,
        focusDirty: true,
        activeNodeId: null,
        inlineContentDirtyIds: new Set(),
      }).size,
    ).toBe(0);
  });

  it("includes active node when focus is open, dirty, and id is set", () => {
    const s = buildCollabMergeProtectedContentIds({
      focusOpen: true,
      focusDirty: true,
      activeNodeId: "note-1",
      inlineContentDirtyIds: new Set(),
    });
    expect([...s]).toEqual(["note-1"]);
  });

  it("unions inline dirty ids with focused dirty node", () => {
    const s = buildCollabMergeProtectedContentIds({
      focusOpen: true,
      focusDirty: true,
      activeNodeId: "a",
      inlineContentDirtyIds: new Set(["b", "c"]),
    });
    expect([...s].sort()).toEqual(["a", "b", "c"]);
  });

  it("includes inline dirty ids even when focus is not protecting", () => {
    const s = buildCollabMergeProtectedContentIds({
      focusOpen: false,
      focusDirty: false,
      activeNodeId: null,
      inlineContentDirtyIds: new Set(["x"]),
    });
    expect([...s]).toEqual(["x"]);
  });

  it("includes saving content ids", () => {
    const s = buildCollabMergeProtectedContentIds({
      focusOpen: false,
      focusDirty: false,
      activeNodeId: null,
      inlineContentDirtyIds: new Set(),
      savingContentIds: new Set(["s1"]),
    });
    expect([...s]).toEqual(["s1"]);
  });
});

describe("mergeItemServerUpdatedAtIfNewer", () => {
  it("sets when missing", () => {
    const m = new Map<string, string>();
    mergeItemServerUpdatedAtIfNewer(m, "a", "2025-01-02T00:00:00.000Z");
    expect(m.get("a")).toBe("2025-01-02T00:00:00.000Z");
  });

  it("advances when incoming is newer", () => {
    const m = new Map<string, string>([["a", "2025-01-01T00:00:00.000Z"]]);
    mergeItemServerUpdatedAtIfNewer(m, "a", "2025-01-03T00:00:00.000Z");
    expect(m.get("a")).toBe("2025-01-03T00:00:00.000Z");
  });

  it("does not regress when incoming is older", () => {
    const m = new Map<string, string>([["a", "2025-01-03T00:00:00.000Z"]]);
    mergeItemServerUpdatedAtIfNewer(m, "a", "2025-01-01T00:00:00.000Z");
    expect(m.get("a")).toBe("2025-01-03T00:00:00.000Z");
  });
});

describe("mergeLatestIsoCursor", () => {
  it("never moves backward when server sends older cursor", () => {
    const cur = "2024-06-01T12:00:00.000Z";
    expect(mergeLatestIsoCursor(cur, "2020-01-01T00:00:00.000Z")).toBe(cur);
  });

  it("advances when server cursor is newer", () => {
    const next = "2024-07-01T00:00:00.000Z";
    expect(mergeLatestIsoCursor("2024-06-01T00:00:00.000Z", next)).toBe(next);
  });
});

describe("parseSpaceChangesResponseJson", () => {
  it("rejects when itemIds required but missing", () => {
    expect(
      parseSpaceChangesResponseJson({ ok: true, items: [] }, { requireItemIds: true }),
    ).toBeNull();
  });

  it("accepts when itemIds present", () => {
    const p = parseSpaceChangesResponseJson(
      { ok: true, items: [], itemIds: ["x"] },
      { requireItemIds: true },
    );
    expect(p?.itemIds).toEqual(["x"]);
  });

  it("parses itemLinksRevision when present", () => {
    const p = parseSpaceChangesResponseJson(
      { ok: true, items: [], itemIds: ["x"], itemLinksRevision: "3:99:abc" },
      { requireItemIds: true },
    );
    expect(p?.itemLinksRevision).toBe("3:99:abc");
  });

  it("rejects payload when an item row fails shape validation", () => {
    const p = parseSpaceChangesResponseJson(
      {
        ok: true,
        items: [
          {
            id: "i1",
            spaceId: "s1",
            itemType: "note",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            zIndex: 1,
            title: "t",
            contentText: 42,
          },
        ],
      },
      { requireItemIds: false },
    );
    expect(p).toBeNull();
  });
});

describe("applySpaceChangeGraphMerge", () => {
  function note(id: string, spaceId: string, title: string, updatedAt: string): CanvasItem {
    return {
      id,
      spaceId,
      itemType: "note",
      x: 0,
      y: 0,
      width: 280,
      height: 200,
      zIndex: 1,
      title,
      contentText: "",
      contentJson: { format: "html", html: "<div>x</div>" },
      updatedAt,
    };
  }

  it("applies tombstones from server id set", () => {
    const boot: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces: [{ id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" }],
      items: [note("a", "space-1", "A", "2020-01-01T00:00:00.000Z"), note("b", "space-1", "B", "2020-01-01T00:00:00.000Z")],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const next = applySpaceChangeGraphMerge({
      prev,
      activeSpaceId: "space-1",
      rawItems: [note("a", "space-1", "A2", "2020-01-02T00:00:00.000Z")],
      rawSpaceRows: [],
      serverItemIds: new Set(["a"]),
      protectedContentIds: new Set(),
      tombstoneExemptIds: new Set(),
    });
    expect(next.entities.b).toBeUndefined();
    expect(next.spaces["space-1"]?.entityIds).toEqual(["a"]);
  });
});

describe("collectItemServerUpdatedAtBumps", () => {
  it("skips protected ids", () => {
    const items: CanvasItem[] = [
      {
        id: "a",
        spaceId: "s",
        itemType: "note",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        zIndex: 1,
        title: "",
        contentText: "",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ];
    expect(collectItemServerUpdatedAtBumps(items, new Set(["a"]))).toEqual([]);
  });
});
