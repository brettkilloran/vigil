import type { CanvasItem } from "@/src/stores/canvas-types";

export type SpatialDir = "left" | "right" | "up" | "down";

function centerOf(it: CanvasItem): { x: number; y: number } {
  return { x: it.x + it.width / 2, y: it.y + it.height / 2 };
}

function dirVector(dir: SpatialDir): { x: number; y: number } {
  switch (dir) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
  }
}

/** Geometric center of the union bbox of `items` (empty → null). */
export function selectionAnchor(
  items: CanvasItem[],
): { x: number; y: number } | null {
  if (items.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.x);
    minY = Math.min(minY, it.y);
    maxX = Math.max(maxX, it.x + it.width);
    maxY = Math.max(maxY, it.y + it.height);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/**
 * Nearest item in `dir` from `from` (half-plane ahead along axis), excluding ids.
 * Prefers alignment with the axis, then shorter distance.
 */
export function findNeighborInDirection(
  from: { x: number; y: number },
  dir: SpatialDir,
  candidates: CanvasItem[],
  excludeIds: ReadonlySet<string>,
): CanvasItem | null {
  const v = dirVector(dir);
  let best: CanvasItem | null = null;
  let bestScore = Infinity;

  for (const o of candidates) {
    if (excludeIds.has(o.id)) continue;
    const c = centerOf(o);
    const dx = c.x - from.x;
    const dy = c.y - from.y;
    const dot = dx * v.x + dy * v.y;
    if (dot <= 1e-4) continue;
    const cross = Math.abs(dx * v.y - dy * v.x);
    const dist = Math.hypot(dx, dy);
    const score = cross * 50 + dist;
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}
