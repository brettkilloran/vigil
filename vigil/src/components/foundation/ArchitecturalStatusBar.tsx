"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

export function ArchitecturalStatusBar({
  centerWorldX,
  centerWorldY,
  scale,
}: {
  centerWorldX: number;
  centerWorldY: number;
  scale: number;
}) {
  return (
    <div className={styles.statusWrap}>
      <div className={styles.glassPanel}>
        <div className={styles.statusLeft}>
          <div className={styles.pulseDot} />
          <span className={styles.monoTag}>ARCH_ENV</span>
        </div>
        <div className={styles.sep} />
        <div className={styles.monoSmall}>
          X:
          <span className={styles.metric}>{centerWorldX}</span> Y:
          <span className={styles.metric}>{centerWorldY}</span>
        </div>
        <div className={styles.sep} />
        <div className={styles.monoSmall}>
          <MagnifyingGlass size={12} />
          <span className={styles.metric}>{Math.round(scale * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
