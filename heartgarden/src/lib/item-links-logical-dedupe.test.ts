import { describe, expect, it } from "vitest";

import { dedupeLogicalItemLinkRows } from "@/src/lib/item-links-logical-dedupe";

describe("dedupeLogicalItemLinkRows", () => {
  it("prefers double-pinned row over null pins", () => {
    const rows = dedupeLogicalItemLinkRows([
      {
        color: null,
        id: "a",
        linkType: "pin",
        meta: null,
        source: "s",
        sourcePin: null,
        target: "t",
        targetPin: null,
        updatedAtMs: 0,
      },
      {
        color: null,
        id: "b",
        linkType: "pin",
        meta: null,
        source: "s",
        sourcePin: "x",
        target: "t",
        targetPin: "y",
        updatedAtMs: 0,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("b");
  });

  it("treats undirected pair as one logical edge", () => {
    const rows = dedupeLogicalItemLinkRows([
      {
        color: null,
        id: "a",
        linkType: "reference",
        meta: null,
        source: "s",
        sourcePin: null,
        target: "t",
        targetPin: null,
        updatedAtMs: 0,
      },
      {
        color: null,
        id: "b",
        linkType: "reference",
        meta: null,
        source: "t",
        sourcePin: "p",
        target: "s",
        targetPin: null,
        updatedAtMs: 0,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("b");
  });
});
