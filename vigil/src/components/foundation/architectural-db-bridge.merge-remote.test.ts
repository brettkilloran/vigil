import { describe, expect, it } from "vitest";

import {
  mergeBootstrapView,
  mergeRemoteItemPatches,
  mergeRemoteSpaceRowsIntoGraph,
  removeEntitiesFromGraphAfterRemoteDelete,
  applyServerCanvasItemToGraph,
  type BootstrapResponse,
  buildCanvasGraphFromBootstrap,
} from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasPinConnection } from "@/src/components/foundation/architectural-types";
import type { CanvasItem } from "@/src/model/canvas-types";

function noteItem(id: string, spaceId: string, title: string, updatedAt: string): CanvasItem {
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
    contentJson: { format: "html", html: "<div contenteditable=\"true\">x</div>" },
    updatedAt,
  };
}

describe("mergeRemoteItemPatches", () => {
  it("updates title from changed item and removes deleted id", () => {
    const boot: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces: [{ id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" }],
      items: [noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"), noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z")],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const changed = [noteItem("a", "space-1", "A2", "2020-01-02T00:00:00.000Z")];
    const serverIds = new Set<string>(["a"]);
    const next = mergeRemoteItemPatches(prev, changed, serverIds, ["space-1"]);
    expect(next.entities.a?.title).toBe("A2");
    expect(next.entities.b).toBeUndefined();
    expect(next.spaces["space-1"]?.entityIds).toEqual(["a"]);
  });

  it("does not tombstone ids in the exempt set when missing from server list", () => {
    const boot: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces: [{ id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" }],
      items: [noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"), noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z")],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const changed = [noteItem("a", "space-1", "A2", "2020-01-02T00:00:00.000Z")];
    const serverIds = new Set<string>(["a"]);
    const next = mergeRemoteItemPatches(prev, changed, serverIds, ["space-1"], new Set(), new Set(["b"]));
    expect(next.entities.b?.title).toBe("B");
    expect([...(next.spaces["space-1"]?.entityIds ?? [])].sort()).toEqual(["a", "b"]);
  });

  it("keeps local title and body when id is protected but applies geometry from server", () => {
    const boot: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces: [{ id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" }],
      items: [noteItem("a", "space-1", "ServerTitle", "2020-01-01T00:00:00.000Z")],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prevBase = buildCanvasGraphFromBootstrap(boot);
    const ent = prevBase.entities.a;
    if (!ent || ent.kind !== "content") throw new Error("expected content entity");
    const prev = {
      ...prevBase,
      entities: {
        ...prevBase.entities,
        a: {
          ...ent,
          title: "LocalTitle",
          bodyHtml: "<div>local draft</div>",
        },
      },
    };
    const remote = noteItem("a", "space-1", "RemoteTitle", "2020-01-02T00:00:00.000Z");
    remote.x = 120;
    remote.y = 240;
    remote.contentJson = { format: "html", html: "<div>server html</div>" };
    const serverIds = new Set<string>(["a"]);
    const next = mergeRemoteItemPatches(prev, [remote], serverIds, ["space-1"], new Set(["a"]));
    const out = next.entities.a;
    expect(out?.kind).toBe("content");
    if (out?.kind !== "content") return;
    expect(out.title).toBe("LocalTitle");
    expect(out.bodyHtml).toBe("<div>local draft</div>");
    expect(out.slots["space-1"]).toEqual({ x: 120, y: 240 });
  });

  it("moves entity to another space in subtree when server row changes spaceId", () => {
    const boot: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces: [
        { id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" },
        { id: "space-2", name: "Child", parentSpaceId: "space-1", updatedAt: "2020-01-01T00:00:00.000Z" },
      ],
      items: [noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z")],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const moved = noteItem("a", "space-2", "A", "2020-01-02T00:00:00.000Z");
    const subtree = ["space-1", "space-2"];
    const next = mergeRemoteItemPatches(prev, [moved], new Set(["a"]), subtree);
    expect(next.entities.a?.id).toBe("a");
    expect(next.spaces["space-1"]?.entityIds).toEqual([]);
    expect(next.spaces["space-2"]?.entityIds).toEqual(["a"]);
  });

  it("with null server id set skips remote tombstones but still applies changed rows", () => {
    const boot: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces: [{ id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" }],
      items: [noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"), noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z")],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const changed = [noteItem("a", "space-1", "A2", "2020-01-02T00:00:00.000Z")];
    const next = mergeRemoteItemPatches(prev, changed, null, ["space-1"]);
    expect(next.entities.a?.title).toBe("A2");
    expect(next.entities.b?.title).toBe("B");
    expect([...(next.spaces["space-1"]?.entityIds ?? [])].sort()).toEqual(["a", "b"]);
  });
});

describe("mergeBootstrapView", () => {
  it("keeps entity when item moved to another affected space in the same payload", () => {
    const bootPrev: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces: [
        { id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" },
        { id: "space-2", name: "Child", parentSpaceId: "space-1", updatedAt: "2020-01-01T00:00:00.000Z" },
      ],
      items: [
        noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"),
        noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z"),
      ],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(bootPrev);
    const bootNext: BootstrapResponse = {
      ...bootPrev,
      items: [
        noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z"),
        noteItem("a", "space-2", "A", "2020-01-02T00:00:00.000Z"),
      ],
    };
    const next = mergeBootstrapView(prev, bootNext);
    expect(next.entities.a?.title).toBe("A");
    expect(next.entities.b?.title).toBe("B");
    expect([...(next.spaces["space-1"]?.entityIds ?? [])].sort()).toEqual(["b"]);
    expect(next.spaces["space-2"]?.entityIds).toEqual(["a"]);
  });

  it("batch-removes many stale ids without per-id full graph scans", () => {
    const spaces = [
      { id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" },
      ...Array.from({ length: 24 }, (_, i) => ({
        id: `space-x-${i}`,
        name: `X${i}`,
        parentSpaceId: "space-1" as string | null,
        updatedAt: "2020-01-01T00:00:00.000Z",
      })),
    ];
    const items = [
      noteItem("keep", "space-1", "Keep", "2020-01-01T00:00:00.000Z"),
      ...Array.from({ length: 24 }, (_, i) =>
        noteItem(`stale-${i}`, "space-1", `S${i}`, "2020-01-01T00:00:00.000Z"),
      ),
    ];
    const bootFull: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces,
      items,
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(bootFull);
    const bootTrimmed: BootstrapResponse = {
      ...bootFull,
      items: [noteItem("keep", "space-1", "Keep", "2020-01-01T00:00:00.000Z")],
    };
    const next = mergeBootstrapView(prev, bootTrimmed);
    expect(Object.keys(next.entities).sort()).toEqual(["keep"]);
    expect(next.spaces["space-1"]?.entityIds).toEqual(["keep"]);
  });

  it("preserves connections between entities that still exist after merge", () => {
    const boot: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces: [{ id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" }],
      items: [
        noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"),
        noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z"),
      ],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const thread: CanvasPinConnection = {
      id: "local-conn-1",
      sourceEntityId: "a",
      targetEntityId: "b",
      sourcePin: { anchor: "topLeftInset", insetX: 12, insetY: 12 },
      targetPin: { anchor: "topLeftInset", insetX: 12, insetY: 12 },
      color: "#888",
      linkType: "pin",
      slackMultiplier: 1,
      createdAt: 1,
      updatedAt: 1,
      syncState: "local-only",
      syncError: null,
    };
    prev.connections[thread.id] = thread;
    const bootNext: BootstrapResponse = {
      ...boot,
      items: [
        noteItem("a", "space-1", "A2", "2020-01-02T00:00:00.000Z"),
        noteItem("b", "space-1", "B2", "2020-01-02T00:00:00.000Z"),
      ],
    };
    const next = mergeBootstrapView(prev, bootNext);
    expect(next.connections[thread.id]).toEqual(thread);
  });

  it("drops connections when an endpoint entity is removed by merge", () => {
    const bootFull: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces: [{ id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" }],
      items: [
        noteItem("keep", "space-1", "Keep", "2020-01-01T00:00:00.000Z"),
        noteItem("gone", "space-1", "Gone", "2020-01-01T00:00:00.000Z"),
      ],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(bootFull);
    const thread: CanvasPinConnection = {
      id: "c1",
      sourceEntityId: "keep",
      targetEntityId: "gone",
      sourcePin: { anchor: "topLeftInset", insetX: 12, insetY: 12 },
      targetPin: { anchor: "topLeftInset", insetX: 12, insetY: 12 },
      color: "#888",
      linkType: "pin",
      slackMultiplier: 1,
      createdAt: 1,
      updatedAt: 1,
      syncState: "synced",
      dbLinkId: "00000000-0000-4000-8000-0000000000aa",
      syncError: null,
    };
    prev.connections[thread.id] = thread;
    const bootTrimmed: BootstrapResponse = {
      ...bootFull,
      items: [noteItem("keep", "space-1", "Keep", "2020-01-01T00:00:00.000Z")],
    };
    const next = mergeBootstrapView(prev, bootTrimmed);
    expect(next.connections[thread.id]).toBeUndefined();
  });
});

describe("applyServerCanvasItemToGraph", () => {
  it("moves item between spaces without scanning empty entity lists for mutation", () => {
    const spaces = [
      { id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" },
      { id: "space-2", name: "Child", parentSpaceId: "space-1", updatedAt: "2020-01-01T00:00:00.000Z" },
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `space-e-${i}`,
        name: `E${i}`,
        parentSpaceId: "space-1" as string | null,
        updatedAt: "2020-01-01T00:00:00.000Z",
      })),
    ];
    const boot: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces,
      items: [noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z")],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const moved = noteItem("a", "space-2", "A2", "2020-01-02T00:00:00.000Z");
    const next = applyServerCanvasItemToGraph(prev, moved);
    expect(next.entities.a?.title).toBe("A2");
    expect(next.spaces["space-1"]?.entityIds).toEqual([]);
    expect(next.spaces["space-2"]?.entityIds).toEqual(["a"]);
  });
});

describe("mergeRemoteSpaceRowsIntoGraph", () => {
  it("updates parentSpaceId and name while keeping entityIds", () => {
    const boot: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces: [
        { id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" },
        { id: "space-2", name: "Inner", parentSpaceId: "space-1", updatedAt: "2020-01-01T00:00:00.000Z" },
      ],
      items: [],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    prev.spaces["space-2"]!.entityIds = ["note-1"];
    const next = mergeRemoteSpaceRowsIntoGraph(prev, [
      { id: "space-2", name: "RenamedInner", parentSpaceId: "space-99" },
    ]);
    expect(next.spaces["space-2"]?.name).toBe("RenamedInner");
    expect(next.spaces["space-2"]?.parentSpaceId).toBe("space-99");
    expect(next.spaces["space-2"]?.entityIds).toEqual(["note-1"]);
  });
});

describe("removeEntitiesFromGraphAfterRemoteDelete", () => {
  it("drops entity from spaces and connections", () => {
    const boot: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces: [{ id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" }],
      items: [noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z")],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const pin = { anchor: "topLeftInset" as const, insetX: 0, insetY: 0 };
    const withConn = {
      ...prev,
      connections: {
        c1: {
          id: "c1",
          sourceEntityId: "a",
          targetEntityId: "a",
          sourcePin: pin,
          targetPin: pin,
          color: "#000",
          createdAt: 0,
          updatedAt: 0,
        },
      },
    };
    const next = removeEntitiesFromGraphAfterRemoteDelete(withConn, ["a"]);
    expect(next.entities.a).toBeUndefined();
    expect(next.spaces["space-1"]?.entityIds).toEqual([]);
    expect(next.connections.c1).toBeUndefined();
  });
});
