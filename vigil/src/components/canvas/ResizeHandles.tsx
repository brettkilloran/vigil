"use client";

import type { CSSProperties } from "react";

import type { ResizeHandle } from "@/src/stores/canvas-store";

const HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const pos: Record<ResizeHandle, { style: CSSProperties; cursor: string }> = {
  nw: { style: { top: -5, left: -5 }, cursor: "nwse-resize" },
  n: {
    style: { top: -5, left: "50%", transform: "translateX(-50%)" },
    cursor: "ns-resize",
  },
  ne: { style: { top: -5, right: -5 }, cursor: "nesw-resize" },
  e: {
    style: { top: "50%", right: -5, transform: "translateY(-50%)" },
    cursor: "ew-resize",
  },
  se: { style: { bottom: -5, right: -5 }, cursor: "nwse-resize" },
  s: {
    style: { bottom: -5, left: "50%", transform: "translateX(-50%)" },
    cursor: "ns-resize",
  },
  sw: { style: { bottom: -5, left: -5 }, cursor: "nesw-resize" },
  w: {
    style: { top: "50%", left: -5, transform: "translateY(-50%)" },
    cursor: "ew-resize",
  },
};

export function ResizeHandles({
  onPointerDown,
}: {
  onPointerDown: (handle: ResizeHandle, e: React.PointerEvent) => void;
}) {
  return (
    <>
      {HANDLES.map((h) => (
        <button
          key={h}
          type="button"
          aria-label={`Resize ${h}`}
          className="absolute z-20 h-3 w-3 rounded-md border border-[var(--vigil-snap)] shadow-sm"
          style={{
            ...pos[h].style,
            cursor: pos[h].cursor,
            background:
              "color-mix(in srgb, var(--vigil-snap) 32%, var(--vigil-card-bg))",
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            (e.currentTarget as HTMLButtonElement).setPointerCapture(
              e.pointerId,
            );
            onPointerDown(h, e);
          }}
        />
      ))}
    </>
  );
}
