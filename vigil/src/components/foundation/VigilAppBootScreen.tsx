"use client";

import { useCallback, useRef, useState, type PointerEvent } from "react";

import { Button } from "@/src/components/ui/Button";

import type { VigilBootFlowerGardenHandle } from "./VigilBootFlowerGarden";
import { VigilBootFlowerGarden } from "./VigilBootFlowerGarden";
import styles from "./VigilAppBootScreen.module.css";

export type VigilAppBootScreenProps = {
  /** Bootstrap + fonts / surface prep — enables the entry CTA. */
  technicalReady: boolean;
  /** Fires on click (starts flow transition in parent); boot fade runs in parallel. */
  onActivate: () => void;
  /** After opacity exit animation (reduced motion: not used — parent may unmount immediately). */
  onExitComplete: () => void;
};

/**
 * “Click to enter” gate: ambient copy + **Enter the garden.** Does not auto-dismiss when technical work finishes.
 */
export function VigilAppBootScreen({ technicalReady, onActivate, onExitComplete }: VigilAppBootScreenProps) {
  const [exiting, setExiting] = useState(false);
  const flowerGardenRef = useRef<VigilBootFlowerGardenHandle>(null);

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

  const onOverlayPointerDownCapture = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (exiting) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("[data-vigil-boot-activate]")) return;
    flowerGardenRef.current?.spawnAt(e.clientX, e.clientY);
  }, [exiting]);

  return (
    <div
      className={`${styles.overlay} ${exiting ? styles.overlayExiting : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vigil-boot-title"
      aria-describedby="vigil-boot-desc"
      onPointerDownCapture={onOverlayPointerDownCapture}
      onTransitionEnd={onTransitionEnd}
    >
      <VigilBootFlowerGarden ref={flowerGardenRef} active={!exiting} />
      <div className={`${styles.metaTop} ${styles.mono} ${styles.fadeIn}`} style={{ animationDelay: "0.35s" }}>
        <div>HEARTGARDEN.LOG // CANVAS_SYNC</div>
        <div>{technicalReady ? "READY · AWAITING ENTRY" : "GRAPH · FONTS · CAMERA"}</div>
      </div>

      <div className={styles.content}>
        <div className={`${styles.kicker} ${styles.mono} ${styles.fadeIn}`} style={{ animationDelay: "0.55s" }}>
          HEARTGARDEN
        </div>
        <h1
          id="vigil-boot-title"
          lang="ja"
          className={`${styles.title} ${styles.titleCjk} ${styles.fadeIn}`}
          style={{ animationDelay: "0.72s" }}
        >
          波途画電
        </h1>
        <div className={`${styles.lineDecoration} ${styles.fadeIn}`} style={{ animationDelay: "0.92s" }} />
        <div
          id="vigil-boot-desc"
          className={`${styles.blurbWrap} ${styles.fadeIn}`}
          style={{ animationDelay: "1.1s" }}
        >
          <p className={styles.blurb}>
            An infinite, living archive of Caliginia’s thermal shadows—a permanent negative stained upon the
            retina. The eyelid is gone; shutter jammed open.
          </p>
          <p className={styles.blurb}>
            Yet no light enters the panopticon. Just flowers, blooming in the vitreous dark.
          </p>
        </div>
        <div
          className={`${styles.activateWrap} ${styles.fadeIn}`}
          style={{ animationDelay: "1.28s" }}
          data-vigil-boot-activate="true"
        >
          <Button
            type="button"
            variant="ghost"
            tone="menu"
            size="md"
            className={`${styles.activateBtn} ${styles.activateBtnSentence}`}
            disabled={!technicalReady || exiting}
            onClick={handleActivate}
          >
            Enter the garden.
          </Button>
          {!technicalReady ? (
            <p className={styles.waitHint} aria-live="polite">
              Preparing workspace…
            </p>
          ) : null}
        </div>
      </div>

      <div className={`${styles.metaBottom} ${styles.mono} ${styles.fadeIn}`} style={{ animationDelay: "1.4s" }}>
        <div className={styles.metaBottomLeft}>CALIGINIA INDEX · PERSISTED GRAPH</div>
        <div>© {year} heartgarden</div>
      </div>
    </div>
  );
}
