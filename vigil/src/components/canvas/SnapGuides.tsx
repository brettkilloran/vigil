"use client";

import type { CameraState } from "@/src/stores/canvas-types";
import type { SnapGuide } from "@/src/lib/snap";

export function SnapGuidesOverlay({
  guides,
  camera,
  viewportWidth,
  viewportHeight,
}: {
  guides: SnapGuide[];
  camera: CameraState;
  viewportWidth: number;
  viewportHeight: number;
}) {
  if (guides.length === 0) return null;

  const lines: React.ReactNode[] = [];
  let k = 0;
  for (const g of guides) {
    if (g.kind === "v") {
      const sx = g.pos * camera.zoom + camera.x;
      lines.push(
        <line
          key={k++}
          x1={sx}
          y1={0}
          x2={sx}
          y2={viewportHeight}
          stroke="var(--vigil-snap, #3b82f6)"
          strokeWidth={1}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />,
      );
    } else {
      const sy = g.pos * camera.zoom + camera.y;
      lines.push(
        <line
          key={k++}
          x1={0}
          y1={sy}
          x2={viewportWidth}
          y2={sy}
          stroke="var(--vigil-snap, #3b82f6)"
          strokeWidth={1}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />,
      );
    }
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10"
      width={viewportWidth}
      height={viewportHeight}
    >
      {lines}
    </svg>
  );
}
