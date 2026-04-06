import type { CameraState } from "@/src/model/canvas-types";

/** Per-space viewport in localStorage (shared PIN: one remembered view per browser profile per space). */
const STORAGE_KEY = "heartgarden-space-camera-v1";

const MAX_ZOOM = 8;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function readSpaceCamera(spaceId: string): CameraState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const entry = parsed[spaceId];
    if (!isRecord(entry)) return null;
    const x = entry.x;
    const y = entry.y;
    const zoom = entry.zoom;
    if (typeof x !== "number" || typeof y !== "number" || typeof zoom !== "number") return null;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) return null;
    if (zoom <= 0 || zoom > MAX_ZOOM) return null;
    return { x, y, zoom };
  } catch {
    return null;
  }
}

export function writeSpaceCamera(spaceId: string, camera: CameraState): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const map: Record<string, { x: number; y: number; zoom: number }> = {};
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) {
        for (const [k, v] of Object.entries(parsed)) {
          if (
            isRecord(v) &&
            typeof v.x === "number" &&
            typeof v.y === "number" &&
            typeof v.zoom === "number"
          ) {
            map[k] = { x: v.x, y: v.y, zoom: v.zoom };
          }
        }
      }
    }
    map[spaceId] = { x: camera.x, y: camera.y, zoom: camera.zoom };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}
