export type ItemType =
  | "note"
  | "sticky"
  | "image"
  | "checklist"
  | "webclip"
  | "folder";

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

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
