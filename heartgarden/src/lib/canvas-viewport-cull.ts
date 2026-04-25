import { entityGeometryOnSpace } from "@/src/components/foundation/architectural-db-bridge";
import type {
  CanvasConnectionPin,
  CanvasEntity,
  CanvasGraph,
  CanvasPinConnection,
} from "@/src/components/foundation/architectural-types";

/** Axis-aligned rectangle in **world** (canvas) coordinates. */
export interface WorldRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

/** Default content pin insets — keep aligned with `ArchitecturalCanvasApp` `CONNECTION_PIN_DEFAULT_*`. */
const PIN_DEFAULT_CONTENT: CanvasConnectionPin = {
  anchor: "topLeftInset",
  insetX: 14,
  insetY: 18,
};
const PIN_DEFAULT_FOLDER: CanvasConnectionPin = {
  anchor: "topLeftInset",
  insetX: 34,
  insetY: 80,
};

/**
 * World-space bounds visible through the viewport, expanded by `marginWorld` on each side
 * (same space as entity `x` / `y` / `width`; inverse of CSS `transform: translate(tx,ty) scale(s)`).
 */
export function worldRectFromViewport(
  translateX: number,
  translateY: number,
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
  marginWorld: number
): WorldRect {
  if (!Number.isFinite(scale) || scale === 0) {
    return {
      bottom: Number.POSITIVE_INFINITY,
      left: Number.NEGATIVE_INFINITY,
      right: Number.POSITIVE_INFINITY,
      top: Number.NEGATIVE_INFINITY,
    };
  }
  const inv = 1 / scale;
  const left = -translateX * inv - marginWorld;
  const top = -translateY * inv - marginWorld;
  const right = (viewportWidth - translateX) * inv + marginWorld;
  const bottom = (viewportHeight - translateY) * inv + marginWorld;
  return { bottom, left, right, top };
}

export function rectsIntersect(a: WorldRect, b: WorldRect): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

export function entityWorldAabb(
  entity: CanvasEntity,
  spaceId: string
): { left: number; top: number; right: number; bottom: number } {
  const g = entityGeometryOnSpace(entity, spaceId);
  return {
    bottom: g.y + g.height,
    left: g.x,
    right: g.x + g.width,
    top: g.y,
  };
}

export function entityIntersectsWorldRect(
  entity: CanvasEntity,
  spaceId: string,
  rect: WorldRect,
  exceptionEntityIds: ReadonlySet<string>
): boolean {
  if (exceptionEntityIds.has(entity.id)) {
    return true;
  }
  return rectsIntersect(rect, entityWorldAabb(entity, spaceId));
}

export function unionEntityWorldAabbs(
  entities: readonly CanvasEntity[],
  spaceId: string
): WorldRect {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const e of entities) {
    const b = entityWorldAabb(e, spaceId);
    left = Math.min(left, b.left);
    top = Math.min(top, b.top);
    right = Math.max(right, b.right);
    bottom = Math.max(bottom, b.bottom);
  }
  if (!Number.isFinite(left)) {
    return { bottom: 0, left: 0, right: 0, top: 0 };
  }
  return { bottom, left, right, top };
}

export function collapsedStackIntersectsWorldRect(
  entities: readonly CanvasEntity[],
  spaceId: string,
  rect: WorldRect,
  exceptionEntityIds: ReadonlySet<string>
): boolean {
  if (entities.some((e) => exceptionEntityIds.has(e.id))) {
    return true;
  }
  return rectsIntersect(rect, unionEntityWorldAabbs(entities, spaceId));
}

function normalizePin(
  entity: CanvasEntity,
  pin: CanvasConnectionPin
): CanvasConnectionPin {
  if (pin.anchor === "topLeftInset") {
    return entity.kind === "folder" ? PIN_DEFAULT_FOLDER : PIN_DEFAULT_CONTENT;
  }
  return pin;
}

/** Fallback pin position when DOM placement is unavailable (matches non-DOM branch of `resolveConnectionPin`). */
export function approximateConnectionPinWorld(
  entityId: string,
  pin: CanvasConnectionPin,
  spaceId: string,
  graph: CanvasGraph
): { x: number; y: number } | null {
  const entity = graph.entities[entityId];
  if (!entity) {
    return null;
  }
  const slot = entity.slots[spaceId];
  if (!slot) {
    return null;
  }
  const p = normalizePin(entity, pin);
  return { x: slot.x + p.insetX, y: slot.y + p.insetY };
}

function segmentAabbIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: WorldRect
): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return !(
    maxX < rect.left ||
    minX > rect.right ||
    maxY < rect.top ||
    minY > rect.bottom
  );
}

export function connectionIntersectsWorldRect(
  connection: CanvasPinConnection,
  graph: CanvasGraph,
  activeSpaceId: string,
  worldRect: WorldRect,
  exceptionEntityIds: ReadonlySet<string>
): boolean {
  if (
    exceptionEntityIds.has(connection.sourceEntityId) ||
    exceptionEntityIds.has(connection.targetEntityId)
  ) {
    return true;
  }
  const source = graph.entities[connection.sourceEntityId];
  const target = graph.entities[connection.targetEntityId];
  if (!(source && target)) {
    return false;
  }
  if (!(source.slots[activeSpaceId] && target.slots[activeSpaceId])) {
    return false;
  }

  if (
    entityIntersectsWorldRect(
      source,
      activeSpaceId,
      worldRect,
      exceptionEntityIds
    ) ||
    entityIntersectsWorldRect(
      target,
      activeSpaceId,
      worldRect,
      exceptionEntityIds
    )
  ) {
    return true;
  }

  const p1 = approximateConnectionPinWorld(
    connection.sourceEntityId,
    connection.sourcePin,
    activeSpaceId,
    graph
  );
  const p2 = approximateConnectionPinWorld(
    connection.targetEntityId,
    connection.targetPin,
    activeSpaceId,
    graph
  );
  if (!(p1 && p2)) {
    return false;
  }
  return segmentAabbIntersectsRect(p1.x, p1.y, p2.x, p2.y, worldRect);
}

export function buildCullExceptionEntityIds(options: {
  selectedNodeIds: readonly string[];
  draggedNodeIds: readonly string[];
  connectionSourceId: string | null;
}): Set<string> {
  const s = new Set<string>();
  options.selectedNodeIds.forEach((id) => s.add(id));
  options.draggedNodeIds.forEach((id) => s.add(id));
  if (options.connectionSourceId) {
    s.add(options.connectionSourceId);
  }
  return s;
}
