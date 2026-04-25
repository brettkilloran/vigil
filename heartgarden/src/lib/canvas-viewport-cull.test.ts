import { describe, expect, it } from "vitest";
import type {
  CanvasEntity,
  CanvasGraph,
} from "@/src/components/foundation/architectural-types";
import {
  approximateConnectionPinWorld,
  buildCullExceptionEntityIds,
  collapsedStackIntersectsWorldRect,
  connectionIntersectsWorldRect,
  entityIntersectsWorldRect,
  rectsIntersect,
  worldRectFromViewport,
} from "@/src/lib/canvas-viewport-cull";

function noteEntity(
  id: string,
  spaceId: string,
  x: number,
  y: number,
  width = 280
): Extract<CanvasEntity, { kind: "content" }> {
  return {
    id,
    kind: "content",
    title: "T",
    theme: "default",
    rotation: 0,
    width,
    tapeRotation: 0,
    tapeVariant: "clear",
    bodyHtml: "<div>x</div>",
    stackId: null,
    stackOrder: null,
    slots: { [spaceId]: { x, y } },
  };
}

describe("worldRectFromViewport", () => {
  it("maps viewport corners to world space at scale 1", () => {
    const r = worldRectFromViewport(0, 0, 1, 800, 600, 0);
    expect(r.left).toBeCloseTo(0);
    expect(r.top).toBeCloseTo(0);
    expect(r.right).toBe(800);
    expect(r.bottom).toBe(600);
  });

  it("expands by margin in world units", () => {
    const r = worldRectFromViewport(0, 0, 1, 100, 100, 10);
    expect(r.left).toBe(-10);
    expect(r.right).toBe(110);
  });

  it("scales correctly with zoom", () => {
    const r = worldRectFromViewport(0, 0, 2, 400, 400, 0);
    expect(r.right).toBe(200);
    expect(r.bottom).toBe(200);
  });
});

describe("entityIntersectsWorldRect", () => {
  const space = "s1";
  const rect = { left: 0, top: 0, right: 500, bottom: 400 };
  const emptyExc = new Set<string>();

  it("detects overlap", () => {
    const e = noteEntity("a", space, 100, 100);
    expect(entityIntersectsWorldRect(e, space, rect, emptyExc)).toBe(true);
  });

  it("detects non-overlap", () => {
    const e = noteEntity("a", space, 2000, 2000);
    expect(entityIntersectsWorldRect(e, space, rect, emptyExc)).toBe(false);
  });

  it("forces visible for exception ids", () => {
    const e = noteEntity("a", space, 2000, 2000);
    expect(entityIntersectsWorldRect(e, space, rect, new Set(["a"]))).toBe(
      true
    );
  });
});

describe("connectionIntersectsWorldRect", () => {
  const space = "s1";
  const pin = { anchor: "topLeftInset" as const, insetX: 14, insetY: 18 };
  const graph: CanvasGraph = {
    rootSpaceId: space,
    spaces: {
      [space]: {
        id: space,
        name: "R",
        parentSpaceId: null,
        entityIds: ["a", "b"],
      },
    },
    entities: {
      a: noteEntity("a", space, 0, 0),
      b: noteEntity("b", space, 400, 0),
    },
    connections: {},
  };
  const conn: CanvasPinConnection = {
    id: "c1",
    sourceEntityId: "a",
    targetEntityId: "b",
    sourcePin: pin,
    targetPin: pin,
    color: "#000",
    createdAt: 0,
    updatedAt: 0,
  };

  it("keeps long segment that crosses the viewport", () => {
    const worldRect = { left: 150, top: -100, right: 250, bottom: 500 };
    expect(
      connectionIntersectsWorldRect(conn, graph, space, worldRect, new Set())
    ).toBe(true);
  });

  it("drops segment fully outside", () => {
    const worldRect = { left: 5000, top: 5000, right: 5100, bottom: 5100 };
    expect(
      connectionIntersectsWorldRect(conn, graph, space, worldRect, new Set())
    ).toBe(false);
  });
});

describe("approximateConnectionPinWorld", () => {
  it("uses slot + default insets for content", () => {
    const space = "s1";
    const graph: CanvasGraph = {
      rootSpaceId: space,
      spaces: {
        [space]: {
          id: space,
          name: "R",
          parentSpaceId: null,
          entityIds: ["a"],
        },
      },
      entities: { a: noteEntity("a", space, 10, 20) },
      connections: {},
    };
    const p = approximateConnectionPinWorld(
      "a",
      { anchor: "topLeftInset", insetX: 0, insetY: 0 },
      space,
      graph
    );
    expect(p).toEqual({ x: 10 + 14, y: 20 + 18 });
  });
});

describe("buildCullExceptionEntityIds", () => {
  it("unions inputs", () => {
    const s = buildCullExceptionEntityIds({
      selectedNodeIds: ["a"],
      draggedNodeIds: ["b"],
      connectionSourceId: "c",
    });
    expect([...s].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("collapsedStackIntersectsWorldRect", () => {
  const space = "s1";
  const rect = { left: 0, top: 0, right: 100, bottom: 100 };

  it("true if union overlaps", () => {
    const entities = [
      noteEntity("a", space, 0, 0),
      noteEntity("b", space, 50, 50),
    ];
    expect(
      collapsedStackIntersectsWorldRect(entities, space, rect, new Set())
    ).toBe(true);
  });
});

describe("rectsIntersect", () => {
  it("false when separated", () => {
    expect(
      rectsIntersect(
        { left: 0, top: 0, right: 1, bottom: 1 },
        { left: 2, top: 2, right: 3, bottom: 3 }
      )
    ).toBe(false);
  });
});
