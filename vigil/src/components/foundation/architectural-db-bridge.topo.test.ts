import { describe, expect, it } from "vitest";

import { topoSortAddedSpacesForRestore } from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasGraph } from "@/src/components/foundation/architectural-types";

describe("topoSortAddedSpacesForRestore", () => {
  it("orders child after parent when both are new", () => {
    const spaces: CanvasGraph["spaces"] = {
      p: { id: "p", name: "P", parentSpaceId: null, entityIds: [] },
      c: { id: "c", name: "C", parentSpaceId: "p", entityIds: [] },
    };
    const added = new Set(["p", "c"]);
    const order = topoSortAddedSpacesForRestore(added, spaces);
    expect(order.indexOf("p")).toBeLessThan(order.indexOf("c"));
  });

  it("handles a small tree", () => {
    const spaces: CanvasGraph["spaces"] = {
      a: { id: "a", name: "A", parentSpaceId: null, entityIds: [] },
      b: { id: "b", name: "B", parentSpaceId: "a", entityIds: [] },
      d: { id: "d", name: "D", parentSpaceId: "b", entityIds: [] },
    };
    const added = new Set(["a", "b", "d"]);
    const order = topoSortAddedSpacesForRestore(added, spaces);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("d"));
  });
});
