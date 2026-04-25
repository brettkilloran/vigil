"use client";

import {
  Crosshair,
  CursorClick,
  HandGrabbing,
  Minus,
  Plus,
  PushPin,
  Scissors,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { ArchitecturalButton } from "@/src/components/foundation/architectural-button";
import { ArchitecturalTooltip } from "@/src/components/foundation/architectural-tooltip";
import type { CanvasTool } from "@/src/components/foundation/architectural-types";
import { cx } from "@/src/lib/cx";

export function ArchitecturalToolButton({
  label,
  tooltip,
  active = false,
  icon,
  onClick,
}: {
  /** Short name for `aria-label` and toolbar affordance. */
  label: string;
  /** Optional longer hover explanation (defaults to `label`). */
  tooltip?: string;
  active?: boolean;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const hover = tooltip ?? label;
  return (
    <ArchitecturalTooltip content={hover} delayMs={420} side="right">
      <ArchitecturalButton
        active={active}
        aria-label={label}
        onClick={onClick}
        size="icon"
        tone="glass"
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
      active={connectionMode === "draw"}
      icon={<PushPin size={18} />}
      label="Draw thread"
      onClick={() => onSetConnectionMode?.("draw")}
      tooltip="Draw thread — click two cards to connect; right-click to tag."
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
          aria-label="Canvas tools"
          className={styles.sideToolsMainPanel}
          role="toolbar"
        >
          <div className={styles.sideToolsToolGroup}>
            {showSelectPan ? (
              <>
                <ArchitecturalToolButton
                  active={canvasToolActive && activeTool === "select"}
                  icon={<CursorClick size={18} />}
                  label="Select"
                  onClick={() => onSetTool("select")}
                  tooltip="Select — click and drag cards. Canvas threads stay inactive while Move mode is on."
                />
                <ArchitecturalToolButton
                  active={canvasToolActive && activeTool === "pan"}
                  icon={<HandGrabbing size={18} />}
                  label="Pan"
                  onClick={() => onSetTool("pan")}
                  tooltip="Pan — drag the empty canvas to move the view."
                />
              </>
            ) : null}
            {showConnectionModes ? (
              <>
                {connectionColorControl ? (
                  <div
                    className={cx(
                      styles.sideToolsDrawSpoolCluster,
                      threadSpoolOpen && styles.sideToolsDrawSpoolClusterEngaged
                    )}
                  >
                    {drawConnectionButton}
                    <div
                      className={cx(
                        styles.sideToolsThreadSpoolReveal,
                        threadSpoolOpen && styles.sideToolsThreadSpoolRevealOpen
                      )}
                    >
                      <div className={styles.sideToolsThreadSpoolRevealInner}>
                        <div className={styles.sideToolsConnectionColor}>
                          {connectionColorControl}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  drawConnectionButton
                )}
                <ArchitecturalToolButton
                  active={connectionMode === "cut"}
                  icon={<Scissors size={18} />}
                  label="Cut thread"
                  onClick={() => onSetConnectionMode?.("cut")}
                  tooltip="Cut thread — click ropes to remove them."
                />
              </>
            ) : null}
            {!showConnectionModes && connectionColorControl ? (
              <div className={styles.sideToolsConnectionColor}>
                {connectionColorControl}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {viewGroup ? (
        <div
          aria-label="View"
          className={styles.sideToolsMainPanel}
          role="toolbar"
        >
          <div className={styles.sideToolsToolGroup}>
            {showZoom ? (
              <>
                <ArchitecturalToolButton
                  icon={<Plus size={18} />}
                  label="Zoom In"
                  onClick={onZoomIn}
                />
                <ArchitecturalToolButton
                  icon={<Minus size={18} />}
                  label="Zoom Out"
                  onClick={onZoomOut}
                />
              </>
            ) : null}
            {showRecenter ? (
              <ArchitecturalToolButton
                icon={<Crosshair size={18} />}
                label="Recenter"
                onClick={onRecenter}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
