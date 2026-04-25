export type ItemType =
  | "note"
  | "sticky"
  | "image"
  | "checklist"
  | "webclip"
  | "folder";

/**
 * Logical camera for the infinite canvas. **`x` / `y`** are the **CSS transform
 * translate** applied to the scene in screen pixels (same units as React state
 * `translateX` / `translateY` in `ArchitecturalCanvasApp`). With **`defaultCamera`**,
 * world `(0, 0)` is at the **center** of the viewport (measured CSS pixels). Policy:
 * **`AGENTS.md`** (Canvas camera).
 */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Home camera: world origin centered in the viewport, zoom 1.
 * Pass measured viewport width/height when known; otherwise uses `window` on the client, else `{0,0,1}`.
 */
function pickViewportDimension(
  measured: number | undefined,
  windowDim: () => number
): number {
  if (measured != null && measured > 0) {
    return measured;
  }
  if (typeof window !== "undefined") {
    const wd = windowDim();
    if (wd > 0) {
      return wd;
    }
  }
  return 0;
}

export function defaultCamera(
  viewportWidth?: number,
  viewportHeight?: number
): CameraState {
  const w = pickViewportDimension(viewportWidth, () => window.innerWidth);
  const h = pickViewportDimension(viewportHeight, () => window.innerHeight);
  if (w > 0 && h > 0) {
    return { x: w / 2, y: h / 2, zoom: 1 };
  }
  return { x: 0, y: 0, zoom: 1 };
}

export interface CanvasItem {
  color?: string | null;
  contentJson?: Record<string, unknown> | null;
  contentText: string;
  entityMeta?: Record<string, unknown> | null;
  entityType?: string | null;
  height: number;
  id: string;
  imageMeta?: Record<string, unknown> | null;
  imageUrl?: string | null;
  itemType: ItemType;
  spaceId: string;
  stackId?: string | null;
  stackOrder?: number | null;
  title: string;
  /** ISO timestamp from DB; used for delta sync and optimistic concurrency. */
  updatedAt?: string;
  width: number;
  x: number;
  y: number;
  zIndex: number;
}
