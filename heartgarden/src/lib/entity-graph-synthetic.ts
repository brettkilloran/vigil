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
  const targetEdges = Math.max(0, Math.min(edgeCount, Math.floor(nodeCount * 1.9)));
  const clusterCount = Math.max(6, Math.min(64, Math.round(Math.sqrt(nodeCount) / 1.8)));
  const clusters: number[][] = Array.from({ length: clusterCount }, () => []);
  for (let i = 0; i < nodeCount; i += 1) {
    clusters[i % clusterCount]?.push(i);
  }

  const addEdge = (sourceIndex: number, targetIndex: number) => {
    if (edges.length >= targetEdges) return;
    if (sourceIndex === targetIndex) return;
    const a = Math.min(sourceIndex, targetIndex);
    const b = Math.max(sourceIndex, targetIndex);
    const keyPair = `${a}:${b}`;
    if (edgeKeys.has(keyPair)) return;
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
  };

  // Ensure each cluster is connected first.
  for (const members of clusters) {
    for (let i = 1; i < members.length; i += 1) {
      const prev = members[i - 1];
      const curr = members[i];
      if (prev === undefined || curr === undefined) continue;
      addEdge(prev, curr);
    }
  }

  // Sparse bridge ring between neighboring clusters.
  for (let i = 0; i < clusters.length; i += 1) {
    const current = clusters[i] ?? [];
    const next = clusters[(i + 1) % clusters.length] ?? [];
    if (current.length === 0 || next.length === 0) continue;
    const bridgeCount = Math.max(1, Math.round(Math.min(current.length, next.length) * 0.08));
    for (let j = 0; j < bridgeCount; j += 1) {
      const a = current[Math.floor(rng() * current.length)];
      const b = next[Math.floor(rng() * next.length)];
      if (a === undefined || b === undefined) continue;
      addEdge(a, b);
    }
  }

  // Fill remaining edges with mostly intra-cluster links and rare long-range links.
  const maxAttempts = Math.max(targetEdges * 18, 1000);
  let attempts = 0;
  while (edges.length < targetEdges && attempts < maxAttempts) {
    attempts += 1;
    const clusterIndex = Math.floor(rng() * clusters.length);
    const members = clusters[clusterIndex] ?? [];
    if (members.length < 2) continue;
    const localPick = rng() < 0.9;
    if (localPick) {
      const a = members[Math.floor(rng() * members.length)];
      const b = members[Math.floor(rng() * members.length)];
      if (a === undefined || b === undefined) continue;
      addEdge(a, b);
      continue;
    }
    const otherCluster = clusters[Math.floor(rng() * clusters.length)] ?? [];
    if (otherCluster.length === 0) continue;
    const a = members[Math.floor(rng() * members.length)];
    const b = otherCluster[Math.floor(rng() * otherCluster.length)];
    if (a === undefined || b === undefined) continue;
    addEdge(a, b);
  }

  return {
    key,
    label,
    summary: `Synthetic clustered graph with ${nodeCount.toLocaleString()} nodes and ${edges.length.toLocaleString()} edges.`,
    nodes,
    edges,
  };
}
