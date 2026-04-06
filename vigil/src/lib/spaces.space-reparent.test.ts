import { describe, expect, it } from "vitest";

import { spaceReparentWouldCreateCycle } from "@/src/lib/spaces";

describe("spaceReparentWouldCreateCycle", () => {
  const rows = [
    { id: "a", parentSpaceId: null as string | null },
    { id: "b", parentSpaceId: "a" },
    { id: "c", parentSpaceId: "b" },
    { id: "d", parentSpaceId: "c" },
  ];

  it("returns false when new parent is null", () => {
    expect(spaceReparentWouldCreateCycle("b", null, rows)).toBe(false);
  });

  it("returns true when new parent is the space itself", () => {
    expect(spaceReparentWouldCreateCycle("b", "b", rows)).toBe(true);
  });

  it("returns false when new parent is an ancestor but not in moved subtree", () => {
    expect(spaceReparentWouldCreateCycle("c", "a", rows)).toBe(false);
  });

  it("returns true when new parent lies in the subtree of the space being reparented", () => {
    expect(spaceReparentWouldCreateCycle("b", "c", rows)).toBe(true);
    expect(spaceReparentWouldCreateCycle("a", "d", rows)).toBe(true);
  });

  it("returns true on corrupt graphs that loop before reaching root", () => {
    const loop = [
      { id: "x", parentSpaceId: "y" as string | null },
      { id: "y", parentSpaceId: "x" },
    ];
    expect(spaceReparentWouldCreateCycle("x", "y", loop)).toBe(true);
  });
});
