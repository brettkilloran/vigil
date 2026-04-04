"use client";

import { MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { Button } from "@/src/components/ui/Button";
import { cx } from "@/src/lib/cx";
import {
  formatSavedRelative,
  getNeonSyncServerSnapshot,
  getNeonSyncSnapshot,
  subscribeNeonSync,
} from "@/src/lib/neon-sync-bus";

export function ArchitecturalStatusBadge({
  showPulse = true,
  label = "波途画電",
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

const POPOVER_ESTIMATE_H = 460;
const POPOVER_W = 328;
const POPOVER_GAP = 8;

function SaveAndVersionPopover({
  envLabel,
  showPulse = true,
  bootstrapPending,
  onExportGraphJson,
  exportGraphPaletteHint,
}: {
  envLabel: string;
  showPulse?: boolean;
  bootstrapPending: boolean;
  onExportGraphJson?: () => void;
  exportGraphPaletteHint?: string;
}) {
  const sync = useSyncExternalStore(
    subscribeNeonSync,
    getNeonSyncSnapshot,
    getNeonSyncServerSnapshot,
  );
  const busy = sync.cloudEnabled && (sync.pending > 0 || sync.inFlight > 0);

  const {
    pulseToneClass,
    tooltipTitle,
    statusLine,
    showWarningIcon,
    detailTitle,
    detailBody,
    liveAnnouncement,
    triggerAriaLabel,
    relSaved,
    absSaved,
  } = useMemo(() => {
    const rel = formatSavedRelative(sync.lastSavedAt);
    const abs =
      sync.lastSavedAt != null
        ? new Date(sync.lastSavedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : null;

    let pulseToneClass = styles.pulseDotToneLocal;
    let tooltipTitle = "";
    let statusLine = "";
    let showWarningIcon = false;
    let detailTitle = "Local session";
    let detailBody =
      "Not connected to Neon — demo seed or no database. Changes stay in this session. Use Export graph JSON below for a file checkpoint.";

    if (bootstrapPending) {
      pulseToneClass = styles.pulseDotToneLoading;
      tooltipTitle =
        "Loading your workspace from the server. Sync status is unknown until loading finishes. Click for details.";
      statusLine = "Loading workspace…";
      detailTitle = "Loading workspace";
      detailBody = "Resolving demo vs Neon and hydrating the canvas…";
    } else if (!sync.cloudEnabled) {
      pulseToneClass = styles.pulseDotToneLocal;
      tooltipTitle =
        "Not connected to Neon — this session is local only. Nothing is written to a remote database. Click for export-based version history and full notes.";
      statusLine = "Local only · not connected";
    } else if (sync.lastError) {
      pulseToneClass = styles.pulseDotToneError;
      showWarningIcon = true;
      const err = sync.lastError.trim();
      const short = err.length > 44 ? `${err.slice(0, 42)}…` : err;
      tooltipTitle = `Database save error: ${err} Edits stay on the canvas until the next successful save. Undo does not revert the server. Click for details.`;
      statusLine = short;
      detailTitle = "Sync error";
      detailBody = `${sync.lastError} Edits stay local until the next successful save. Undo/redo only affects the canvas in memory, not the database.`;
    } else if (busy) {
      pulseToneClass = styles.pulseDotToneSaving;
      tooltipTitle =
        "Saving to Neon (including debounced note edits). Safe to keep editing — undo applies to the canvas in memory while writes complete. Click for details.";
      statusLine = "Saving…";
      detailTitle = "Writing to Neon";
      detailBody =
        "Saving changes (including debounced note edits). Undo restores local canvas state; Neon keeps the last successful write until you edit again.";
    } else {
      pulseToneClass = styles.pulseDotToneOk;
      tooltipTitle = rel
        ? `Last successful write to Neon: ${rel}. All pending changes are saved. Undo does not revert the database — click for full sync notes and version history.`
        : "Connected to Neon. Click for sync details, pending write counts, and export-based version history.";
      statusLine = rel ? `Saved · ${rel}` : "Synced with Neon";
      detailTitle = "Synced with Neon";
      detailBody =
        "All pending changes are written to Neon. Undo/redo changes the canvas in memory only — it does not revert the server. Edit again to push a new save.";
    }

    const live = bootstrapPending
      ? "Loading workspace"
      : !sync.cloudEnabled
        ? "Local session, not connected to Neon"
        : sync.lastError
          ? `Sync error: ${sync.lastError}`
          : busy
            ? "Saving to Neon"
            : rel
              ? `Saved to Neon ${rel}`
              : "Saved to Neon";

    const aria = `Save and database: ${statusLine}. Open menu for details, export, and version history.`;

    return {
      pulseToneClass,
      tooltipTitle,
      statusLine,
      showWarningIcon,
      detailTitle,
      detailBody,
      liveAnnouncement: live,
      triggerAriaLabel: aria,
      relSaved: rel,
      absSaved: abs,
    };
  }, [bootstrapPending, busy, sync.cloudEnabled, sync.lastError, sync.lastSavedAt]);

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; flip: boolean }>({
    top: 0,
    left: 0,
    flip: false,
  });

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelH = panelRef.current?.offsetHeight ?? POPOVER_ESTIMATE_H;
    const spaceBelow = vh - rect.bottom - POPOVER_GAP;
    const flip =
      spaceBelow < panelH + POPOVER_GAP && rect.top > panelH + POPOVER_GAP * 2;
    let top = flip ? rect.top - POPOVER_GAP - panelH : rect.bottom + POPOVER_GAP;
    const minTop = 8;
    const maxTop = Math.max(minTop, vh - panelH - 8);
    if (top < minTop) top = minTop;
    else if (top > maxTop) top = maxTop;
    let left = rect.left;
    const maxLeft = vw - POPOVER_W - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    if (left < 8) left = 8;
    setPanelPos({ top, left, flip });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => reposition());
    return () => cancelAnimationFrame(id);
  }, [open, reposition, showWarningIcon]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => reposition();
    const onResize = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const handleExport = () => {
    onExportGraphJson?.();
    setOpen(false);
  };

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={popoverId}
            className={styles.syncPopover}
            style={{ top: panelPos.top, left: panelPos.left }}
            role="dialog"
            aria-labelledby={`${popoverId}-title`}
          >
            <div id={`${popoverId}-title`} className={styles.syncPopoverTitle}>
              {detailTitle}
            </div>
            <div className={styles.syncPopoverStatusLine}>{statusLine}</div>
            <p className={styles.syncPopoverBody}>{detailBody}</p>
            {sync.cloudEnabled && !bootstrapPending ? (
              <div className={styles.syncPopoverMeta}>
                {absSaved ? (
                  <div className={styles.syncPopoverMetaRow}>
                    <span className={styles.syncPopoverMetaKey}>Last successful write</span>
                    <span className={styles.syncPopoverMetaValueLine}>
                      <span className={styles.syncPopoverMetaVal}>{absSaved}</span>
                      {relSaved ? (
                        <span className={styles.syncPopoverMetaRel}>· {relSaved}</span>
                      ) : null}
                    </span>
                  </div>
                ) : null}
                <div className={styles.syncPopoverMetaRow}>
                  <span className={styles.syncPopoverMetaKey}>Pending debounced saves</span>
                  <span className={styles.syncPopoverMetaVal}>{sync.pending}</span>
                </div>
                <div className={styles.syncPopoverMetaRow}>
                  <span className={styles.syncPopoverMetaKey}>In-flight requests</span>
                  <span className={styles.syncPopoverMetaVal}>{sync.inFlight}</span>
                </div>
              </div>
            ) : null}

            <div className={styles.syncPopoverSection}>
              <div className={styles.syncPopoverSectionLabel}>Version history</div>
              <p className={styles.syncPopoverSectionBody}>
                Checkpoints are export-based for now: download the full graph JSON, keep it in git or
                backups. In-app restore from snapshots is not wired yet — use exports as your audit
                trail.
              </p>
              {onExportGraphJson ? (
                <Button
                  type="button"
                  size="md"
                  variant="primary"
                  tone="solid"
                  className={styles.syncPopoverExport}
                  onClick={handleExport}
                >
                  Export graph JSON
                </Button>
              ) : null}
              {exportGraphPaletteHint ? (
                <p className={styles.syncPopoverHint}>
                  Also in palette: {exportGraphPaletteHint}
                </p>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </span>
      <Button
        ref={triggerRef}
        variant="neutral"
        size="sm"
        tone="glass"
        className={styles.statusSaveBarTrigger}
        title={tooltipTitle}
        aria-label={triggerAriaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {showPulse ? (
          <span className={cx(styles.pulseDot, pulseToneClass)} aria-hidden />
        ) : null}
        <span className={styles.monoTag} lang="ja">
          {envLabel}
        </span>
        {showWarningIcon ? (
          <WarningCircle className={styles.statusSaveWarningIcon} size={16} weight="bold" aria-hidden />
        ) : null}
      </Button>
      {panel}
    </>
  );
}

/** Bottom-left: minimal switch for canvas transitions + ambient detail vs lean mode. */
export function ArchitecturalCanvasEffectsToggle({
  effectsEnabled,
  onToggle,
}: {
  effectsEnabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={styles.focusEffectsStrip} data-hg-chrome="canvas-effects-toggle">
      <div className={`${styles.rootDockPanel} ${styles.focusEffectsPanel}`}>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          tone="glass"
          className={styles.effectsSwitch}
          role="switch"
          aria-checked={effectsEnabled}
          aria-label={
            effectsEnabled
              ? "Canvas effects on; turn off for lean mode"
              : "Canvas effects off; turn on for transitions and ambient detail"
          }
          title={
            effectsEnabled
              ? "Turn off flow transitions, vignette, and ambient grid"
              : "Restore transitions and ambient chrome"
          }
          data-on={effectsEnabled ? "true" : "false"}
          onClick={() => onToggle()}
        >
          <span className={styles.effectsSwitchTrack}>
            <span className={styles.effectsSwitchThumb} aria-hidden />
          </span>
        </Button>
      </div>
    </div>
  );
}

/** Bottom-right glass chip: world XY + zoom; right edge pinned, grows left as values change; matches dock bottom + tool-rail strip height. */
export function ArchitecturalViewportMetrics({
  centerWorldX,
  centerWorldY,
  scale,
  zoomPrefixIcon = true,
}: {
  centerWorldX: number;
  centerWorldY: number;
  scale: number;
  zoomPrefixIcon?: boolean;
}) {
  return (
    <div
      className={styles.viewportMetricsStrip}
      data-hg-chrome="viewport-metrics"
      aria-label="Viewport position and zoom"
    >
      <div className={`${styles.rootDockPanel} ${styles.viewportMetricsPanel}`}>
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

export function ArchitecturalStatusBar({
  envLabel = "波途画電",
  showPulse = true,
  syncBootstrapPending = false,
  onExportGraphJson,
  exportGraphPaletteHint,
}: {
  envLabel?: string;
  showPulse?: boolean;
  /** True while default-scenario bootstrap is in flight (before we know demo vs Neon). */
  syncBootstrapPending?: boolean;
  onExportGraphJson?: () => void;
  exportGraphPaletteHint?: string;
}) {
  return (
    <div className={styles.statusBarSegment} data-hg-chrome="canvas-status">
      <div className={`${styles.glassPanel} ${styles.shellTopChromePanel}`}>
        <SaveAndVersionPopover
          envLabel={envLabel}
          showPulse={showPulse}
          bootstrapPending={syncBootstrapPending}
          onExportGraphJson={onExportGraphJson}
          exportGraphPaletteHint={exportGraphPaletteHint}
        />
      </div>
    </div>
  );
}
