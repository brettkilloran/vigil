"use client";

import { useCallback, useState } from "react";

import { Button } from "@/src/components/ui/Button";

import styles from "./VigilAppBootScreen.module.css";

export type VigilAppBootScreenProps = {
  /** Bootstrap + fonts / surface prep — enables Activate. */
  technicalReady: boolean;
  /** Fires on click (starts flow transition in parent); boot fade runs in parallel. */
  onActivate: () => void;
  /** After opacity exit animation (reduced motion: not used — parent may unmount immediately). */
  onExitComplete: () => void;
};

/**
 * “Click to enter” gate: ambient copy + **Activate**. Does not auto-dismiss when technical work finishes.
 */
export function VigilAppBootScreen({ technicalReady, onActivate, onExitComplete }: VigilAppBootScreenProps) {
  const [exiting, setExiting] = useState(false);

  const handleActivate = useCallback(() => {
    if (!technicalReady || exiting) return;
    onActivate();
    setExiting(true);
  }, [technicalReady, exiting, onActivate]);

  const onTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (!exiting || e.propertyName !== "opacity") return;
      onExitComplete();
    },
    [exiting, onExitComplete],
  );

  const year = new Date().getFullYear();

  return (
    <div
      className={`${styles.overlay} ${exiting ? styles.overlayExiting : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vigil-boot-title"
      aria-describedby="vigil-boot-desc"
      onTransitionEnd={onTransitionEnd}
    >
      <div className={`${styles.metaTop} ${styles.mono} ${styles.fadeIn}`} style={{ animationDelay: "0.35s" }}>
        <div>HEARTGARDEN.LOG // CANVAS_SYNC</div>
        <div>{technicalReady ? "READY · AWAITING ACTIVATION" : "GRAPH · FONTS · CAMERA"}</div>
      </div>

      <div className={styles.content}>
        <div className={`${styles.kicker} ${styles.mono} ${styles.fadeIn}`} style={{ animationDelay: "0.55s" }}>
          00 — INFINITE SURFACE
        </div>
        <h1 id="vigil-boot-title" className={`${styles.title} ${styles.fadeIn}`} style={{ animationDelay: "0.72s" }}>
          IDEAS
          <br />
          <span className={styles.titleItalic}>AS TERRAIN</span>
        </h1>
        <div className={`${styles.lineDecoration} ${styles.fadeIn}`} style={{ animationDelay: "0.92s" }} />
        <p id="vigil-boot-desc" className={`${styles.blurb} ${styles.fadeIn}`} style={{ animationDelay: "1.1s" }}>
          The canvas idles behind this plane—same dot field, same depth—as sync and type settle. When you are
          ready, activate; the flow runs once, then you are in.
        </p>
        <div className={`${styles.activateWrap} ${styles.fadeIn}`} style={{ animationDelay: "1.28s" }}>
          <Button
            type="button"
            variant="ghost"
            tone="menu"
            size="md"
            className={styles.activateBtn}
            disabled={!technicalReady || exiting}
            onClick={handleActivate}
          >
            Activate
          </Button>
          {!technicalReady ? (
            <p className={styles.waitHint} aria-live="polite">
              Preparing workspace…
            </p>
          ) : null}
        </div>
      </div>

      <div className={`${styles.metaBottom} ${styles.mono} ${styles.fadeIn}`} style={{ animationDelay: "1.4s" }}>
        <div className={styles.metaBottomLeft}>NONLINEAR WORKSPACE · PERSISTED GRAPH</div>
        <div>© {year} heartgarden</div>
      </div>
    </div>
  );
}
