import { describe, expect, it } from "vitest";

import {
  applyServerCanvasItemToGraph,
  type BootstrapResponse,
  buildCanvasGraphFromBootstrap,
  mergeBootstrapView,
  mergeRemoteItemPatches,
  mergeRemoteSpaceRowsIntoGraph,
  removeEntitiesFromGraphAfterRemoteDelete,
} from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasPinConnection } from "@/src/components/foundation/architectural-types";
import type { CanvasItem } from "@/src/model/canvas-types";

function noteItem(
  id: string,
  spaceId: string,
  title: string,
  updatedAt: string
): CanvasItem {
  return {
    contentJson: {
      format: "html",
      html: '<div contenteditable="true">x</div>',
    },
    contentText: "",
    height: 200,
    id,
    itemType: "note",
    spaceId,
    title,
    updatedAt,
    width: 280,
    x: 0,
    y: 0,
    zIndex: 1,
  };
}

function folderItem(
  id: string,
  spaceId: string,
  childSpaceId: string,
  title: string,
  updatedAt: string,
  folderColorScheme?: string
): CanvasItem {
  return {
    contentJson: {
      folder: { childSpaceId },
      hgArch:
        typeof folderColorScheme === "string" ? { folderColorScheme } : {},
    },
    contentText: "",
    height: 200,
    id,
    itemType: "folder",
    spaceId,
    title,
    updatedAt,
    width: 280,
    x: 0,
    y: 0,
    zIndex: 1,
  };
}

describe("mergeRemoteItemPatches", () => {
  it("updates title from changed item and removes deleted id", () => {
    const boot: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [
        noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"),
        noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z"),
      ],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const changed = [
      noteItem("a", "space-1", "A2", "2020-01-02T00:00:00.000Z"),
    ];
    const serverIds = new Set<string>(["a"]);
    const next = mergeRemoteItemPatches(prev, changed, serverIds, ["space-1"]);
    expect(next.entities.a?.title).toBe("A2");
    expect(next.entities.b).toBeUndefined();
    expect(next.spaces["space-1"]?.entityIds).toEqual(["a"]);
  });

  it("drops pin threads when a tombstoned entity is removed", () => {
    const boot: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [
        noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"),
        noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z"),
      ],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const prevBase = buildCanvasGraphFromBootstrap(boot);
    const thread: CanvasPinConnection = {
      color: "#888",
      createdAt: 1,
      dbLinkId: "00000000-0000-4000-8000-0000000000bb",
      id: "conn-1",
      linkType: "pin",
      slackMultiplier: 1,
      sourceEntityId: "a",
      sourcePin: { anchor: "topLeftInset", insetX: 12, insetY: 12 },
      syncError: null,
      syncState: "synced",
      targetEntityId: "b",
      targetPin: { anchor: "topLeftInset", insetX: 12, insetY: 12 },
      updatedAt: 1,
    };
    const prev = {
      ...prevBase,
      connections: { ...prevBase.connections, [thread.id]: thread },
    };
    const changed = [
      noteItem("a", "space-1", "A2", "2020-01-02T00:00:00.000Z"),
    ];
    const serverIds = new Set<string>(["a"]);
    const next = mergeRemoteItemPatches(prev, changed, serverIds, ["space-1"]);
    expect(next.entities.b).toBeUndefined();
    expect(next.connections[thread.id]).toBeUndefined();
  });

  it("does not tombstone ids in the exempt set when missing from server list", () => {
    const boot: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [
        noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"),
        noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z"),
      ],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const changed = [
      noteItem("a", "space-1", "A2", "2020-01-02T00:00:00.000Z"),
    ];
    const serverIds = new Set<string>(["a"]);
    const next = mergeRemoteItemPatches(
      prev,
      changed,
      serverIds,
      ["space-1"],
      new Set(),
      new Set(["b"])
    );
    expect(next.entities.b?.title).toBe("B");
    expect([...(next.spaces["space-1"]?.entityIds ?? [])].sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("keeps local title and body when id is protected but applies geometry from server", () => {
    const boot: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [
        noteItem("a", "space-1", "ServerTitle", "2020-01-01T00:00:00.000Z"),
      ],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const prevBase = buildCanvasGraphFromBootstrap(boot);
    const ent = prevBase.entities.a;
    if (!ent || ent.kind !== "content") {
      throw new Error("expected content entity");
    }
    const prev = {
      ...prevBase,
      entities: {
        ...prevBase.entities,
        a: {
          ...ent,
          bodyHtml: "<div>local draft</div>",
          title: "LocalTitle",
        },
      },
    };
    const remote = noteItem(
      "a",
      "space-1",
      "RemoteTitle",
      "2020-01-02T00:00:00.000Z"
    );
    remote.x = 120;
    remote.y = 240;
    remote.contentJson = { format: "html", html: "<div>server html</div>" };
    const serverIds = new Set<string>(["a"]);
    const next = mergeRemoteItemPatches(
      prev,
      [remote],
      serverIds,
      ["space-1"],
      new Set(["a"])
    );
    const out = next.entities.a;
    expect(out?.kind).toBe("content");
    if (out?.kind !== "content") {
      return;
    }
    expect(out.title).toBe("LocalTitle");
    expect(out.bodyHtml).toBe("<div>local draft</div>");
    expect(out.slots["space-1"]).toEqual({ x: 120, y: 240 });
  });

  it("keeps local folder title when folder id is protected but applies layout from server", () => {
    const childSpace = "space-child-1";
    const boot: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [
        folderItem(
          "fol1",
          "space-1",
          childSpace,
          "LocalFolder",
          "2020-01-01T00:00:00.000Z"
        ),
      ],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
        {
          id: childSpace,
          name: "Inside",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const remote = folderItem(
      "fol1",
      "space-1",
      childSpace,
      "RemoteFolder",
      "2020-01-02T00:00:00.000Z"
    );
    remote.x = 50;
    remote.y = 60;
    const next = mergeRemoteItemPatches(
      prev,
      [remote],
      new Set(["fol1"]),
      ["space-1"],
      new Set(["fol1"])
    );
    const f = next.entities.fol1;
    expect(f?.kind).toBe("folder");
    if (f?.kind !== "folder") {
      return;
    }
    expect(f.title).toBe("LocalFolder");
    expect(f.slots["space-1"]).toEqual({ x: 50, y: 60 });
  });

  it("keeps local folder tint when folder id is protected and server row is stale", () => {
    const childSpace = "space-child-2";
    const boot: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [
        folderItem(
          "fol2",
          "space-1",
          childSpace,
          "Tinted",
          "2020-01-01T00:00:00.000Z",
          "ocean"
        ),
      ],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
        {
          id: childSpace,
          name: "Inside",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const local = prev.entities.fol2;
    expect(local?.kind).toBe("folder");
    if (local?.kind !== "folder") {
      return;
    }
    local.folderColorScheme = "violet";
    const remote = folderItem(
      "fol2",
      "space-1",
      childSpace,
      "Tinted",
      "2020-01-02T00:00:00.000Z",
      "ocean"
    );
    const next = mergeRemoteItemPatches(
      prev,
      [remote],
      new Set(["fol2"]),
      ["space-1"],
      new Set(["fol2"])
    );
    const folder = next.entities.fol2;
    expect(folder?.kind).toBe("folder");
    if (folder?.kind !== "folder") {
      return;
    }
    expect(folder.folderColorScheme).toBe("violet");
  });

  it("moves entity to another space in subtree when server row changes spaceId", () => {
    const boot: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z")],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
        {
          id: "space-2",
          name: "Child",
          parentSpaceId: "space-1",
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
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
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [
        noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"),
        noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z"),
      ],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const changed = [
      noteItem("a", "space-1", "A2", "2020-01-02T00:00:00.000Z"),
    ];
    const next = mergeRemoteItemPatches(prev, changed, null, ["space-1"]);
    expect(next.entities.a?.title).toBe("A2");
    expect(next.entities.b?.title).toBe("B");
    expect([...(next.spaces["space-1"]?.entityIds ?? [])].sort()).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("mergeBootstrapView", () => {
  it("keeps entity when item moved to another affected space in the same payload", () => {
    const bootPrev: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [
        noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"),
        noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z"),
      ],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
        {
          id: "space-2",
          name: "Child",
          parentSpaceId: "space-1",
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
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
    expect([...(next.spaces["space-1"]?.entityIds ?? [])].sort()).toEqual([
      "b",
    ]);
    expect(next.spaces["space-2"]?.entityIds).toEqual(["a"]);
  });

  it("batch-removes many stale ids without per-id full graph scans", () => {
    const spaces = [
      {
        id: "space-1",
        name: "Root",
        parentSpaceId: null,
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
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
        noteItem(`stale-${i}`, "space-1", `S${i}`, "2020-01-01T00:00:00.000Z")
      ),
    ];
    const bootFull: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items,
      ok: true,
      spaceId: "space-1",
      spaces,
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
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [
        noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"),
        noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z"),
      ],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const thread: CanvasPinConnection = {
      color: "#888",
      createdAt: 1,
      id: "local-conn-1",
      linkType: "pin",
      slackMultiplier: 1,
      sourceEntityId: "a",
      sourcePin: { anchor: "topLeftInset", insetX: 12, insetY: 12 },
      syncError: null,
      syncState: "local-only",
      targetEntityId: "b",
      targetPin: { anchor: "topLeftInset", insetX: 12, insetY: 12 },
      updatedAt: 1,
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
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [
        noteItem("keep", "space-1", "Keep", "2020-01-01T00:00:00.000Z"),
        noteItem("gone", "space-1", "Gone", "2020-01-01T00:00:00.000Z"),
      ],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const prev = buildCanvasGraphFromBootstrap(bootFull);
    const thread: CanvasPinConnection = {
      color: "#888",
      createdAt: 1,
      dbLinkId: "00000000-0000-4000-8000-0000000000aa",
      id: "c1",
      linkType: "pin",
      slackMultiplier: 1,
      sourceEntityId: "keep",
      sourcePin: { anchor: "topLeftInset", insetX: 12, insetY: 12 },
      syncError: null,
      syncState: "synced",
      targetEntityId: "gone",
      targetPin: { anchor: "topLeftInset", insetX: 12, insetY: 12 },
      updatedAt: 1,
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
      {
        id: "space-1",
        name: "Root",
        parentSpaceId: null,
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
      {
        id: "space-2",
        name: "Child",
        parentSpaceId: "space-1",
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `space-e-${i}`,
        name: `E${i}`,
        parentSpaceId: "space-1" as string | null,
        updatedAt: "2020-01-01T00:00:00.000Z",
      })),
    ];
    const boot: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z")],
      ok: true,
      spaceId: "space-1",
      spaces,
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const moved = noteItem("a", "space-2", "A2", "2020-01-02T00:00:00.000Z");
    const next = applyServerCanvasItemToGraph(prev, moved);
    expect(next.entities.a?.title).toBe("A2");
    expect(next.spaces["space-1"]?.entityIds).toEqual([]);
    expect(next.spaces["space-2"]?.entityIds).toEqual(["a"]);
  });

  it("does not prune pin connections when applyServerCanvasItemToGraph moves an entity (policy: connections unchanged)", () => {
    const boot: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [
        noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"),
        noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z"),
      ],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
        {
          id: "space-2",
          name: "Child",
          parentSpaceId: "space-1",
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const prevBase = buildCanvasGraphFromBootstrap(boot);
    const thread: CanvasPinConnection = {
      color: "#888",
      createdAt: 1,
      dbLinkId: "00000000-0000-4000-8000-0000000000cc",
      id: "conn-move",
      linkType: "pin",
      slackMultiplier: 1,
      sourceEntityId: "a",
      sourcePin: { anchor: "topLeftInset", insetX: 12, insetY: 12 },
      syncError: null,
      syncState: "synced",
      targetEntityId: "b",
      targetPin: { anchor: "topLeftInset", insetX: 12, insetY: 12 },
      updatedAt: 1,
    };
    const prev = {
      ...prevBase,
      connections: { ...prevBase.connections, [thread.id]: thread },
    };
    const moved = noteItem("a", "space-2", "A2", "2020-01-02T00:00:00.000Z");
    const next = applyServerCanvasItemToGraph(prev, moved);
    expect(next.connections[thread.id]).toEqual(thread);
  });
});

describe("mergeRemoteSpaceRowsIntoGraph", () => {
  it("inserts stub space row when id was unknown to the client", () => {
    const boot: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const next = mergeRemoteSpaceRowsIntoGraph(prev, [
      { id: "space-new", name: "Appeared", parentSpaceId: "space-1" },
    ]);
    expect(next.spaces["space-new"]).toEqual({
      entityIds: [],
      id: "space-new",
      name: "Appeared",
      parentSpaceId: "space-1",
    });
  });

  it("updates parentSpaceId and name while keeping entityIds", () => {
    const boot: BootstrapResponse = {
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
        {
          id: "space-2",
          name: "Inner",
          parentSpaceId: "space-1",
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
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
      camera: { x: 0, y: 0, zoom: 1 },
      demo: false,
      items: [noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z")],
      ok: true,
      spaceId: "space-1",
      spaces: [
        {
          id: "space-1",
          name: "Root",
          parentSpaceId: null,
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const pin = { anchor: "topLeftInset" as const, insetX: 0, insetY: 0 };
    const withConn = {
      ...prev,
      connections: {
        c1: {
          color: "#000",
          createdAt: 0,
          id: "c1",
          sourceEntityId: "a",
          sourcePin: pin,
          targetEntityId: "a",
          targetPin: pin,
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
