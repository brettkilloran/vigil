import { z } from "zod";

import {
  HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MAX,
  HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MIN,
} from "@/src/lib/heartgarden-collab-constants";
import type { CameraState } from "@/src/model/canvas-types";
import { defaultCamera } from "@/src/model/canvas-types";

const finite = z.number().finite();

export const presenceCameraSchema = z.object({
  x: finite,
  y: finite,
  zoom: finite
    .min(HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MIN)
    .max(HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MAX),
});

export const presencePointerSchema = z.object({
  x: finite,
  y: finite,
});

export const presencePostBodySchema = z.object({
  clientId: z.string().uuid(),
  camera: presenceCameraSchema,
  pointer: presencePointerSchema.nullable().optional(),
});

export type PresencePostBody = z.infer<typeof presencePostBodySchema>;

export function clampPresenceCamera(cam: CameraState): CameraState {
  const zv = Number.isFinite(cam.zoom)
    ? Math.min(
        HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MAX,
        Math.max(HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MIN, cam.zoom),
      )
    : 1;
  return {
    x: Number.isFinite(cam.x) ? cam.x : 0,
    y: Number.isFinite(cam.y) ? cam.y : 0,
    zoom: zv,
  };
}

export function safePresenceCameraFromUnknown(raw: unknown): CameraState {
  const p = presenceCameraSchema.safeParse(raw);
  return p.success ? clampPresenceCamera(p.data) : defaultCamera();
}

export function safePresencePointerFromUnknown(raw: unknown): { x: number; y: number } | null {
  if (raw == null) return null;
  const p = presencePointerSchema.safeParse(raw);
  return p.success ? p.data : null;
}
