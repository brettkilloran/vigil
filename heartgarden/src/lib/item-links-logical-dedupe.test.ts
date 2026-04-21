import { describe, expect, it } from "vitest";

import { dedupeLogicalItemLinkRows } from "@/src/lib/item-links-logical-dedupe";

describe("dedupeLogicalItemLinkRows", () => {
  it("prefers double-pinned row over null pins", () => {
    const rows = dedupeLogicalItemLinkRows([
      {
        id: "a",
        source: "s",
        target: "t",
        linkType: "pin",
        sourcePin: null,
        targetPin: null,
        color: null,
        meta: null,
        updatedAtMs: 0,
      },
      {
        id: "b",
        source: "s",
        target: "t",
        linkType: "pin",
        sourcePin: "x",
        targetPin: "y",
        color: null,
        meta: null,
        updatedAtMs: 0,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("b");
  });

  it("treats undirected pair as one logical edge", () => {
    const rows = dedupeLogicalItemLinkRows([
      {
        id: "a",
        source: "s",
        target: "t",
        linkType: "reference",
        sourcePin: null,
        targetPin: null,
        color: null,
        meta: null,
        updatedAtMs: 0,
      },
      {
        id: "b",
        source: "t",
        target: "s",
        linkType: "reference",
        sourcePin: "p",
        targetPin: null,
        color: null,
        meta: null,
        updatedAtMs: 0,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("b");
  });
});
