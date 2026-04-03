"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

export function ArchitecturalStatusBadge({
  showPulse = true,
  label = "ARCH_ENV",
}: {
  showPulse?: boolean;
  label?: string;
}) {
  return (
    <div className={styles.statusLeft}>
      {showPulse ? <div className={styles.pulseDot} /> : null}
      <span className={styles.monoTag}>{label}</span>
    </div>
  );
}

export function ArchitecturalStatusMetric({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.monoSmall}>
      {icon}
      {children}
    </div>
  );
}

export function ArchitecturalStatusBar({
  centerWorldX,
  centerWorldY,
  scale,
  envLabel = "ARCH_ENV",
  showPulse = true,
  zoomPrefixIcon = true,
}: {
  centerWorldX: number;
  centerWorldY: number;
  scale: number;
  envLabel?: string;
  showPulse?: boolean;
  zoomPrefixIcon?: boolean;
}) {
  return (
    <div className={styles.statusWrap}>
      <div className={styles.glassPanel}>
        <ArchitecturalStatusBadge showPulse={showPulse} label={envLabel} />
        <div className={styles.sep} />
        <ArchitecturalStatusMetric>
          X:
          <span className={styles.metric}>{centerWorldX}</span> Y:
          <span className={styles.metric}>{centerWorldY}</span>
        </ArchitecturalStatusMetric>
        <div className={styles.sep} />
        <ArchitecturalStatusMetric
          icon={zoomPrefixIcon ? <MagnifyingGlass size={12} /> : undefined}
        >
          <span className={styles.metric}>{Math.round(scale * 100)}%</span>
        </ArchitecturalStatusMetric>
      </div>
    </div>
  );
}
