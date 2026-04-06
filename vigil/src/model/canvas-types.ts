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
 * `translateX` / `translateY` in `ArchitecturalCanvasApp`). World `(0, 0)` sits at
 * the canvas origin; **`defaultCamera()`** is the intentional home position for
 * arrival (bootstrap, open folder, recenter) — not “center of the viewport,” which
 * would shift content down/right. Policy: **`vigil/AGENTS.md`** (Canvas camera).
 */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

/** World origin, zoom 1 — default when entering a space or loading bootstrap data. */
export function defaultCamera(): CameraState {
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
