import type { ResizeHandle } from "@/src/stores/canvas-store";

const MIN_W = 120;
const MIN_H = 80;

/** dx, dy in world (canvas) coordinates */
export function resizeFromHandle(
  handle: ResizeHandle,
  r: { x: number; y: number; w: number; h: number },
  dx: number,
  dy: number,
  lockAspect: boolean,
): { x: number; y: number; w: number; h: number } {
  let x = r.x;
  let y = r.y;
  let w = r.w;
  let h = r.h;
  const ar = r.w / r.h;

  if (handle.includes("e")) w = r.w + dx;
  if (handle.includes("s")) h = r.h + dy;
  if (handle.includes("w")) {
    const nw = r.w - dx;
    if (nw >= MIN_W) {
      x = r.x + dx;
      w = nw;
    }
  }
  if (handle.includes("n")) {
    const nh = r.h - dy;
    if (nh >= MIN_H) {
      y = r.y + dy;
      h = nh;
    }
  }

  w = Math.max(MIN_W, w);
  h = Math.max(MIN_H, h);

  if (lockAspect) {
    if (handle.includes("e") || handle.includes("w")) {
      h = Math.max(MIN_H, w / ar);
    } else {
      w = Math.max(MIN_W, h * ar);
    }
    if (handle.includes("w")) x = r.x + r.w - w;
    if (handle.includes("n")) y = r.y + r.h - h;
  }

  return { x, y, w, h };
}
