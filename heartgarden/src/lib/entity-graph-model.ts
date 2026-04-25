import Graph from "graphology";

import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

type NodeAttrs = {
  title: string;
  itemType: string;
  entityType: string | null;
};

type EdgeAttrs = {
  edgeId: string;
  linkType: string | null;
};

export type EntityGraphModel = {
  graph: Graph<NodeAttrs, EdgeAttrs>;
  neighborIdsByNode: Map<string, Set<string>>;
  edgeIdsByNode: Map<string, Set<string>>;
  edgeById: Map<string, GraphEdge>;
  degreeByNode: Map<string, number>;
};

export function buildEntityGraphModel(nodes: GraphNode[], edges: GraphEdge[]): EntityGraphModel {
  const graph = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected", multi: true });
  const edgeById = new Map<string, GraphEdge>();

  for (const node of nodes) {
    if (!graph.hasNode(node.id)) {
      graph.addNode(node.id, {
        title: node.title,
        itemType: node.itemType,
        entityType: node.entityType ?? null,
      });
    }
  }

  for (const edge of edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
    graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
      edgeId: edge.id,
      linkType: edge.linkType ?? null,
    });
    edgeById.set(edge.id, edge);
  }

  const neighborIdsByNode = new Map<string, Set<string>>();
  const edgeIdsByNode = new Map<string, Set<string>>();
  const degreeByNode = new Map<string, number>();

  for (const node of nodes) {
    const neighbors = new Set(graph.neighbors(node.id));
    const edgeIds = new Set(graph.edges(node.id));
    neighborIdsByNode.set(node.id, neighbors);
    edgeIdsByNode.set(node.id, edgeIds);
    degreeByNode.set(node.id, graph.degree(node.id));
  }

  return {
    graph,
    neighborIdsByNode,
    edgeIdsByNode,
    edgeById,
    degreeByNode,
  };
}
