import type {
  CanvasEntity,
  CanvasGraph,
} from "@/src/components/foundation/architectural-types";

/** Match node layout constants in ArchitecturalCanvasApp.tsx */
export const CANVAS_BOUNDS_UNIFIED_NODE_WIDTH = 340;
export const CANVAS_BOUNDS_CONTENT_HEIGHT = 280;
export const CANVAS_BOUNDS_FOLDER_WIDTH = 420;
export const CANVAS_BOUNDS_FOLDER_HEIGHT = 280;

/** CSS stack fan-out step (see --stack-x / --stack-y in ArchitecturalCanvasApp). */
const STACK_SPREAD_PX = 6;
const MAX_STACK_SPREAD_EXTRA = 240;

export type WorldBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type CollapsedStackInfo = {
  stackId: string;
  entities: CanvasEntity[];
  top: CanvasEntity;
};

/** Same grouping as `collapsedStacks` in ArchitecturalCanvasApp (multi-card stacks only). */
export function buildCollapsedStacksList(
  graph: CanvasGraph,
  activeSpaceId: string,
): CollapsedStackInfo[] {
  const entityIds = graph.spaces[activeSpaceId]?.entityIds ?? [];
  const groups = new Map<string, CanvasEntity[]>();
  for (const id of entityIds) {
    const e = graph.entities[id];
    if (!e?.stackId) continue;
    const arr = groups.get(e.stackId) ?? [];
    arr.push(e);
    groups.set(e.stackId, arr);
  }
  const out: CollapsedStackInfo[] = [];
  groups.forEach((entities, stackId) => {
    if (entities.length < 2) return;
    const sorted = [...entities].sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0));
    out.push({ stackId, entities: sorted, top: sorted[sorted.length - 1]! });
  });
  return out;
}

function unionBounds(a: WorldBounds, b: WorldBounds): WorldBounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** Axis-aligned bounds for a rectangle with top-left (x,y), size w×h, rotated by rotationDeg about center. */
export function rotatedRectWorldBounds(
  x: number,
  y: number,
  w: number,
  h: number,
  rotationDeg: number,
): WorldBounds {
  const rad = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const corners = [
    { dx: -w / 2, dy: -h / 2 },
    { dx: w / 2, dy: -h / 2 },
    { dx: w / 2, dy: h / 2 },
    { dx: -w / 2, dy: h / 2 },
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { dx, dy } of corners) {
    const rx = dx * c - dy * s;
    const ry = dx * s + dy * c;
    const wx = cx + rx;
    const wy = cy + ry;
    minX = Math.min(minX, wx);
    minY = Math.min(minY, wy);
    maxX = Math.max(maxX, wx);
    maxY = Math.max(maxY, wy);
  }
  return { minX, minY, maxX, maxY };
}

function entityLocalSize(entity: CanvasEntity): { w: number; h: number } {
  if (entity.kind === "folder") {
    return { w: entity.width ?? CANVAS_BOUNDS_FOLDER_WIDTH, h: CANVAS_BOUNDS_FOLDER_HEIGHT };
  }
  return {
    w: entity.width ?? CANVAS_BOUNDS_UNIFIED_NODE_WIDTH,
    h: CANVAS_BOUNDS_CONTENT_HEIGHT,
  };
}

function boundsForEntityAtSlot(entity: CanvasEntity, spaceId: string): WorldBounds | null {
  const slot = entity.slots[spaceId];
  if (!slot) return null;
  const { w, h } = entityLocalSize(entity);
  return rotatedRectWorldBounds(slot.x, slot.y, w, h, entity.rotation ?? 0);
}

function boundsForCollapsedStack(entry: CollapsedStackInfo, spaceId: string): WorldBounds | null {
  const { top, entities } = entry;
  const slot = top.slots[spaceId];
  if (!slot) return null;
  const n = entities.length;
  const extra = Math.min((n - 1) * STACK_SPREAD_PX, MAX_STACK_SPREAD_EXTRA);
  const { w: bw, h: bh } = entityLocalSize(top);
  const w = bw + extra;
  const h = bh + extra;
  return rotatedRectWorldBounds(slot.x, slot.y, w, h, top.rotation ?? 0);
}

/**
 * Bounding box of all drawable atoms in a space (standalone nodes + one box per collapsed stack).
 */
export function computeSpaceContentBounds(
  graph: CanvasGraph,
  activeSpaceId: string,
  collapsedStacks: readonly CollapsedStackInfo[],
): WorldBounds | null {
  const entityIds = graph.spaces[activeSpaceId]?.entityIds ?? [];
  if (entityIds.length === 0) return null;

  const stackMulti = new Set(collapsedStacks.map((c) => c.stackId));

  let acc: WorldBounds | null = null;

  for (const id of entityIds) {
    const entity = graph.entities[id];
    if (!entity) continue;
    if (entity.stackId && stackMulti.has(entity.stackId)) continue;
    const b = boundsForEntityAtSlot(entity, activeSpaceId);
    if (!b) continue;
    acc = acc ? unionBounds(acc, b) : b;
  }

  for (const cs of collapsedStacks) {
    const b = boundsForCollapsedStack(cs, activeSpaceId);
    if (!b) continue;
    acc = acc ? unionBounds(acc, b) : b;
  }

  return acc;
}

/**
 * Union bounds for a subset of entity ids (e.g. selection). Expands to full multi-card stacks when any member is selected.
 */
export function computeBoundsForEntitySubset(
  graph: CanvasGraph,
  activeSpaceId: string,
  collapsedStacks: readonly CollapsedStackInfo[],
  selectedIds: readonly string[],
): WorldBounds | null {
  if (selectedIds.length === 0) return null;

  const stackById = new Map<string, CollapsedStackInfo>();
  for (const cs of collapsedStacks) {
    stackById.set(cs.stackId, cs);
  }

  const expanded = new Set<string>();
  for (const id of selectedIds) {
    const e = graph.entities[id];
    if (!e) continue;
    if (!graph.spaces[activeSpaceId]?.entityIds.includes(id)) continue;
    if (e.stackId) {
      const cs = stackById.get(e.stackId);
      if (cs && cs.entities.length > 1) {
        cs.entities.forEach((m) => expanded.add(m.id));
        continue;
      }
    }
    expanded.add(id);
  }

  let acc: WorldBounds | null = null;
  const handledStacks = new Set<string>();

  for (const id of expanded) {
    const entity = graph.entities[id];
    if (!entity) continue;
    if (entity.stackId) {
      const cs = stackById.get(entity.stackId);
      if (cs && cs.entities.length > 1) {
        if (handledStacks.has(cs.stackId)) continue;
        handledStacks.add(cs.stackId);
        const b = boundsForCollapsedStack(cs, activeSpaceId);
        if (b) acc = acc ? unionBounds(acc, b) : b;
        continue;
      }
    }
    const b = boundsForEntityAtSlot(entity, activeSpaceId);
    if (b) acc = acc ? unionBounds(acc, b) : b;
  }

  return acc;
}

export type FitCameraParams = {
  bounds: WorldBounds;
  viewportWidth: number;
  viewportHeight: number;
  paddingPx: number;
  minZoom: number;
  maxZoom: number;
};

export function fitCameraToActiveSpaceContent(
  graph: CanvasGraph,
  activeSpaceId: string,
  viewportWidth: number,
  viewportHeight: number,
  minZoom: number,
  maxZoom: number,
  paddingPx = 120,
): { scale: number; translateX: number; translateY: number } | null {
  const stacks = buildCollapsedStacksList(graph, activeSpaceId);
  const bounds = computeSpaceContentBounds(graph, activeSpaceId, stacks);
  if (!bounds) return null;
  return fitCameraToBounds({
    bounds,
    viewportWidth,
    viewportHeight,
    paddingPx,
    minZoom,
    maxZoom,
  });
}

export function fitCameraToSelection(
  graph: CanvasGraph,
  activeSpaceId: string,
  selectedIds: readonly string[],
  viewportWidth: number,
  viewportHeight: number,
  minZoom: number,
  maxZoom: number,
  paddingPx = 120,
): { scale: number; translateX: number; translateY: number } | null {
  const stacks = buildCollapsedStacksList(graph, activeSpaceId);
  const bounds = computeBoundsForEntitySubset(graph, activeSpaceId, stacks, selectedIds);
  if (!bounds) return null;
  return fitCameraToBounds({
    bounds,
    viewportWidth,
    viewportHeight,
    paddingPx,
    minZoom,
    maxZoom,
  });
}

export function fitCameraToBounds(p: FitCameraParams): {
  scale: number;
  translateX: number;
  translateY: number;
} {
  const { bounds, viewportWidth: width, viewportHeight: height, paddingPx: pad, minZoom, maxZoom } = p;
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const nextScale = Math.max(
    minZoom,
    Math.min(maxZoom, Math.min((width - pad) / spanX, (height - pad) / spanY)),
  );
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    scale: nextScale,
    translateX: width / 2 - centerX * nextScale,
    translateY: height / 2 - centerY * nextScale,
  };
}

/** Visible world rectangle (top-left + size) for current camera. */
export function viewportWorldRect(
  translateX: number,
  translateY: number,
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
): WorldBounds {
  return {
    minX: -translateX / scale,
    minY: -translateY / scale,
    maxX: -translateX / scale + viewportWidth / scale,
    maxY: -translateY / scale + viewportHeight / scale,
  };
}

function intersectionArea(a: WorldBounds, b: WorldBounds): number {
  const ix = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const iy = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  return ix * iy;
}

function contentPlaneArea(bounds: WorldBounds): number {
  return Math.max(1, (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY));
}

/**
 * True when viewport shows almost none of the content (Figma-style snap hint).
 */
export function isContentMostlyOffScreen(
  content: WorldBounds,
  viewport: WorldBounds,
  opts?: { minVisibleRatio?: number },
): boolean {
  const minRatio = opts?.minVisibleRatio ?? 0.02;
  const inter = intersectionArea(content, viewport);
  const ratio = inter / contentPlaneArea(content);
  return ratio < minRatio;
}

export type MinimapAtomRect = {
  key: string;
  bounds: WorldBounds;
  selected: boolean;
};

/**
 * One rect per standalone node or collapsed stack for minimap drawing.
 */
export function listMinimapAtomRects(
  graph: CanvasGraph,
  activeSpaceId: string,
  collapsedStacks: readonly CollapsedStackInfo[],
  selectedNodeIds: ReadonlySet<string>,
): MinimapAtomRect[] {
  const entityIds = graph.spaces[activeSpaceId]?.entityIds ?? [];
  const stackMulti = new Set(collapsedStacks.map((c) => c.stackId));
  const out: MinimapAtomRect[] = [];

  for (const id of entityIds) {
    const entity = graph.entities[id];
    if (!entity) continue;
    if (entity.stackId && stackMulti.has(entity.stackId)) continue;
    const b = boundsForEntityAtSlot(entity, activeSpaceId);
    if (!b) continue;
    out.push({
      key: `e:${id}`,
      bounds: b,
      selected: selectedNodeIds.has(id),
    });
  }

  for (const cs of collapsedStacks) {
    const b = boundsForCollapsedStack(cs, activeSpaceId);
    if (!b) continue;
    const selected = cs.entities.some((e) => selectedNodeIds.has(e.id));
    out.push({
      key: `s:${cs.stackId}`,
      bounds: b,
      selected,
    });
  }

  return out;
}
