"use client";

import { forwardRef } from "react";

import styles from "@/src/components/foundation/ArchitecturalParentExitThreshold.module.css";

/** Viewport band height used for hit-testing (matches visual). */
export const PARENT_EXIT_BAND_HEIGHT_PX = 44;

export type ArchitecturalParentExitThresholdProps = {
  topPx: number;
  /** When false, band stays invisible (ref still valid for layout if needed). */
  armed: boolean;
  hovered: boolean;
};

/**
 * Top-edge “airlock” for leaving a nested folder space. Hit-testing uses this
 * node’s `getBoundingClientRect()` against the drag preview center.
 */
export const ArchitecturalParentExitThreshold = forwardRef<
  HTMLDivElement,
  ArchitecturalParentExitThresholdProps
>(function ArchitecturalParentExitThreshold({ topPx, armed, hovered }, ref) {
  return (
    <div
      ref={ref}
      className={`${styles.band} ${armed ? styles.bandArmed : ""} ${hovered ? styles.bandHovered : ""}`}
      style={{ top: topPx, height: PARENT_EXIT_BAND_HEIGHT_PX }}
      aria-hidden="true"
    />
  );
});
