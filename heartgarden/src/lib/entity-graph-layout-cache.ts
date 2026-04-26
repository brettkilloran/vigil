import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";
import type { LayoutMap } from "@/src/components/dev/entity-graph-renderer-types";
import {
  GRAPH_LAYOUT_CACHE_LAYOUT_VERSION,
  graphLayoutPositionsFromMap,
  graphLayoutPositionsToMap,
  type GraphLayoutPositions,
} from "@/src/lib/graph-layout-cache-contract";

const ENTITY_GRAPH_LAYOUT_CACHE_STORAGE_KEY = "heartgarden:entity-graph-layout-cache:v1";

type EntityGraphLayoutCacheEntry = {
  graphRevision: string;
  layoutVersion: string;
  positions: GraphLayoutPositions;
  savedAt: number;
  nodeCount: number;
};

type EntityGraphLayoutCacheStore = {
  v: 1;
  entries: Record<string, EntityGraphLayoutCacheEntry>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fnv1aUpdate(hash: number, input: string): number {
  let h = hash >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function computeSyntheticGraphRevision(nodes: GraphNode[], edges: GraphEdge[]): string {
  let hash = 2166136261;
  for (const node of nodes) {
    hash = fnv1aUpdate(hash, node.id);
    hash = fnv1aUpdate(hash, node.itemType);
    hash = fnv1aUpdate(hash, node.entityType ?? "");
  }
  for (const edge of edges) {
    hash = fnv1aUpdate(hash, edge.source);
    hash = fnv1aUpdate(hash, edge.target);
    hash = fnv1aUpdate(hash, edge.linkType ?? "");
  }
  return `n${nodes.length}:e${edges.length}:h${hash.toString(36)}`;
}

function readStore(): EntityGraphLayoutCacheStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ENTITY_GRAPH_LAYOUT_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.v !== 1) return null;
    if (!isRecord(parsed.entries)) return null;
    return parsed as EntityGraphLayoutCacheStore;
  } catch {
    return null;
  }
}

function writeStore(store: EntityGraphLayoutCacheStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ENTITY_GRAPH_LAYOUT_CACHE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / private mode failures */
  }
}

export function readEntityGraphLayoutCache(
  cacheKey: string,
  graphRevision: string,
  layoutVersion = GRAPH_LAYOUT_CACHE_LAYOUT_VERSION,
): LayoutMap | null {
  const store = readStore();
  const entry = store?.entries[cacheKey];
  if (!entry) return null;
  if (entry.graphRevision !== graphRevision) return null;
  if (entry.layoutVersion !== layoutVersion) return null;
  const map = graphLayoutPositionsToMap(entry.positions);
  if (map.size === 0) return null;
  return map;
}

export function writeEntityGraphLayoutCache(
  cacheKey: string,
  graphRevision: string,
  layout: LayoutMap,
  layoutVersion = GRAPH_LAYOUT_CACHE_LAYOUT_VERSION,
): void {
  if (layout.size === 0) return;
  const store = readStore() ?? { v: 1 as const, entries: {} };
  store.entries[cacheKey] = {
    graphRevision,
    layoutVersion,
    positions: graphLayoutPositionsFromMap(layout),
    savedAt: Date.now(),
    nodeCount: layout.size,
  };
  writeStore(store);
}

export function clearEntityGraphLayoutCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ENTITY_GRAPH_LAYOUT_CACHE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
