import { describe, expect, it } from "vitest";

import {
  graphLayoutPositionsFromMap,
  graphLayoutPositionsToMap,
  sanitizeGraphLayoutPositions,
} from "@/src/lib/graph-layout-cache-contract";

describe("graph-layout-cache-contract", () => {
  it("sanitizes finite points only", () => {
    const out = sanitizeGraphLayoutPositions({
      a: { x: 1, y: 2 },
      b: { x: Number.NaN, y: 2 },
      c: { x: 4, y: 5, z: 7 },
    });
    expect(out).toEqual({
      a: { x: 1, y: 2 },
      c: { x: 4, y: 5, z: 7 },
    });
  });

  it("round-trips map conversion", () => {
    const source = new Map<string, { x: number; y: number; z?: number }>([
      ["x", { x: 11, y: 22 }],
      ["y", { x: 33, y: 44, z: 3 }],
    ]);
    const serialized = graphLayoutPositionsFromMap(source);
    const restored = graphLayoutPositionsToMap(serialized);
    expect(restored.get("x")).toEqual({ x: 11, y: 22 });
    expect(restored.get("y")).toEqual({ x: 33, y: 44, z: 3 });
  });
});
