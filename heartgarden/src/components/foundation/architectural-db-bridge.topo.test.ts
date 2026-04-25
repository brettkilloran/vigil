import { describe, expect, it } from "vitest";

import { topoSortAddedSpacesForRestore } from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasGraph } from "@/src/components/foundation/architectural-types";

describe("topoSortAddedSpacesForRestore", () => {
  it("orders child after parent when both are new", () => {
    const spaces: CanvasGraph["spaces"] = {
      c: { entityIds: [], id: "c", name: "C", parentSpaceId: "p" },
      p: { entityIds: [], id: "p", name: "P", parentSpaceId: null },
    };
    const added = new Set(["p", "c"]);
    const order = topoSortAddedSpacesForRestore(added, spaces);
    expect(order.indexOf("p")).toBeLessThan(order.indexOf("c"));
  });

  it("handles a small tree", () => {
    const spaces: CanvasGraph["spaces"] = {
      a: { entityIds: [], id: "a", name: "A", parentSpaceId: null },
      b: { entityIds: [], id: "b", name: "B", parentSpaceId: "a" },
      d: { entityIds: [], id: "d", name: "D", parentSpaceId: "b" },
    };
    const added = new Set(["a", "b", "d"]);
    const order = topoSortAddedSpacesForRestore(added, spaces);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("d"));
  });
});
