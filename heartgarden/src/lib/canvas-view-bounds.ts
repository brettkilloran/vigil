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
/** Matches `--stack-r` step in `.stackLayer` (index − (n−1)/2) × this value. */
const STACK_FAN_ROT_STEP_DEG = 1.6;

export interface WorldBounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

export interface CollapsedStackInfo {
  entities: CanvasEntity[];
  stackId: string;
  top: CanvasEntity;
}

/** Same grouping as `collapsedStacks` in ArchitecturalCanvasApp (multi-card stacks only). */
export function buildCollapsedStacksList(
  graph: CanvasGraph,
  activeSpaceId: string
): CollapsedStackInfo[] {
  const entityIds = graph.spaces[activeSpaceId]?.entityIds ?? [];
  const groups = new Map<string, CanvasEntity[]>();
  for (const id of entityIds) {
    const e = graph.entities[id];
    if (!e?.stackId) {
      continue;
    }
    const arr = groups.get(e.stackId) ?? [];
    arr.push(e);
    groups.set(e.stackId, arr);
  }
  const out: CollapsedStackInfo[] = [];
  groups.forEach((entities, stackId) => {
    if (entities.length < 2) {
      return;
    }
    const sorted = [...entities].sort(
      (a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0)
    );
    out.push({ entities: sorted, stackId, top: sorted.at(-1)! });
  });
  return out;
}

/**
 * Fingerprint of every graph field that affects minimap world geometry for `activeSpaceId`
 * (slots, stack membership/order, rotations, declared sizes, content length for DOM-driven height).
 *
 * Use to gate expensive minimap work when the `CanvasGraph` object reference churns on each
 * collab patch but layout-relevant data is unchanged. Also ensures ResizeObserver wiring re-runs
 * after unstack / restack / remote moves that don’t change unrelated entities.
 */
export function minimapLayoutSignature(
  graph: CanvasGraph,
  activeSpaceId: string
): string {
  const entityIds = [...(graph.spaces[activeSpaceId]?.entityIds ?? [])].sort();
  const entityParts: string[] = [];

  for (const id of entityIds) {
    const e = graph.entities[id];
    if (!e) {
      entityParts.push(`?${id}`);
      continue;
    }
    const slot = e.slots[activeSpaceId];
    const slotStr = slot ? `${slot.x},${slot.y}` : "∅";
    const stack = `${e.stackId ?? "·"}:${e.stackOrder ?? "·"}`;
    const rot = e.rotation ?? 0;

    if (e.kind === "folder") {
      const w = e.width ?? "";
      const h = e.height ?? "";
      entityParts.push(`F:${id}:${slotStr}:${rot}:${w}×${h}:${stack}`);
    } else {
      const w = e.width ?? "";
      const h = e.height ?? "";
      const bodyLen = e.bodyHtml?.length ?? 0;
      entityParts.push(
        `C:${id}:${slotStr}:${rot}:${w}×${h}:${stack}:${bodyLen}`
      );
    }
  }

  const collapsed = buildCollapsedStacksList(graph, activeSpaceId);
  const stackTopo = collapsed
    .map((cs) => {
      const members = cs.entities
        .map((ent) => `${ent.id}@${ent.stackOrder ?? 0}`)
        .join(",");
      return `${cs.stackId}:${cs.top.id}:${members}`;
    })
    .sort()
    .join("|");

  return `${entityParts.join("|")}###${stackTopo}`;
}

function unionBounds(a: WorldBounds, b: WorldBounds): WorldBounds {
  return {
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
  };
}

/** Axis-aligned bounds for a rectangle with top-left (x,y), size w×h, rotated by rotationDeg about center. */
export function rotatedRectWorldBounds(
  x: number,
  y: number,
  w: number,
  h: number,
  rotationDeg: number
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
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
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
  return { maxX, maxY, minX, minY };
}

function entityLocalSize(entity: CanvasEntity): { w: number; h: number } {
  if (entity.kind === "folder") {
    return {
      h: entity.height ?? CANVAS_BOUNDS_FOLDER_HEIGHT,
      w: entity.width ?? CANVAS_BOUNDS_FOLDER_WIDTH,
    };
  }
  return {
    h: entity.height ?? CANVAS_BOUNDS_CONTENT_HEIGHT,
    w: entity.width ?? CANVAS_BOUNDS_UNIFIED_NODE_WIDTH,
  };
}

/** Live DOM size for a node (px in canvas layout space ≈ world units). */
export interface MinimapPlacementSize {
  height: number;
  width: number;
}

/** Avoid minimap subtree re-renders when DOM remeasure yields identical dimensions. */
export function minimapPlacementMapsEqual(
  a: ReadonlyMap<string, MinimapPlacementSize>,
  b: ReadonlyMap<string, MinimapPlacementSize>
): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const [k, v] of a) {
    const u = b.get(k);
    if (!u || u.width !== v.width || u.height !== v.height) {
      return false;
    }
  }
  return true;
}

function entitySizeForMinimap(
  entity: CanvasEntity,
  measured?: MinimapPlacementSize | null
): { w: number; h: number } {
  if (
    measured &&
    Number.isFinite(measured.width) &&
    Number.isFinite(measured.height) &&
    measured.width >= 8 &&
    measured.height >= 8
  ) {
    return { h: measured.height, w: measured.width };
  }
  return entityLocalSize(entity);
}

function boundsForEntityAtSlot(
  entity: CanvasEntity,
  spaceId: string,
  measured?: MinimapPlacementSize | null
): WorldBounds | null {
  const slot = entity.slots[spaceId];
  if (!slot) {
    return null;
  }
  const { w, h } = entitySizeForMinimap(entity, measured);
  return rotatedRectWorldBounds(slot.x, slot.y, w, h, entity.rotation ?? 0);
}

function boundsForCollapsedStack(
  entry: CollapsedStackInfo,
  spaceId: string,
  measuredTop?: MinimapPlacementSize | null
): WorldBounds | null {
  const { top, entities } = entry;
  const slot = top.slots[spaceId];
  if (!slot) {
    return null;
  }
  const n = entities.length;
  const extra = Math.min((n - 1) * STACK_SPREAD_PX, MAX_STACK_SPREAD_EXTRA);
  const { w: bw, h: bh } = entitySizeForMinimap(top, measuredTop);
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
  placementSizes?: ReadonlyMap<string, MinimapPlacementSize> | null
): WorldBounds | null {
  const entityIds = graph.spaces[activeSpaceId]?.entityIds ?? [];
  if (entityIds.length === 0) {
    return null;
  }

  const stackMulti = new Set(collapsedStacks.map((c) => c.stackId));

  let acc: WorldBounds | null = null;

  for (const id of entityIds) {
    const entity = graph.entities[id];
    if (!entity) {
      continue;
    }
    if (entity.stackId && stackMulti.has(entity.stackId)) {
      continue;
    }
    const measured = placementSizes?.get(id) ?? null;
    const b = boundsForEntityAtSlot(entity, activeSpaceId, measured);
    if (!b) {
      continue;
    }
    acc = acc ? unionBounds(acc, b) : b;
  }

  for (const cs of collapsedStacks) {
    const measuredTop = placementSizes?.get(cs.top.id) ?? null;
    const b = boundsForCollapsedStack(cs, activeSpaceId, measuredTop);
    if (!b) {
      continue;
    }
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
  selectedIds: readonly string[]
): WorldBounds | null {
  if (selectedIds.length === 0) {
    return null;
  }

  const stackById = new Map<string, CollapsedStackInfo>();
  for (const cs of collapsedStacks) {
    stackById.set(cs.stackId, cs);
  }

  const expanded = new Set<string>();
  for (const id of selectedIds) {
    const e = graph.entities[id];
    if (!e) {
      continue;
    }
    if (!graph.spaces[activeSpaceId]?.entityIds.includes(id)) {
      continue;
    }
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
    if (!entity) {
      continue;
    }
    if (entity.stackId) {
      const cs = stackById.get(entity.stackId);
      if (cs && cs.entities.length > 1) {
        if (handledStacks.has(cs.stackId)) {
          continue;
        }
        handledStacks.add(cs.stackId);
        const b = boundsForCollapsedStack(cs, activeSpaceId);
        if (b) {
          acc = acc ? unionBounds(acc, b) : b;
        }
        continue;
      }
    }
    const b = boundsForEntityAtSlot(entity, activeSpaceId);
    if (b) {
      acc = acc ? unionBounds(acc, b) : b;
    }
  }

  return acc;
}

export interface FitCameraParams {
  bounds: WorldBounds;
  maxZoom: number;
  minZoom: number;
  paddingPx: number;
  viewportHeight: number;
  viewportWidth: number;
}

export function fitCameraToActiveSpaceContent(
  graph: CanvasGraph,
  activeSpaceId: string,
  viewportWidth: number,
  viewportHeight: number,
  minZoom: number,
  maxZoom: number,
  paddingPx = 120
): { scale: number; translateX: number; translateY: number } | null {
  const stacks = buildCollapsedStacksList(graph, activeSpaceId);
  const bounds = computeSpaceContentBounds(graph, activeSpaceId, stacks);
  if (!bounds) {
    return null;
  }
  return fitCameraToBounds({
    bounds,
    maxZoom,
    minZoom,
    paddingPx,
    viewportHeight,
    viewportWidth,
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
  paddingPx = 120
): { scale: number; translateX: number; translateY: number } | null {
  const stacks = buildCollapsedStacksList(graph, activeSpaceId);
  const bounds = computeBoundsForEntitySubset(
    graph,
    activeSpaceId,
    stacks,
    selectedIds
  );
  if (!bounds) {
    return null;
  }
  return fitCameraToBounds({
    bounds,
    maxZoom,
    minZoom,
    paddingPx,
    viewportHeight,
    viewportWidth,
  });
}

export function fitCameraToBounds(p: FitCameraParams): {
  scale: number;
  translateX: number;
  translateY: number;
} {
  const {
    bounds,
    viewportWidth: width,
    viewportHeight: height,
    paddingPx: pad,
    minZoom,
    maxZoom,
  } = p;
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const nextScale = Math.max(
    minZoom,
    Math.min(maxZoom, Math.min((width - pad) / spanX, (height - pad) / spanY))
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
  viewportHeight: number
): WorldBounds {
  return {
    maxX: -translateX / scale + viewportWidth / scale,
    maxY: -translateY / scale + viewportHeight / scale,
    minX: -translateX / scale,
    minY: -translateY / scale,
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
  opts?: { minVisibleRatio?: number }
): boolean {
  const minRatio = opts?.minVisibleRatio ?? 0.02;
  const inter = intersectionArea(content, viewport);
  const ratio = inter / contentPlaneArea(content);
  return ratio < minRatio;
}

export interface MinimapAtomRect {
  /** Axis-aligned bounds (union of rotated rect); used for content bounds / padding. */
  bounds: WorldBounds;
  height: number;
  key: string;
  rotationDeg: number;
  selected: boolean;
  width: number;
  /** Unrotated local rect in world space — matches canvas `nodePlacement` (top-left + size + CSS rotate). */
  x: number;
  y: number;
}

/**
 * One rect per standalone node or collapsed stack for minimap drawing.
 */
export function listMinimapAtomRects(
  graph: CanvasGraph,
  activeSpaceId: string,
  collapsedStacks: readonly CollapsedStackInfo[],
  selectedNodeIds: ReadonlySet<string>,
  placementSizes?: ReadonlyMap<string, MinimapPlacementSize> | null
): MinimapAtomRect[] {
  const entityIds = graph.spaces[activeSpaceId]?.entityIds ?? [];
  const stackMulti = new Set(collapsedStacks.map((c) => c.stackId));
  const out: MinimapAtomRect[] = [];

  for (const id of entityIds) {
    const entity = graph.entities[id];
    if (!entity) {
      continue;
    }
    if (entity.stackId && stackMulti.has(entity.stackId)) {
      continue;
    }
    const slot = entity.slots[activeSpaceId];
    if (!slot) {
      continue;
    }
    const measured = placementSizes?.get(id) ?? null;
    const { w, h } = entitySizeForMinimap(entity, measured);
    const b = boundsForEntityAtSlot(entity, activeSpaceId, measured);
    if (!b) {
      continue;
    }
    out.push({
      bounds: b,
      height: h,
      key: `e:${id}`,
      rotationDeg: entity.rotation ?? 0,
      selected: selectedNodeIds.has(id),
      width: w,
      x: slot.x,
      y: slot.y,
    });
  }

  for (const cs of collapsedStacks) {
    const { top, entities } = cs;
    const slot = top.slots[activeSpaceId];
    if (!slot) {
      continue;
    }
    const n = entities.length;
    const measuredTop = placementSizes?.get(top.id) ?? null;
    const b = boundsForCollapsedStack(cs, activeSpaceId, measuredTop);
    if (!b) {
      continue;
    }
    const selected = cs.entities.some((e) => selectedNodeIds.has(e.id));
    const { w: bw, h: bh } = entitySizeForMinimap(top, measuredTop);
    /* Top stack layer: translate((n−1)×6, (n−1)×6) then fan rotate — same as .stackLayer in the shell. */
    const topIndex = n - 1;
    const tx = topIndex * STACK_SPREAD_PX;
    const ty = topIndex * STACK_SPREAD_PX;
    const fanDeg = (topIndex - (n - 1) / 2) * STACK_FAN_ROT_STEP_DEG;
    out.push({
      bounds: b,
      height: bh,
      key: `s:${cs.stackId}`,
      rotationDeg: fanDeg,
      selected,
      width: bw,
      x: slot.x + tx,
      y: slot.y + ty,
    });
  }

  return out;
}
