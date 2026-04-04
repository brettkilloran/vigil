"use client";

import {
  CircleNotch,
  Cloud,
  CloudSlash,
  MagnifyingGlass,
  WarningCircle,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import {
  formatSavedRelative,
  getNeonSyncServerSnapshot,
  getNeonSyncSnapshot,
  subscribeNeonSync,
} from "@/src/lib/neon-sync-bus";

export function ArchitecturalStatusBadge({
  showPulse = true,
  label = "heartgarden",
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

function NeonSyncLine({ bootstrapPending }: { bootstrapPending: boolean }) {
  const sync = useSyncExternalStore(
    subscribeNeonSync,
    getNeonSyncSnapshot,
    getNeonSyncServerSnapshot,
  );
  const busy = sync.cloudEnabled && (sync.pending > 0 || sync.inFlight > 0);

  let label = "Local";
  let title =
    "Not connected to Neon — demo seed or no database. Changes stay in this session. Export JSON to keep a copy.";
  let className = styles.syncMuted;
  let icon: ReactNode = <CloudSlash className="size-3.5 shrink-0 opacity-70" weight="bold" aria-hidden />;

  if (bootstrapPending) {
    label = "Loading…";
    title = "Loading workspace from the server…";
    className = styles.syncMuted;
    icon = (
      <CircleNotch
        className={`size-3.5 shrink-0 opacity-70 ${styles.syncSpin}`}
        weight="bold"
        aria-hidden
      />
    );
  } else if (sync.cloudEnabled) {
    if (sync.lastError) {
      label = "Sync error";
      title = `${sync.lastError} — edits are local until the next successful save. Undo/redo still applies to the canvas only.`;
      className = styles.syncError;
      icon = <WarningCircle className="size-3.5 shrink-0" weight="bold" aria-hidden />;
    } else if (busy) {
      label = "Saving…";
      title =
        "Writing to Neon (includes debounced note edits). Undo restores local state; the database keeps the last successful write until you edit again.";
      className = styles.syncMuted;
      icon = (
        <CircleNotch
          className={`size-3.5 shrink-0 opacity-80 ${styles.syncSpin}`}
          weight="bold"
          aria-hidden
        />
      );
    } else {
      const rel = formatSavedRelative(sync.lastSavedAt);
      label = rel ? `Saved · ${rel}` : "Saved";
      title =
        "All pending changes are written to Neon. Undo/redo changes the canvas in memory; it does not automatically revert the server — save again after editing to re-sync.";
      className = styles.syncOk;
      icon = <Cloud className="size-3.5 shrink-0 opacity-90" weight="bold" aria-hidden />;
    }
  }

  return (
    <div
      className={`${styles.monoSmall} ${styles.syncMetric}`}
      title={title}
      aria-live="polite"
      aria-atomic="true"
    >
      {icon}
      <span className={`${styles.syncLabel} ${className}`}>{label}</span>
    </div>
  );
}

export function ArchitecturalStatusBar({
  centerWorldX,
  centerWorldY,
  scale,
  envLabel = "heartgarden",
  showPulse = true,
  zoomPrefixIcon = true,
  syncBootstrapPending = false,
}: {
  centerWorldX: number;
  centerWorldY: number;
  scale: number;
  envLabel?: string;
  showPulse?: boolean;
  zoomPrefixIcon?: boolean;
  /** True while default-scenario bootstrap is in flight (before we know demo vs Neon). */
  syncBootstrapPending?: boolean;
}) {
  return (
    <div className={styles.statusBarSegment}>
      <div className={`${styles.glassPanel} ${styles.shellTopChromePanel}`}>
        <ArchitecturalStatusBadge showPulse={showPulse} label={envLabel} />
        <div className={styles.sep} />
        <NeonSyncLine bootstrapPending={syncBootstrapPending} />
        <div className={styles.sep} />
        <ArchitecturalStatusMetric>
          X:
          <span className={styles.metric}>{centerWorldX}</span> Y:
          <span className={styles.metric}>{centerWorldY}</span>
        </ArchitecturalStatusMetric>
        <div className={styles.sep} />
        <ArchitecturalStatusMetric
          icon={zoomPrefixIcon ? <MagnifyingGlass size={12} aria-hidden /> : undefined}
        >
          <span className={styles.metric}>{Math.round(scale * 100)}%</span>
        </ArchitecturalStatusMetric>
      </div>
    </div>
  );
}
