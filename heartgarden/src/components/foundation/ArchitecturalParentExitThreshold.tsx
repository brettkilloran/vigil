"use client";

import { TrayArrowUp } from "@phosphor-icons/react";
import { forwardRef, type KeyboardEvent, useCallback } from "react";

import styles from "@/src/components/foundation/ArchitecturalParentExitThreshold.module.css";

export type ArchitecturalParentExitThresholdProps = {
  /** Reserved for future layout tuning (rail height is content-sized). */
  toolbarBottomPx: number;
  /** Reserved for future layout tuning. */
  extendBelowToolbarPx?: number;
  /** When false, band stays invisible (ref still valid for layout if needed). */
  visible: boolean;
  hovered: boolean;
  /** When true, the well is clickable / keyboard-activatable (same as drag-drop to parent). */
  interactive: boolean;
  onActivate?: () => void;
};

/**
 * Centered dashed drop well at the top of the viewport. Ref sits on the well for hit-testing.
 */
export const ArchitecturalParentExitThreshold = forwardRef<
  HTMLDivElement,
  ArchitecturalParentExitThresholdProps
>(function ArchitecturalParentExitThreshold(props, ref) {
  const { visible, hovered, interactive, onActivate } = props;
  const runActivate = useCallback(() => {
    if (!(interactive && onActivate)) {
      return;
    }
    onActivate();
  }, [interactive, onActivate]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!interactive) {
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      runActivate();
    },
    [interactive, runActivate]
  );

  const wellClass = [
    styles.well,
    visible ? styles.wellVisible : "",
    hovered ? styles.wellHovered : "",
    interactive ? styles.wellInteractive : "",
    visible && !interactive ? styles.wellDisabled : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`${styles.rail} ${visible ? styles.railVisible : ""}`}>
      <div
        aria-label={
          interactive
            ? "Remove selection from this folder into the parent space"
            : "Drop zone: remove from folder into parent space"
        }
        className={wellClass}
        onClick={(event) => {
          if (!interactive) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          runActivate();
        }}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => {
          if (!interactive) {
            return;
          }
          event.stopPropagation();
        }}
        ref={ref}
        role={interactive ? "button" : "region"}
        tabIndex={interactive ? 0 : undefined}
      >
        <span className={styles.wellRow}>
          <TrayArrowUp
            aria-hidden
            className={styles.icon}
            size={15}
            weight="bold"
          />
          <span aria-hidden className={styles.label}>
            Remove from folder
          </span>
        </span>
      </div>
    </div>
  );
});
