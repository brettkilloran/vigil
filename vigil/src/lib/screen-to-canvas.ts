import type { CameraState } from "@/src/stores/canvas-types";

/** Viewport-relative coords → world (canvas) coords. Layer uses translate(cam) then scale(zoom), origin top-left. */
export function screenToCanvas(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  camera: CameraState,
): { x: number; y: number } {
  const lx = clientX - viewportRect.left;
  const ly = clientY - viewportRect.top;
  return {
    x: (lx - camera.x) / camera.zoom,
    y: (ly - camera.y) / camera.zoom,
  };
}

export function canvasToScreen(
  worldX: number,
  worldY: number,
  viewportRect: DOMRect,
  camera: CameraState,
): { x: number; y: number } {
  return {
    x: viewportRect.left + camera.x + worldX * camera.zoom,
    y: viewportRect.top + camera.y + worldY * camera.zoom,
  };
}
