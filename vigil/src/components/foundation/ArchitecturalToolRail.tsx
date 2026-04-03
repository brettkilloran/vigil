"use client";

import {
  Crosshair,
  CursorClick,
  HandGrabbing,
  Minus,
  Plus,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

import type { CanvasTool } from "@/src/components/foundation/architectural-types";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

export function ArchitecturalToolButton({
  label,
  active = false,
  icon,
  onClick,
}: {
  label: string;
  active?: boolean;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.btnIcon} ${active ? styles.active : ""}`}
      title={label}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

export function ArchitecturalToolRail({
  activeTool,
  onSetTool,
  onZoomIn,
  onZoomOut,
  onRecenter,
  showSelectPan = true,
  showZoom = true,
  showRecenter = true,
}: {
  activeTool: CanvasTool;
  onSetTool: (tool: CanvasTool) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  showSelectPan?: boolean;
  showZoom?: boolean;
  showRecenter?: boolean;
}) {
  return (
    <div className={styles.sideTools}>
      {showSelectPan ? (
        <>
          <ArchitecturalToolButton
            label="Select"
            active={activeTool === "select"}
            icon={<CursorClick size={18} />}
            onClick={() => onSetTool("select")}
          />
          <ArchitecturalToolButton
            label="Pan Hand"
            active={activeTool === "pan"}
            icon={<HandGrabbing size={18} />}
            onClick={() => onSetTool("pan")}
          />
        </>
      ) : null}
      {showSelectPan && (showZoom || showRecenter) ? (
        <div className={styles.sepVertical} />
      ) : null}
      {showZoom ? (
        <>
          <ArchitecturalToolButton
            label="Zoom In"
            icon={<Plus size={18} />}
            onClick={onZoomIn}
          />
          <ArchitecturalToolButton
            label="Zoom Out"
            icon={<Minus size={18} />}
            onClick={onZoomOut}
          />
        </>
      ) : null}
      {showRecenter ? (
        <ArchitecturalToolButton
          label="Recenter"
          icon={<Crosshair size={18} />}
          onClick={onRecenter}
        />
      ) : null}
    </div>
  );
}
