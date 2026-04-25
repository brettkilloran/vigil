import { describe, expect, it } from "vitest";

import type {
  CanvasEntity,
  CanvasGraph,
} from "@/src/components/foundation/architectural-types";
import {
  buildCollapsedStacksList,
  CANVAS_BOUNDS_CONTENT_HEIGHT,
  CANVAS_BOUNDS_FOLDER_HEIGHT,
  CANVAS_BOUNDS_FOLDER_WIDTH,
  CANVAS_BOUNDS_UNIFIED_NODE_WIDTH,
  computeBoundsForEntitySubset,
  computeSpaceContentBounds,
  fitCameraToBounds,
  isContentMostlyOffScreen,
  listMinimapAtomRects,
  minimapLayoutSignature,
  minimapPlacementMapsEqual,
  rotatedRectWorldBounds,
  viewportWorldRect,
} from "@/src/lib/canvas-view-bounds";

const SPACE = "s1";

function content(
  id: string,
  x: number,
  y: number,
  opts?: Partial<
    Pick<
      CanvasEntity,
      "rotation" | "width" | "height" | "stackId" | "stackOrder"
    >
  >
): Extract<CanvasEntity, { kind: "content" }> {
  return {
    id,
    kind: "content",
    title: id,
    theme: "default",
    rotation: opts?.rotation ?? 0,
    width: opts?.width,
    height: opts?.height,
    tapeRotation: 0,
    tapeVariant: "clear",
    bodyHtml: "",
    stackId: opts?.stackId ?? null,
    stackOrder: opts?.stackOrder ?? null,
    slots: { [SPACE]: { x, y } },
  };
}

function folder(
  id: string,
  x: number,
  y: number,
  childSpaceId = "child"
): Extract<CanvasEntity, { kind: "folder" }> {
  return {
    id,
    kind: "folder",
    title: id,
    theme: "folder",
    rotation: 0,
    tapeRotation: 0,
    childSpaceId,
    slots: { [SPACE]: { x, y } },
  };
}

function graphWith(entities: CanvasEntity[]): CanvasGraph {
  const ids = entities.map((e) => e.id);
  const entMap = Object.fromEntries(entities.map((e) => [e.id, e]));
  return {
    rootSpaceId: SPACE,
    spaces: {
      [SPACE]: { id: SPACE, name: "S", parentSpaceId: null, entityIds: ids },
    },
    entities: entMap,
    connections: {},
  };
}

describe("computeSpaceContentBounds", () => {
  it("returns null for empty space", () => {
    const g = graphWith([]);
    expect(computeSpaceContentBounds(g, SPACE, [])).toBeNull();
  });

  it("uses default content width/height for notes", () => {
    const g = graphWith([content("a", 10, 20)]);
    const b = computeSpaceContentBounds(g, SPACE, []);
    expect(b).not.toBeNull();
    expect(b!.minX).toBeCloseTo(10);
    expect(b!.minY).toBeCloseTo(20);
    expect(b!.maxX).toBeCloseTo(10 + CANVAS_BOUNDS_UNIFIED_NODE_WIDTH);
    expect(b!.maxY).toBeCloseTo(20 + CANVAS_BOUNDS_CONTENT_HEIGHT);
  });

  it("uses folder default dimensions", () => {
    const g = graphWith([folder("f", 0, 0)]);
    const b = computeSpaceContentBounds(g, SPACE, []);
    expect(b!.maxX - b!.minX).toBeCloseTo(CANVAS_BOUNDS_FOLDER_WIDTH);
    expect(b!.maxY - b!.minY).toBeCloseTo(CANVAS_BOUNDS_FOLDER_HEIGHT);
  });

  it("treats multi-card stack as one footprint at stack slot", () => {
    const g = graphWith([
      content("bottom", 100, 100, { stackId: "st", stackOrder: 0 }),
      content("top", 100, 100, { stackId: "st", stackOrder: 1 }),
    ]);
    const stacks = buildCollapsedStacksList(g, SPACE);
    expect(stacks).toHaveLength(1);
    const solo = computeSpaceContentBounds(g, SPACE, []);
    const withStacks = computeSpaceContentBounds(g, SPACE, stacks);
    expect(withStacks!.maxX).toBeGreaterThan(solo!.maxX);
    expect(withStacks!.maxX).toBeCloseTo(
      100 + CANVAS_BOUNDS_UNIFIED_NODE_WIDTH + 6
    );
  });

  it("uses measured placement height when provided (DOM taller than graph default)", () => {
    const g = graphWith([content("a", 10, 20)]);
    const graphOnly = computeSpaceContentBounds(g, SPACE, []);
    const measured = new Map([["a", { width: 340, height: 900 }]]);
    const withDom = computeSpaceContentBounds(g, SPACE, [], measured);
    expect(withDom!.maxY - withDom!.minY).toBeGreaterThan(
      graphOnly!.maxY - graphOnly!.minY
    );
    expect(withDom!.maxY).toBeCloseTo(20 + 900);
  });
});

describe("minimapLayoutSignature", () => {
  it("changes when a card is unstacked (stackId / stackOrder)", () => {
    const stacked = graphWith([
      content("a", 0, 0, { stackId: "st", stackOrder: 0 }),
      content("b", 0, 0, { stackId: "st", stackOrder: 1 }),
    ]);
    const unstacked = graphWith([
      content("a", 0, 0, { stackId: null, stackOrder: null }),
      content("b", 10, 10, { stackId: null, stackOrder: null }),
    ]);
    expect(minimapLayoutSignature(stacked, SPACE)).not.toBe(
      minimapLayoutSignature(unstacked, SPACE)
    );
  });

  it("changes when a node moves in the active space (slot)", () => {
    const g1 = graphWith([content("a", 0, 0)]);
    const g2 = graphWith([content("a", 50, 0)]);
    expect(minimapLayoutSignature(g1, SPACE)).not.toBe(
      minimapLayoutSignature(g2, SPACE)
    );
  });
});

describe("minimapPlacementMapsEqual", () => {
  it("returns true for identical maps", () => {
    const a = new Map([
      ["x", { width: 100, height: 200 }],
      ["y", { width: 10, height: 10 }],
    ]);
    const b = new Map([
      ["x", { width: 100, height: 200 }],
      ["y", { width: 10, height: 10 }],
    ]);
    expect(minimapPlacementMapsEqual(a, b)).toBe(true);
  });

  it("returns false when dimensions differ", () => {
    const a = new Map([["x", { width: 100, height: 200 }]]);
    const b = new Map([["x", { width: 101, height: 200 }]]);
    expect(minimapPlacementMapsEqual(a, b)).toBe(false);
  });
});

describe("rotatedRectWorldBounds", () => {
  it("expands AABB for rotated non-square rect", () => {
    const axis = rotatedRectWorldBounds(0, 0, 200, 100, 0);
    const tilt = rotatedRectWorldBounds(0, 0, 200, 100, 30);
    expect(tilt.maxX - tilt.minX).toBeGreaterThan(axis.maxX - axis.minX);
    expect(tilt.maxY - tilt.minY).toBeGreaterThan(axis.maxY - axis.minY);
  });
});

describe("computeBoundsForEntitySubset", () => {
  it("includes full collapsed stack when one member is selected", () => {
    const g = graphWith([
      content("a", 0, 0),
      content("bottom", 500, 500, { stackId: "st", stackOrder: 0 }),
      content("top", 500, 500, { stackId: "st", stackOrder: 1 }),
    ]);
    const stacks = buildCollapsedStacksList(g, SPACE);
    const b = computeBoundsForEntitySubset(g, SPACE, stacks, ["bottom"]);
    expect(b).not.toBeNull();
    expect(b!.minX).toBeLessThanOrEqual(500);
    expect(b!.maxX).toBeGreaterThanOrEqual(
      500 + CANVAS_BOUNDS_UNIFIED_NODE_WIDTH
    );
    const b2 = computeBoundsForEntitySubset(g, SPACE, stacks, ["a", "bottom"]);
    expect(b2!.minX).toBeCloseTo(0);
    expect(b!.minX).toBeCloseTo(500);
    expect(b2!.maxX).toBeCloseTo(b!.maxX);
    expect(b2!.maxX).toBeGreaterThan(
      b2!.minX + CANVAS_BOUNDS_UNIFIED_NODE_WIDTH
    );
  });

  it("returns null for empty selection", () => {
    const g = graphWith([content("a", 0, 0)]);
    expect(computeBoundsForEntitySubset(g, SPACE, [], [])).toBeNull();
  });
});

describe("fitCameraToBounds", () => {
  it("centers bounds and scales to viewport with padding", () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const cam = fitCameraToBounds({
      bounds,
      viewportWidth: 500,
      viewportHeight: 500,
      paddingPx: 100,
      minZoom: 0.1,
      maxZoom: 10,
    });
    expect(cam.scale).toBeCloseTo(4);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    expect(cam.translateX).toBeCloseTo(500 / 2 - cx * cam.scale);
    expect(cam.translateY).toBeCloseTo(500 / 2 - cy * cam.scale);
  });
});

describe("listMinimapAtomRects", () => {
  it("uses slot, local size, and entity rotation for standalone nodes", () => {
    const g = graphWith([content("a", 100, 200, { rotation: 25 })]);
    const atoms = listMinimapAtomRects(g, SPACE, [], new Set());
    expect(atoms).toHaveLength(1);
    expect(atoms[0]!.x).toBe(100);
    expect(atoms[0]!.y).toBe(200);
    expect(atoms[0]!.width).toBe(CANVAS_BOUNDS_UNIFIED_NODE_WIDTH);
    expect(atoms[0]!.height).toBe(CANVAS_BOUNDS_CONTENT_HEIGHT);
    expect(atoms[0]!.rotationDeg).toBe(25);
  });

  it("uses entity height when set", () => {
    const g = graphWith([content("tall", 0, 0, { height: 420 })]);
    const atoms = listMinimapAtomRects(g, SPACE, [], new Set());
    expect(atoms[0]!.height).toBe(420);
  });

  it("prefers placementSizes over stale graph height for minimap rect", () => {
    const g = graphWith([content("doc", 0, 0, { height: 280 })]);
    const measured = new Map([["doc", { width: 340, height: 720 }]]);
    const atoms = listMinimapAtomRects(g, SPACE, [], new Set(), measured);
    expect(atoms[0]!.height).toBe(720);
    expect(atoms[0]!.width).toBe(340);
  });

  it("positions collapsed stack atom like top layer fan (offset + fan angle)", () => {
    const g = graphWith([
      content("bottom", 500, 500, { stackId: "st", stackOrder: 0 }),
      content("top", 500, 500, { stackId: "st", stackOrder: 1 }),
    ]);
    const stacks = buildCollapsedStacksList(g, SPACE);
    const atoms = listMinimapAtomRects(g, SPACE, stacks, new Set());
    const stackAtom = atoms.find((a) => a.key.startsWith("s:"));
    expect(stackAtom).toBeDefined();
    expect(stackAtom!.x).toBe(500 + 6);
    expect(stackAtom!.y).toBe(500 + 6);
    expect(stackAtom!.rotationDeg).toBeCloseTo(0.8);
  });
});

describe("viewportWorldRect + isContentMostlyOffScreen", () => {
  it("detects when viewport misses content", () => {
    const contentBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const on = viewportWorldRect(0, 0, 1, 800, 600);
    expect(isContentMostlyOffScreen(contentBox, on)).toBe(false);

    const far = viewportWorldRect(5000, 5000, 1, 800, 600);
    expect(isContentMostlyOffScreen(contentBox, far)).toBe(true);
  });
});
