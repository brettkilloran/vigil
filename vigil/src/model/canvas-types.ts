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
 * **`vigil/AGENTS.md`** (Canvas camera).
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
export function defaultCamera(viewportWidth?: number, viewportHeight?: number): CameraState {
  const w =
    viewportWidth != null && viewportWidth > 0
      ? viewportWidth
      : typeof window !== "undefined" && window.innerWidth > 0
        ? window.innerWidth
        : 0;
  const h =
    viewportHeight != null && viewportHeight > 0
      ? viewportHeight
      : typeof window !== "undefined" && window.innerHeight > 0
        ? window.innerHeight
        : 0;
  if (w > 0 && h > 0) {
    return { x: w / 2, y: h / 2, zoom: 1 };
  }
  return { x: 0, y: 0, zoom: 1 };
}

export interface CanvasItem {
  id: string;
  spaceId: string;
  itemType: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  title: string;
  contentText: string;
  contentJson?: Record<string, unknown> | null;
  imageUrl?: string | null;
  imageMeta?: Record<string, unknown> | null;
  color?: string | null;
  entityType?: string | null;
  entityMeta?: Record<string, unknown> | null;
  stackId?: string | null;
  stackOrder?: number | null;
  /** ISO timestamp from DB; used for delta sync and optimistic concurrency. */
  updatedAt?: string;
}
