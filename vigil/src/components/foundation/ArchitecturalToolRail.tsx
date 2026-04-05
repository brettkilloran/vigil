"use client";

import {
  Crosshair,
  CursorClick,
  HandGrabbing,
  PushPin,
  Scissors,
  Minus,
  Plus,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
import type { CanvasTool } from "@/src/components/foundation/architectural-types";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { cx } from "@/src/lib/cx";

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
    <ArchitecturalTooltip content={label} side="right" delayMs={420}>
      <ArchitecturalButton
        size="icon"
        tone="glass"
        active={active}
        aria-label={label}
        onClick={onClick}
      >
        {icon}
      </ArchitecturalButton>
    </ArchitecturalTooltip>
  );
}

export function ArchitecturalToolRail({
  activeTool,
  onSetTool,
  connectionMode = "move",
  onSetConnectionMode,
  connectionColorControl,
  onZoomIn,
  onZoomOut,
  onRecenter,
  showSelectPan = true,
  showConnectionModes = true,
  showZoom = true,
  showRecenter = true,
}: {
  activeTool: CanvasTool;
  onSetTool: (tool: CanvasTool) => void;
  connectionMode?: "move" | "draw" | "cut";
  onSetConnectionMode?: (mode: "move" | "draw" | "cut") => void;
  connectionColorControl?: ReactNode;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  showSelectPan?: boolean;
  showConnectionModes?: boolean;
  showZoom?: boolean;
  showRecenter?: boolean;
}) {
  /** Canvas keeps `activeTool === "select"` while drawing/cutting; rail must show one mode only. */
  const canvasToolActive = connectionMode === "move";

  const drawConnectionButton = (
    <ArchitecturalToolButton
      label="Draw connection"
      active={connectionMode === "draw"}
      icon={<PushPin size={18} />}
      onClick={() => onSetConnectionMode?.("draw")}
    />
  );

  const threadSpoolOpen = connectionMode === "draw";

  const toolGroup =
    showSelectPan ||
    showConnectionModes ||
    (!showConnectionModes && !!connectionColorControl);
  const viewGroup = showZoom || showRecenter;

  return (
    <div className={styles.sideTools}>
      {toolGroup ? (
        <div
          className={styles.sideToolsMainPanel}
          role="toolbar"
          aria-label="Canvas tools"
        >
          <div className={styles.sideToolsToolGroup}>
            {showSelectPan ? (
              <>
                <ArchitecturalToolButton
                  label="Select"
                  active={canvasToolActive && activeTool === "select"}
                  icon={<CursorClick size={18} />}
                  onClick={() => onSetTool("select")}
                />
                <ArchitecturalToolButton
                  label="Pan Hand"
                  active={canvasToolActive && activeTool === "pan"}
                  icon={<HandGrabbing size={18} />}
                  onClick={() => onSetTool("pan")}
                />
              </>
            ) : null}
            {showConnectionModes ? (
              <>
                {connectionColorControl ? (
                  <div
                    className={cx(
                      styles.sideToolsDrawSpoolCluster,
                      threadSpoolOpen && styles.sideToolsDrawSpoolClusterEngaged,
                    )}
                  >
                    {drawConnectionButton}
                    <div
                      className={cx(
                        styles.sideToolsThreadSpoolReveal,
                        threadSpoolOpen && styles.sideToolsThreadSpoolRevealOpen,
                      )}
                    >
                      <div className={styles.sideToolsThreadSpoolRevealInner}>
                        <div className={styles.sideToolsConnectionColor}>{connectionColorControl}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  drawConnectionButton
                )}
                <ArchitecturalToolButton
                  label="Cut connection"
                  active={connectionMode === "cut"}
                  icon={<Scissors size={18} />}
                  onClick={() => onSetConnectionMode?.("cut")}
                />
              </>
            ) : null}
            {!showConnectionModes && connectionColorControl ? (
              <div className={styles.sideToolsConnectionColor}>{connectionColorControl}</div>
            ) : null}
          </div>
        </div>
      ) : null}
      {viewGroup ? (
        <div
          className={styles.sideToolsMainPanel}
          role="toolbar"
          aria-label="View"
        >
          <div className={styles.sideToolsToolGroup}>
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
        </div>
      ) : null}
    </div>
  );
}
