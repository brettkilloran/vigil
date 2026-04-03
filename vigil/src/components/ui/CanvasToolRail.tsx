"use client";

import {
  CrosshairSimple,
  CursorClick,
  Hand,
  Minus,
  Plus,
} from "@phosphor-icons/react";

import {
  VIGIL_BTN_ICON,
  VIGIL_BTN_ICON_ACTIVE,
  VIGIL_GLASS_PANEL,
} from "@/src/lib/vigil-ui-classes";
import { useCanvasStore } from "@/src/stores/canvas-store";

export function CanvasToolRail() {
  const canvasTool = useCanvasStore((s) => s.canvasTool);
  const setCanvasTool = useCanvasStore((s) => s.setCanvasTool);
  const camera = useCanvasStore((s) => s.camera);
  const setCamera = useCanvasStore((s) => s.setCamera);

  return (
    <div
      className={`pointer-events-auto fixed right-6 top-1/2 z-[820] flex -translate-y-1/2 flex-col gap-1 p-2 ${VIGIL_GLASS_PANEL}`}
      role="toolbar"
      aria-label="Canvas tools"
    >
      <button
        type="button"
        className={`${VIGIL_BTN_ICON} ${
          canvasTool === "select" ? VIGIL_BTN_ICON_ACTIVE : ""
        }`}
        title="Select tool"
        aria-label="Select tool"
        onClick={() => setCanvasTool("select")}
      >
        <CursorClick size={17} weight="bold" />
      </button>
      <button
        type="button"
        className={`${VIGIL_BTN_ICON} ${
          canvasTool === "pan" ? VIGIL_BTN_ICON_ACTIVE : ""
        }`}
        title="Pan tool"
        aria-label="Pan tool"
        onClick={() => setCanvasTool("pan")}
      >
        <Hand size={17} weight="bold" />
      </button>
      <span className="mx-2 my-1 h-px bg-[var(--vigil-border)]" aria-hidden />
      <button
        type="button"
        className={VIGIL_BTN_ICON}
        title="Zoom in"
        aria-label="Zoom in"
        onClick={() =>
          setCamera({ ...camera, zoom: Math.min(8, Number((camera.zoom + 0.2).toFixed(3))) })
        }
      >
        <Plus size={17} weight="bold" />
      </button>
      <button
        type="button"
        className={VIGIL_BTN_ICON}
        title="Zoom out"
        aria-label="Zoom out"
        onClick={() =>
          setCamera({ ...camera, zoom: Math.max(0.15, Number((camera.zoom - 0.2).toFixed(3))) })
        }
      >
        <Minus size={17} weight="bold" />
      </button>
      <button
        type="button"
        className={VIGIL_BTN_ICON}
        title="Recenter"
        aria-label="Recenter"
        onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}
      >
        <CrosshairSimple size={17} weight="bold" />
      </button>
    </div>
  );
}
