import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

type SyntheticScenario = {
  key: string;
  label: string;
  summary: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type Point2 = {
  x: number;
  y: number;
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

function distanceSq(a: Point2, b: Point2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function shuffleInPlace<T>(items: T[], rng: () => number): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = items[i];
    items[i] = items[j]!;
    items[j] = a!;
  }
}

function buildClusterCenters(clusterCount: number, rng: () => number): Point2[] {
  const centers: Point2[] = [];
  const radius = 520 + Math.sqrt(clusterCount) * 120;
  const minSeparation = Math.max(120, radius / Math.sqrt(clusterCount) * 0.8);
  const minSeparationSq = minSeparation * minSeparation;
  const maxAttempts = clusterCount * 40;

  let attempts = 0;
  while (centers.length < clusterCount && attempts < maxAttempts) {
    attempts += 1;
    const theta = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    const candidate = { x: Math.cos(theta) * r, y: Math.sin(theta) * r };
    let ok = true;
    for (const existing of centers) {
      if (distanceSq(existing, candidate) < minSeparationSq) {
        ok = false;
        break;
      }
    }
    if (ok) centers.push(candidate);
  }

  while (centers.length < clusterCount) {
    const theta = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    centers.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r });
  }
  return centers;
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
  // Keep sparse graphs as the default for realism: sentiment relationships are mostly local.
  const targetEdges = Math.max(0, Math.min(edgeCount, Math.floor(nodeCount * 1.35)));
  const clusterCount = Math.max(6, Math.min(64, Math.round(Math.sqrt(nodeCount) / 1.8)));
  const clusters: number[][] = Array.from({ length: clusterCount }, () => []);
  const nodeOrder = Array.from({ length: nodeCount }, (_, i) => i);
  shuffleInPlace(nodeOrder, rng);
  for (let i = 0; i < nodeOrder.length; i += 1) {
    const idx = nodeOrder[i];
    if (idx === undefined) continue;
    clusters[i % clusterCount]?.push(idx);
  }
  const clusterPos = buildClusterCenters(clusterCount, rng);
  const nodePos: Point2[] = Array.from({ length: nodeCount }, () => ({ x: 0, y: 0 }));
  for (let c = 0; c < clusters.length; c += 1) {
    const members = clusters[c] ?? [];
    const center = clusterPos[c] ?? { x: 0, y: 0 };
    const spread = 42 + Math.sqrt(Math.max(1, members.length)) * 5;
    for (const idx of members) {
      const theta = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * spread;
      nodePos[idx] = {
        x: center.x + Math.cos(theta) * r,
        y: center.y + Math.sin(theta) * r,
      };
    }
  }
  const clusterOfNode = new Int32Array(nodeCount);
  for (let c = 0; c < clusters.length; c += 1) {
    for (const idx of clusters[c] ?? []) clusterOfNode[idx] = c;
  }
  const maxInterClusterEdges = Math.max(2, Math.floor(targetEdges * 0.12));
  let interClusterEdges = 0;

  const addEdge = (
    sourceIndex: number,
    targetIndex: number,
    options: { allowExtraInterCluster?: boolean } = {},
  ): boolean => {
    if (edges.length >= targetEdges) return false;
    if (sourceIndex === targetIndex) return false;
    const interCluster = clusterOfNode[sourceIndex] !== clusterOfNode[targetIndex];
    if (interCluster && interClusterEdges >= maxInterClusterEdges && !options.allowExtraInterCluster) {
      return false;
    }
    const a = Math.min(sourceIndex, targetIndex);
    const b = Math.max(sourceIndex, targetIndex);
    const keyPair = `${a}:${b}`;
    if (edgeKeys.has(keyPair)) return false;
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
    if (interCluster) interClusterEdges += 1;
    return true;
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

  // Local-neighborhood links inside each cluster.
  for (const members of clusters) {
    if (members.length < 3) continue;
    for (const source of members) {
      const sourcePos = nodePos[source];
      if (!sourcePos) continue;
      let nearestA = -1;
      let nearestB = -1;
      let nearestDistA = Infinity;
      let nearestDistB = Infinity;
      for (const target of members) {
        if (target === source) continue;
        const targetPos = nodePos[target];
        if (!targetPos) continue;
        const d2 = distanceSq(sourcePos, targetPos);
        if (d2 < nearestDistA) {
          nearestB = nearestA;
          nearestDistB = nearestDistA;
          nearestA = target;
          nearestDistA = d2;
        } else if (d2 < nearestDistB) {
          nearestB = target;
          nearestDistB = d2;
        }
      }
      if (nearestA >= 0) addEdge(source, nearestA);
      if (nearestB >= 0 && rng() < 0.55) addEdge(source, nearestB);
    }
  }

  // Sparse bridges to nearest neighboring clusters (short-range stitching only).
  const nearestClusterByIndex = new Int32Array(clusterCount);
  for (let c = 0; c < clusterCount; c += 1) {
    const here = clusterPos[c] ?? { x: 0, y: 0 };
    let best = -1;
    let bestD2 = Infinity;
    for (let other = 0; other < clusterCount; other += 1) {
      if (other === c) continue;
      const there = clusterPos[other] ?? { x: 0, y: 0 };
      const d2 = distanceSq(here, there);
      if (d2 < bestD2) {
        best = other;
        bestD2 = d2;
      }
    }
    nearestClusterByIndex[c] = best;
  }

  for (let i = 0; i < clusters.length; i += 1) {
    const current = clusters[i] ?? [];
    const next = clusters[nearestClusterByIndex[i] ?? -1] ?? [];
    if (current.length === 0 || next.length === 0) continue;
    const bridgeCount = Math.max(1, Math.min(2, Math.round(Math.min(current.length, next.length) * 0.01)));
    for (let j = 0; j < bridgeCount; j += 1) {
      const a = current[Math.floor(rng() * current.length)];
      const b = next[Math.floor(rng() * next.length)];
      if (a === undefined || b === undefined) continue;
      addEdge(a, b);
    }
  }

  // Fill remaining edges with distance-decay probabilities.
  // Most links should be local; farther links exist but are rare.
  const maxAttempts = Math.max(targetEdges * 24, 1200);
  let attempts = 0;
  while (edges.length < targetEdges && attempts < maxAttempts) {
    attempts += 1;
    const a = Math.floor(rng() * nodeCount);
    let b = Math.floor(rng() * nodeCount);
    if (a === b) {
      b = (b + 1) % Math.max(1, nodeCount);
    }
    const aPos = nodePos[a];
    const bPos = nodePos[b];
    if (!aPos || !bPos) continue;
    const sameCluster = clusterOfNode[a] === clusterOfNode[b];
    const d = Math.sqrt(distanceSq(aPos, bPos));
    const localFalloff = Math.exp(-Math.pow(d / 230, 1.8));
    const bridgePenalty = sameCluster ? 1 : 0.12;
    const rareLongRange = rng() < 0.003 ? 0.08 : 0;
    const p = Math.min(0.98, localFalloff * bridgePenalty + rareLongRange);
    if (rng() < p) addEdge(a, b);
  }

  const averageDegree = nodeCount > 0 ? (edges.length * 2) / nodeCount : 0;
  const interRatio = edges.length > 0 ? interClusterEdges / edges.length : 0;
  return {
    key,
    label,
    summary: `Synthetic locality-weighted graph with ${nodeCount.toLocaleString()} nodes · ${edges.length.toLocaleString()} edges · avg degree ${averageDegree.toFixed(2)} · cross-cluster ${(interRatio * 100).toFixed(1)}%.`,
    nodes,
    edges,
  };
}
