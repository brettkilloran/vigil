import { describe, expect, it } from "vitest";

import { collectDescendantSpaceIds } from "@/src/lib/heartgarden-space-subtree";

describe("collectDescendantSpaceIds", () => {
  it("includes root and nested children", () => {
    const rows = [
      { id: "a", parentSpaceId: null as string | null },
      { id: "b", parentSpaceId: "a" },
      { id: "c", parentSpaceId: "b" },
      { id: "x", parentSpaceId: null as string | null },
    ];
    const s = collectDescendantSpaceIds("a", rows);
    expect([...s].sort()).toEqual(["a", "b", "c"]);
  });

  it("handles single space", () => {
    const rows = [{ id: "only", parentSpaceId: null as string | null }];
    expect(collectDescendantSpaceIds("only", rows)).toEqual(new Set(["only"]));
  });
});
