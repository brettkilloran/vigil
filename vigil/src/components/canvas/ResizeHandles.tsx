"use client";

import type { CSSProperties } from "react";

import type { ResizeHandle } from "@/src/stores/canvas-store";

const HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const pos: Record<ResizeHandle, { style: CSSProperties; cursor: string }> = {
  nw: { style: { top: -4, left: -4 }, cursor: "nwse-resize" },
  n: { style: { top: -4, left: "50%", transform: "translateX(-50%)" }, cursor: "ns-resize" },
  ne: { style: { top: -4, right: -4 }, cursor: "nesw-resize" },
  e: { style: { top: "50%", right: -4, transform: "translateY(-50%)" }, cursor: "ew-resize" },
  se: { style: { bottom: -4, right: -4 }, cursor: "nwse-resize" },
  s: { style: { bottom: -4, left: "50%", transform: "translateX(-50%)" }, cursor: "ns-resize" },
  sw: { style: { bottom: -4, left: -4 }, cursor: "nesw-resize" },
  w: { style: { top: "50%", left: -4, transform: "translateY(-50%)" }, cursor: "ew-resize" },
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
          className="absolute z-20 h-2.5 w-2.5 rounded-sm border border-[var(--vigil-snap)] bg-white shadow dark:bg-neutral-800"
          style={{ ...pos[h].style, cursor: pos[h].cursor }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
            onPointerDown(h, e);
          }}
        />
      ))}
    </>
  );
}
