import { describe, expect, it } from "vitest";

import type { CanvasEntity, CanvasGraph } from "@/src/components/foundation/architectural-types";
import {
  CANVAS_BOUNDS_CONTENT_HEIGHT,
  CANVAS_BOUNDS_FOLDER_HEIGHT,
  CANVAS_BOUNDS_FOLDER_WIDTH,
  CANVAS_BOUNDS_UNIFIED_NODE_WIDTH,
  buildCollapsedStacksList,
  computeBoundsForEntitySubset,
  computeSpaceContentBounds,
  fitCameraToBounds,
  isContentMostlyOffScreen,
  rotatedRectWorldBounds,
  viewportWorldRect,
} from "@/src/lib/canvas-view-bounds";

const SPACE = "s1";

function content(
  id: string,
  x: number,
  y: number,
  opts?: Partial<Pick<CanvasEntity, "rotation" | "width" | "stackId" | "stackOrder">>,
): Extract<CanvasEntity, { kind: "content" }> {
  return {
    id,
    kind: "content",
    title: id,
    theme: "default",
    rotation: opts?.rotation ?? 0,
    width: opts?.width,
    tapeRotation: 0,
    tapeVariant: "clear",
    bodyHtml: "",
    stackId: opts?.stackId ?? null,
    stackOrder: opts?.stackOrder ?? null,
    slots: { [SPACE]: { x, y } },
  };
}

function folder(id: string, x: number, y: number, childSpaceId = "child"): Extract<CanvasEntity, { kind: "folder" }> {
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
    expect(withStacks!.maxX).toBeCloseTo(100 + CANVAS_BOUNDS_UNIFIED_NODE_WIDTH + 6);
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
    expect(b!.maxX).toBeGreaterThanOrEqual(500 + CANVAS_BOUNDS_UNIFIED_NODE_WIDTH);
    const b2 = computeBoundsForEntitySubset(g, SPACE, stacks, ["a", "bottom"]);
    expect(b2!.minX).toBeCloseTo(0);
    expect(b!.minX).toBeCloseTo(500);
    expect(b2!.maxX).toBeCloseTo(b!.maxX);
    expect(b2!.maxX).toBeGreaterThan(b2!.minX + CANVAS_BOUNDS_UNIFIED_NODE_WIDTH);
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

describe("viewportWorldRect + isContentMostlyOffScreen", () => {
  it("detects when viewport misses content", () => {
    const contentBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const on = viewportWorldRect(0, 0, 1, 800, 600);
    expect(isContentMostlyOffScreen(contentBox, on)).toBe(false);

    const far = viewportWorldRect(5000, 5000, 1, 800, 600);
    expect(isContentMostlyOffScreen(contentBox, far)).toBe(true);
  });
});
