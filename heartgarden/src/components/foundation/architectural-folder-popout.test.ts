import { describe, expect, it } from "vitest";

import type {
  CanvasEntity,
  CanvasGraph,
} from "@/src/components/foundation/architectural-types";

import {
  applyFolderPopOutPlan,
  collectFolderPopOutPlan,
} from "./architectural-folder-popout";

function content(
  id: string,
  slots: CanvasEntity["slots"]
): Extract<CanvasEntity, { kind: "content" }> {
  return {
    bodyHtml: "",
    id,
    kind: "content",
    rotation: 0,
    slots,
    tapeRotation: 0,
    theme: "default",
    title: id,
  };
}

function folder(
  id: string,
  childSpaceId: string,
  slots: CanvasEntity["slots"]
): Extract<CanvasEntity, { kind: "folder" }> {
  return {
    childSpaceId,
    id,
    kind: "folder",
    rotation: 0,
    slots,
    tapeRotation: 0,
    theme: "folder",
    title: id,
  };
}

function baseGraph(): CanvasGraph {
  return {
    connections: {},
    entities: {},
    rootSpaceId: "root",
    spaces: {
      root: { entityIds: [], id: "root", name: "Root", parentSpaceId: null },
    },
  };
}

describe("folder pop-out planning", () => {
  it("returns an empty move plan for an empty folder", () => {
    const graph = baseGraph();
    graph.entities.folderA = folder("folderA", "spaceA", {
      root: { x: 100, y: 100 },
    });
    graph.spaces.root.entityIds = ["folderA"];
    graph.spaces.spaceA = {
      entityIds: [],
      id: "spaceA",
      name: "A",
      parentSpaceId: "root",
    };

    const plan = collectFolderPopOutPlan(graph, ["folderA"]);

    expect(plan.entityMoves).toEqual([]);
    expect(plan.spaceReparents).toEqual([]);
    expect(plan.folderEntityIds).toEqual(["folderA"]);
    expect(plan.emptiedSpaceIds).toEqual(["spaceA"]);
  });

  it("moves immediate children into parent space with relative offsets", () => {
    const graph = baseGraph();
    graph.entities.folderA = folder("folderA", "spaceA", {
      root: { x: 300, y: 200 },
    });
    graph.entities.note1 = content("note1", { spaceA: { x: 20, y: 35 } });
    graph.entities.subFolder = folder("subFolder", "spaceB", {
      spaceA: { x: -10, y: 25 },
    });
    graph.spaces.root.entityIds = ["folderA"];
    graph.spaces.spaceA = {
      entityIds: ["note1", "subFolder"],
      id: "spaceA",
      name: "A",
      parentSpaceId: "root",
    };
    graph.spaces.spaceB = {
      entityIds: [],
      id: "spaceB",
      name: "B",
      parentSpaceId: "spaceA",
    };

    const plan = collectFolderPopOutPlan(graph, ["folderA"]);

    expect(plan.entityMoves).toEqual([
      {
        entityId: "note1",
        fromSpaceId: "spaceA",
        newSlot: { x: 320, y: 235 },
        toSpaceId: "root",
      },
      {
        entityId: "subFolder",
        fromSpaceId: "spaceA",
        newSlot: { x: 290, y: 225 },
        toSpaceId: "root",
      },
    ]);
    expect(plan.spaceReparents).toEqual([
      { newParentId: "root", spaceId: "spaceB" },
    ]);
  });

  it("applies moves without deleting child connections", () => {
    const graph = baseGraph();
    graph.entities.folderA = folder("folderA", "spaceA", {
      root: { x: 50, y: 60 },
    });
    graph.entities.note1 = content("note1", { spaceA: { x: 5, y: 5 } });
    graph.entities.note2 = content("note2", { spaceA: { x: 15, y: 15 } });
    graph.spaces.root.entityIds = ["folderA"];
    graph.spaces.spaceA = {
      entityIds: ["note1", "note2"],
      id: "spaceA",
      name: "A",
      parentSpaceId: "root",
    };
    graph.connections.c1 = {
      color: "#fff",
      createdAt: 1,
      id: "c1",
      sourceEntityId: "note1",
      sourcePin: { anchor: "topLeftInset", insetX: 10, insetY: 10 },
      targetEntityId: "note2",
      targetPin: { anchor: "topLeftInset", insetX: 10, insetY: 10 },
      updatedAt: 1,
    };

    const plan = collectFolderPopOutPlan(graph, ["folderA"]);
    const next = applyFolderPopOutPlan(graph, plan);

    expect(next.spaces.spaceA.entityIds).toEqual([]);
    expect(next.spaces.root.entityIds).toEqual(["folderA", "note1", "note2"]);
    expect(next.entities.note1.slots).toEqual({ root: { x: 55, y: 65 } });
    expect(next.entities.note2.slots).toEqual({ root: { x: 65, y: 75 } });
    expect(next.connections.c1).toBeDefined();
  });
});
