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
    bodyHtml: "<div>x</div>",
    id,
    kind: "content",
    rotation: 0,
    slots: { [spaceId]: { x, y } },
    stackId: null,
    stackOrder: null,
    tapeRotation: 0,
    tapeVariant: "clear",
    theme: "default",
    title: "T",
    width,
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
  const rect = { bottom: 400, left: 0, right: 500, top: 0 };
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
    connections: {},
    entities: {
      a: noteEntity("a", space, 0, 0),
      b: noteEntity("b", space, 400, 0),
    },
    rootSpaceId: space,
    spaces: {
      [space]: {
        entityIds: ["a", "b"],
        id: space,
        name: "R",
        parentSpaceId: null,
      },
    },
  };
  const conn: CanvasPinConnection = {
    color: "#000",
    createdAt: 0,
    id: "c1",
    sourceEntityId: "a",
    sourcePin: pin,
    targetEntityId: "b",
    targetPin: pin,
    updatedAt: 0,
  };

  it("keeps long segment that crosses the viewport", () => {
    const worldRect = { bottom: 500, left: 150, right: 250, top: -100 };
    expect(
      connectionIntersectsWorldRect(conn, graph, space, worldRect, new Set())
    ).toBe(true);
  });

  it("drops segment fully outside", () => {
    const worldRect = { bottom: 5100, left: 5000, right: 5100, top: 5000 };
    expect(
      connectionIntersectsWorldRect(conn, graph, space, worldRect, new Set())
    ).toBe(false);
  });
});

describe("approximateConnectionPinWorld", () => {
  it("uses slot + default insets for content", () => {
    const space = "s1";
    const graph: CanvasGraph = {
      connections: {},
      entities: { a: noteEntity("a", space, 10, 20) },
      rootSpaceId: space,
      spaces: {
        [space]: {
          entityIds: ["a"],
          id: space,
          name: "R",
          parentSpaceId: null,
        },
      },
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
      connectionSourceId: "c",
      draggedNodeIds: ["b"],
      selectedNodeIds: ["a"],
    });
    expect([...s].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("collapsedStackIntersectsWorldRect", () => {
  const space = "s1";
  const rect = { bottom: 100, left: 0, right: 100, top: 0 };

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
        { bottom: 1, left: 0, right: 1, top: 0 },
        { bottom: 3, left: 2, right: 3, top: 2 }
      )
    ).toBe(false);
  });
});
