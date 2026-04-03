"use client";

import {
  Crosshair,
  CursorClick,
  HandGrabbing,
  Minus,
  Plus,
} from "@phosphor-icons/react";

import type { CanvasTool } from "@/src/components/foundation/architectural-types";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

export function ArchitecturalToolRail({
  activeTool,
  onSetTool,
  onZoomIn,
  onZoomOut,
  onRecenter,
}: {
  activeTool: CanvasTool;
  onSetTool: (tool: CanvasTool) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
}) {
  return (
    <div className={styles.sideTools}>
      <button
        type="button"
        className={`${styles.btnIcon} ${
          activeTool === "select" ? styles.active : ""
        }`}
        title="Select"
        onClick={() => onSetTool("select")}
      >
        <CursorClick size={18} />
      </button>
      <button
        type="button"
        className={`${styles.btnIcon} ${activeTool === "pan" ? styles.active : ""}`}
        title="Pan Hand"
        onClick={() => onSetTool("pan")}
      >
        <HandGrabbing size={18} />
      </button>
      <div className={styles.sepVertical} />
      <button type="button" className={styles.btnIcon} title="Zoom In" onClick={onZoomIn}>
        <Plus size={18} />
      </button>
      <button type="button" className={styles.btnIcon} title="Zoom Out" onClick={onZoomOut}>
        <Minus size={18} />
      </button>
      <button
        type="button"
        className={styles.btnIcon}
        title="Recenter"
        onClick={onRecenter}
      >
        <Crosshair size={18} />
      </button>
    </div>
  );
}
