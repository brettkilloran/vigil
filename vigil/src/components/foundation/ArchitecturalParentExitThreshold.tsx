"use client";

import { TrayArrowUp } from "@phosphor-icons/react";
import { forwardRef } from "react";

import styles from "@/src/components/foundation/ArchitecturalParentExitThreshold.module.css";

export type ArchitecturalParentExitThresholdProps = {
  /** Matches top-left stack `getBoundingClientRect().top` so the rail aligns with the chrome row. */
  topPx: number;
  /** Matches stack height so the dashed well sits on the same vertical band as status + breadcrumbs. */
  heightPx: number;
  /** When false, band stays invisible (ref still valid for layout if needed). */
  armed: boolean;
  hovered: boolean;
};

/**
 * Centered dashed drop slot on the same vertical band as the top rail. Ref sits on the well
 * so hit-testing matches the visible target (`getBoundingClientRect()` vs drag center).
 */
export const ArchitecturalParentExitThreshold = forwardRef<
  HTMLDivElement,
  ArchitecturalParentExitThresholdProps
>(function ArchitecturalParentExitThreshold({ topPx, heightPx, armed, hovered }, ref) {
  return (
    <div
      className={`${styles.rail} ${armed ? styles.railArmed : ""}`}
      style={{ top: topPx, height: heightPx }}
    >
      <div
        ref={ref}
        className={`${styles.well} ${armed ? styles.wellArmed : ""} ${hovered ? styles.wellHovered : ""}`}
        role="region"
        aria-label="Drop here to remove selection from this folder into the parent space"
      >
        <TrayArrowUp size={14} weight="bold" className={styles.icon} aria-hidden />
        <span className={styles.label} aria-hidden>
          Remove from folder
        </span>
      </div>
    </div>
  );
});
