import { describe, expect, it } from "vitest";

import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";
import { computeSyntheticGraphRevision } from "@/src/lib/entity-graph-layout-cache";

describe("computeSyntheticGraphRevision", () => {
  it("is stable for identical graph input", () => {
    const nodes: GraphNode[] = [
      { id: "a", title: "A", itemType: "note", entityType: null },
      { id: "b", title: "B", itemType: "note", entityType: "character" },
    ];
    const edges: GraphEdge[] = [
      {
        id: "e1",
        source: "a",
        target: "b",
        color: null,
        sourcePin: null,
        targetPin: null,
        linkType: "mentions",
      },
    ];
    expect(computeSyntheticGraphRevision(nodes, edges)).toEqual(
      computeSyntheticGraphRevision(nodes, edges),
    );
  });

  it("changes when topology changes", () => {
    const nodes: GraphNode[] = [
      { id: "a", title: "A", itemType: "note", entityType: null },
      { id: "b", title: "B", itemType: "note", entityType: null },
    ];
    const edgeA: GraphEdge[] = [
      {
        id: "e1",
        source: "a",
        target: "b",
        color: null,
        sourcePin: null,
        targetPin: null,
        linkType: "mentions",
      },
    ];
    const edgeB: GraphEdge[] = [
      {
        id: "e1",
        source: "b",
        target: "a",
        color: null,
        sourcePin: null,
        targetPin: null,
        linkType: "mentions",
      },
    ];
    expect(computeSyntheticGraphRevision(nodes, edgeA)).not.toEqual(
      computeSyntheticGraphRevision(nodes, edgeB),
    );
  });
});
