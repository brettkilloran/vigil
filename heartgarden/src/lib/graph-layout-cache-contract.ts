export const GRAPH_LAYOUT_CACHE_LAYOUT_VERSION = "force3d-v1";
export const GRAPH_LAYOUT_CACHE_MAX_NODES = 20_000;
export const GRAPH_LAYOUT_CACHE_MAX_BYTES = 2_500_000;

export type GraphLayoutPoint = {
  x: number;
  y: number;
  z?: number;
};

export type GraphLayoutPositions = Record<string, GraphLayoutPoint>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeGraphLayoutPositions(
  raw: unknown,
  maxNodes = GRAPH_LAYOUT_CACHE_MAX_NODES,
): GraphLayoutPositions | null {
  if (!isRecord(raw)) return null;
  const out: GraphLayoutPositions = {};
  let count = 0;
  for (const [id, point] of Object.entries(raw)) {
    if (!id) continue;
    if (!isRecord(point)) continue;
    const x = point.x;
    const y = point.y;
    if (typeof x !== "number" || !Number.isFinite(x)) continue;
    if (typeof y !== "number" || !Number.isFinite(y)) continue;
    const z = point.z;
    out[id] =
      typeof z === "number" && Number.isFinite(z)
        ? { x, y, z }
        : { x, y };
    count += 1;
    if (count >= maxNodes) break;
  }
  return out;
}

export function graphLayoutPositionsByteSize(positions: GraphLayoutPositions): number {
  return new TextEncoder().encode(JSON.stringify(positions)).length;
}

export function graphLayoutPositionsFromMap(
  positions: Map<string, { x: number; y: number; z?: number }>,
): GraphLayoutPositions {
  const out: GraphLayoutPositions = {};
  for (const [id, point] of positions.entries()) {
    if (!id) continue;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    out[id] =
      typeof point.z === "number" && Number.isFinite(point.z)
        ? { x: point.x, y: point.y, z: point.z }
        : { x: point.x, y: point.y };
  }
  return out;
}

export function graphLayoutPositionsToMap(
  positions: GraphLayoutPositions | null | undefined,
): Map<string, { x: number; y: number; z?: number }> {
  const out = new Map<string, { x: number; y: number; z?: number }>();
  if (!positions) return out;
  for (const [id, point] of Object.entries(positions)) {
    if (!id) continue;
    out.set(id, point);
  }
  return out;
}
