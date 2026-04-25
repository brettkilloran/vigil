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
    id,
    kind: "content",
    theme: "default",
    title: id,
    rotation: 0,
    tapeRotation: 0,
    slots,
    bodyHtml: "",
  };
}

function folder(
  id: string,
  childSpaceId: string,
  slots: CanvasEntity["slots"]
): Extract<CanvasEntity, { kind: "folder" }> {
  return {
    id,
    kind: "folder",
    theme: "folder",
    title: id,
    rotation: 0,
    tapeRotation: 0,
    slots,
    childSpaceId,
  };
}

function baseGraph(): CanvasGraph {
  return {
    rootSpaceId: "root",
    spaces: {
      root: { id: "root", name: "Root", parentSpaceId: null, entityIds: [] },
    },
    entities: {},
    connections: {},
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
      id: "spaceA",
      name: "A",
      parentSpaceId: "root",
      entityIds: [],
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
      id: "spaceA",
      name: "A",
      parentSpaceId: "root",
      entityIds: ["note1", "subFolder"],
    };
    graph.spaces.spaceB = {
      id: "spaceB",
      name: "B",
      parentSpaceId: "spaceA",
      entityIds: [],
    };

    const plan = collectFolderPopOutPlan(graph, ["folderA"]);

    expect(plan.entityMoves).toEqual([
      {
        entityId: "note1",
        fromSpaceId: "spaceA",
        toSpaceId: "root",
        newSlot: { x: 320, y: 235 },
      },
      {
        entityId: "subFolder",
        fromSpaceId: "spaceA",
        toSpaceId: "root",
        newSlot: { x: 290, y: 225 },
      },
    ]);
    expect(plan.spaceReparents).toEqual([
      { spaceId: "spaceB", newParentId: "root" },
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
      id: "spaceA",
      name: "A",
      parentSpaceId: "root",
      entityIds: ["note1", "note2"],
    };
    graph.connections.c1 = {
      id: "c1",
      sourceEntityId: "note1",
      targetEntityId: "note2",
      sourcePin: { anchor: "topLeftInset", insetX: 10, insetY: 10 },
      targetPin: { anchor: "topLeftInset", insetX: 10, insetY: 10 },
      color: "#fff",
      createdAt: 1,
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
