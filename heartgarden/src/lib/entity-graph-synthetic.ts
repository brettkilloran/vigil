import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

type SyntheticScenario = {
  key: string;
  label: string;
  summary: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ENTITY_TYPES = ["character", "faction", "location", "note"] as const;
const ITEM_TYPES = ["lore.character", "lore.faction", "lore.location", "note"] as const;
const LINK_TYPES = [
  "member_of",
  "operates_in",
  "trade_route",
  "mentioned_in",
  "referenced_by",
  "cross_ref",
  "rival_of",
] as const;

function nodeTypeAt(index: number): (typeof ENTITY_TYPES)[number] {
  return ENTITY_TYPES[index % ENTITY_TYPES.length]!;
}

function itemTypeFromEntity(entityType: string): string {
  if (entityType === "character") return ITEM_TYPES[0];
  if (entityType === "faction") return ITEM_TYPES[1];
  if (entityType === "location") return ITEM_TYPES[2];
  return ITEM_TYPES[3];
}

function chooseLinkType(rng: () => number): (typeof LINK_TYPES)[number] {
  const idx = Math.floor(rng() * LINK_TYPES.length);
  return LINK_TYPES[Math.max(0, Math.min(LINK_TYPES.length - 1, idx))]!;
}

export function buildSyntheticScenario(
  key: string,
  label: string,
  nodeCount: number,
  edgeCount: number,
  seed = 1,
): SyntheticScenario {
  const rng = mulberry32(seed);
  const nodes: GraphNode[] = [];
  for (let i = 0; i < nodeCount; i += 1) {
    const entityType = nodeTypeAt(i);
    nodes.push({
      id: `${key}-n-${i}`,
      title: `${entityType}-${i.toString().padStart(5, "0")}`,
      entityType,
      itemType: itemTypeFromEntity(entityType),
    });
  }

  const edgeKeys = new Set<string>();
  const edges: GraphEdge[] = [];
  const targetEdges = Math.max(0, edgeCount);
  while (edges.length < targetEdges) {
    const sourceIndex = Math.floor(rng() * nodeCount);
    const targetIndex = Math.floor(rng() * nodeCount);
    if (sourceIndex === targetIndex) continue;
    const a = Math.min(sourceIndex, targetIndex);
    const b = Math.max(sourceIndex, targetIndex);
    const keyPair = `${a}:${b}`;
    if (edgeKeys.has(keyPair)) continue;
    edgeKeys.add(keyPair);
    edges.push({
      id: `${key}-e-${edges.length}`,
      source: nodes[sourceIndex]!.id,
      target: nodes[targetIndex]!.id,
      color: null,
      sourcePin: null,
      targetPin: null,
      linkType: chooseLinkType(rng),
    });
  }

  return {
    key,
    label,
    summary: `Synthetic stress graph with ${nodeCount.toLocaleString()} nodes and ${edgeCount.toLocaleString()} edges.`,
    nodes,
    edges,
  };
}
