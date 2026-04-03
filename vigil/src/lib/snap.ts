import type { CameraState } from "@/src/stores/canvas-types";

export type SnapGuide = {
  kind: "v" | "h";
  pos: number;
};

const DEFAULT_THRESHOLD_PX = 6;

export function snapRectPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  excludeId: string | undefined,
  others: { id: string; x: number; y: number; width: number; height: number }[],
  camera: CameraState,
  enabled: boolean,
): { x: number; y: number; guides: SnapGuide[] } {
  if (!enabled) return { x, y, guides: [] };

  const t = DEFAULT_THRESHOLD_PX / camera.zoom;
  const guides: SnapGuide[] = [];
  let nx = x;
  let ny = y;

  const selfLeft = x;
  const selfRight = x + w;
  const selfCx = x + w / 2;
  const selfTop = y;
  const selfBottom = y + h;
  const selfCy = y + h / 2;

  let bestXL: { d: number; v: number; g: SnapGuide } | null = null;
  let bestXR: { d: number; v: number; g: SnapGuide } | null = null;
  let bestXC: { d: number; v: number; g: SnapGuide } | null = null;
  let bestYT: { d: number; v: number; g: SnapGuide } | null = null;
  let bestYB: { d: number; v: number; g: SnapGuide } | null = null;
  let bestYC: { d: number; v: number; g: SnapGuide } | null = null;

  for (const o of others) {
    if (o.id === excludeId) continue;
    const ol = o.x;
    const or = o.x + o.width;
    const oc = o.x + o.width / 2;
    const ot = o.y;
    const ob = o.y + o.height;
    const ocy = o.y + o.height / 2;

    const tryV = (
      selfEdge: number,
      target: number,
      snapTo: number,
      acc: typeof bestXL,
    ) => {
      const d = Math.abs(selfEdge - target);
      if (d < t && (!acc || d < acc.d)) {
        return { d, v: snapTo, g: { kind: "v" as const, pos: target } };
      }
      return acc;
    };

    const tryH = (
      selfEdge: number,
      target: number,
      snapTo: number,
      acc: typeof bestYT,
    ) => {
      const d = Math.abs(selfEdge - target);
      if (d < t && (!acc || d < acc.d)) {
        return { d, v: snapTo, g: { kind: "h" as const, pos: target } };
      }
      return acc;
    };

    bestXL = tryV(selfLeft, ol, ol, bestXL);
    bestXL = tryV(selfLeft, or, or, bestXL);
    bestXL = tryV(selfLeft, oc, oc, bestXL);
    bestXR = tryV(selfRight, ol, ol + w, bestXR);
    bestXR = tryV(selfRight, or, or + w, bestXR);
    bestXR = tryV(selfRight, oc, oc + w, bestXR);
    bestXC = tryV(selfCx, oc, oc - w / 2, bestXC);

    bestYT = tryH(selfTop, ot, ot, bestYT);
    bestYT = tryH(selfTop, ob, ob, bestYT);
    bestYT = tryH(selfTop, ocy, ocy, bestYT);
    bestYB = tryH(selfBottom, ot, ot - h, bestYB);
    bestYB = tryH(selfBottom, ob, ob - h, bestYB);
    bestYB = tryH(selfBottom, ocy, ocy - h, bestYB);
    bestYC = tryH(selfCy, ocy, ocy - h / 2, bestYC);
  }

  if (bestXL) {
    nx = bestXL.v;
    guides.push(bestXL.g);
  } else if (bestXR) {
    nx = bestXR.v;
    guides.push(bestXR.g);
  } else if (bestXC) {
    nx = bestXC.v;
    guides.push(bestXC.g);
  }

  if (bestYT) {
    ny = bestYT.v;
    guides.push(bestYT.g);
  } else if (bestYB) {
    ny = bestYB.v;
    guides.push(bestYB.g);
  } else if (bestYC) {
    ny = bestYC.v;
    guides.push(bestYC.g);
  }

  return { x: nx, y: ny, guides };
}
