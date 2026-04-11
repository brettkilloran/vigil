"use client";

import { CircleNotch, MagnifyingGlass, PictureInPicture, Waves, WarningCircle } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import {
  ArchitecturalTooltip,
  ARCH_TOOLTIP_AVOID_BOTTOM,
} from "@/src/components/foundation/ArchitecturalTooltip";
import { Button } from "@/src/components/ui/Button";
import { cx } from "@/src/lib/cx";
import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";
import {
  formatSavedRelative,
  getNeonSyncServerSnapshot,
  getNeonSyncSnapshot,
  subscribeNeonSync,
} from "@/src/lib/neon-sync-bus";
import {
  getVaultIndexStatusSnapshot,
  subscribeVaultIndexStatus,
} from "@/src/lib/vault-index-status-bus";
import {
  SYNC_ERROR_DIAGNOSTIC_SEP,
  syncErrorSummaryLine,
} from "@/src/lib/sync-error-diagnostic";
import { playVigilUiSound } from "@/src/lib/vigil-ui-sounds";

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
/** Gap below the frosted chrome strip (not the inner button box). */
const POPOVER_GAP = 4;
/** Nudge popover left of trigger alignment (viewport clamp still applies). */
const POPOVER_SHIFT_LEFT = 6;
/** Extra vertical offset after anchor-based placement (viewport clamp still applies). */
const POPOVER_SHIFT_DOWN = 4;

function SaveAndVersionPopover({
  popoverAnchorRef,
  envLabel,
  sessionLabel,
  sourceLabel,
  spaceLabel,
  strictSync,
  showPulse = true,
  awaitingBootAuth = false,
  bootstrapPending,
  showingCachedWorkspace = false,
  offlineNoSnapshot = false,
  onExportGraphJson,
  exportGraphPaletteHint,
}: {
  /** Bottom edge of this element (status glass strip) aligns the popover; trigger ref still sets horizontal origin. */
  popoverAnchorRef: RefObject<HTMLDivElement | null>;
  envLabel: string;
  sessionLabel?: string;
  sourceLabel?: string;
  spaceLabel?: string;
  strictSync?: boolean;
  showPulse?: boolean;
  /** Boot PIN gate is on and this browser has not completed sign-in — not a database outage. */
  awaitingBootAuth?: boolean;
  bootstrapPending: boolean;
  /** Live Neon unavailable; UI is the last successful snapshot from this browser. */
  showingCachedWorkspace?: boolean;
  /** Could not reach DB and there is no local snapshot yet (setup / network). */
  offlineNoSnapshot?: boolean;
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
    statusLine,
    statusSeverity,
    showWarningIcon,
    detailTitle,
    detailBody,
    detailPasteText,
    recommendedAction,
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
    let statusLine = "";
    let statusSeverity: "ok" | "warn" | "error" | "loading" = "warn";
    let showWarningIcon = false;
    let detailTitle = "Local session";
    /** Full multi-line diagnostic when present (structured sync errors). */
    let detailPasteText: string | null = null;
    let detailBody =
      "Not connected to Neon — no database URL or bootstrap failed. Changes stay in this session. Use Export graph JSON below for a file checkpoint.";
    let recommendedAction =
      "Verify database env vars, reload, then use Copy support snapshot if this persists.";

    if (awaitingBootAuth) {
      pulseToneClass = styles.pulseDotToneLocal;
      statusLine = "Awaiting sign-in";
      statusSeverity = "warn";
      detailTitle = "No active session";
      detailBody =
        "Save and sync information applies only after you authenticate. Continue from the welcome screen, then enter your access code when the gate requests it. Until a session is established, the workspace does not load from the server and this panel does not reflect database state.";
      recommendedAction = "Complete sign-in from the welcome screen.";
    } else if (bootstrapPending) {
      pulseToneClass = styles.pulseDotToneLoading;
      statusLine = "Loading workspace…";
      statusSeverity = "loading";
      detailTitle = "Loading workspace";
      detailBody = "Resolving demo vs Neon and hydrating the canvas…";
      recommendedAction = "Wait for bootstrap to finish.";
    } else if (offlineNoSnapshot) {
      pulseToneClass = styles.pulseDotToneLocal;
      statusLine = "Database not reachable";
      statusSeverity = "error";
      detailTitle = "Workspace not loaded";
      detailBody =
        "Heartgarden could not open a database-backed workspace from this session, and this browser does not have a prior snapshot yet. Configure NEON_DATABASE_URL, fix network access, and reload. Once you load successfully, we cache a view so brief outages still look like your garden.";
      recommendedAction =
        "Check Neon/database connectivity, then reload. No cached workspace is available yet.";
    } else if (!sync.cloudEnabled && showingCachedWorkspace) {
      pulseToneClass = styles.pulseDotToneSaving;
      statusLine = "Offline · showing saved view";
      statusSeverity = "warn";
      detailTitle = "Cached workspace";
      detailBody =
        "You are seeing the last workspace snapshot stored in this browser. We retry automatically and when the network comes back. New changes are kept on this device until Neon is reachable again.";
      recommendedAction =
        "Keep working locally or reconnect network/DB; the app will auto-resync when Neon is reachable.";
    } else if (!sync.cloudEnabled) {
      pulseToneClass = styles.pulseDotToneLocal;
      statusLine = "Local only · not connected";
      statusSeverity = "warn";
      recommendedAction = "Connect a database-backed workspace to enable sync.";
    } else if (sync.lastError) {
      pulseToneClass = styles.pulseDotToneError;
      statusSeverity = "error";
      showWarningIcon = true;
      const err = sync.lastError.trim();
      statusLine = syncErrorSummaryLine(err);
      detailTitle = "Sync error";
      if (err.includes(SYNC_ERROR_DIAGNOSTIC_SEP)) {
        detailPasteText = err;
        detailBody =
          "Edits stay local until the next successful save. Undo/redo only affects the canvas in memory, not the database. Use Copy support snapshot when asking for help — it includes request, HTTP status, and response snippet context.";
      } else {
        detailBody = `${sync.lastError} Edits stay local until the next successful save. Undo/redo only affects the canvas in memory, not the database.`;
      }
      recommendedAction =
        "Use Copy support snapshot and retry an edit/save; if the error repeats, share the snapshot.";
    } else if (busy) {
      pulseToneClass = styles.pulseDotToneSaving;
      statusLine = "Saving…";
      statusSeverity = "loading";
      detailTitle = "Writing to Neon";
      detailBody =
        "Saving changes (including debounced note edits). Undo restores local canvas state; Neon keeps the last successful write until you edit again.";
      recommendedAction = "Wait for writes to settle before large navigation or refresh.";
    } else {
      pulseToneClass = styles.pulseDotToneOk;
      statusLine = rel ? `Saved · ${rel}` : "Synced with Neon";
      statusSeverity = "ok";
      detailTitle = "Synced with Neon";
      detailBody =
        "All pending changes are written to Neon. Undo/redo changes the canvas in memory only — it does not revert the server. Edit again to push a new save.";
      recommendedAction = "No action needed.";
    }

    const live = awaitingBootAuth
      ? "Awaiting sign-in; authenticate from the welcome screen to load the workspace"
      : bootstrapPending
        ? "Loading workspace"
        : offlineNoSnapshot
          ? "Workspace could not load; database not reachable"
          : !sync.cloudEnabled && showingCachedWorkspace
            ? "Offline, showing cached workspace from this browser"
            : !sync.cloudEnabled
              ? "Local session, not connected to Neon"
              : sync.lastError
              ? `Sync error: ${syncErrorSummaryLine(sync.lastError)}`
              : busy
                ? "Saving to Neon"
                : rel
                  ? `Saved to Neon ${rel}`
                  : "Saved to Neon";

    const aria = awaitingBootAuth
      ? `Connection status: ${statusLine}. Open the menu for details. A valid session is required before workspace data loads.`
      : `Save and database: ${statusLine}. Open menu for details, export, and version history.${
          sync.cloudEnabled && sync.lastError?.trim()
            ? " Bottom toolbar create buttons are disabled until the next successful save."
            : ""
        }`;

    return {
      pulseToneClass,
      statusLine,
      statusSeverity,
      showWarningIcon,
      detailTitle,
      detailBody,
      detailPasteText,
      recommendedAction,
      liveAnnouncement: live,
      triggerAriaLabel: aria,
      relSaved: rel,
      absSaved: abs,
    };
  }, [
    awaitingBootAuth,
    bootstrapPending,
    busy,
    offlineNoSnapshot,
    showingCachedWorkspace,
    sync.cloudEnabled,
    sync.lastError,
    sync.lastSavedAt,
  ]);

  const [open, setOpen] = useState(false);
  const [copySnapshotHint, setCopySnapshotHint] = useState<"idle" | "copied" | "failed">("idle");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  const [panelPos, setPanelPos] = useState<{ top: number; left: number; flip: boolean }>({
    top: 0,
    left: 0,
    flip: false,
  });

  const reposition = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;
    const triggerRect = triggerEl.getBoundingClientRect();
    const anchorEl = popoverAnchorRef.current;
    const anchorRect = anchorEl?.getBoundingClientRect() ?? triggerRect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelH = panelRef.current?.offsetHeight ?? POPOVER_ESTIMATE_H;
    const spaceBelow = vh - anchorRect.bottom - POPOVER_GAP;
    const flip =
      spaceBelow < panelH + POPOVER_GAP * 2 &&
      anchorRect.top > panelH + POPOVER_GAP * 2;
    let top = flip
      ? anchorRect.top - POPOVER_GAP - panelH
      : anchorRect.bottom + POPOVER_GAP;
    top += POPOVER_SHIFT_DOWN;
    const minTop = 8;
    const maxTop = Math.max(minTop, vh - panelH - 8);
    if (top < minTop) top = minTop;
    else if (top > maxTop) top = maxTop;
    let left = triggerRect.left - POPOVER_SHIFT_LEFT;
    const maxLeft = vw - POPOVER_W - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    if (left < 8) left = 8;
    setPanelPos({ top, left, flip });
  }, [popoverAnchorRef]);

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

  const closeSyncPopover = useCallback(() => {
    setCopySnapshotHint("idle");
    setOpen(false);
  }, []);

  const supportSnapshotText = useMemo(() => {
    const lines: string[] = [];
    lines.push("Heartgarden sync snapshot");
    lines.push(`Status: ${statusLine}`);
    lines.push(`Detail: ${detailTitle}`);
    lines.push(`Cloud enabled: ${sync.cloudEnabled ? "yes" : "no"}`);
    lines.push(`Pending writes: ${sync.pending}`);
    lines.push(`In-flight requests: ${sync.inFlight}`);
    lines.push(`Awaiting boot auth: ${awaitingBootAuth ? "yes" : "no"}`);
    lines.push(`Bootstrap pending: ${bootstrapPending ? "yes" : "no"}`);
    lines.push(`Cached workspace view: ${showingCachedWorkspace ? "yes" : "no"}`);
    lines.push(`Offline no snapshot: ${offlineNoSnapshot ? "yes" : "no"}`);
    if (sessionLabel) lines.push(`Session: ${sessionLabel}`);
    if (sourceLabel) lines.push(`Source: ${sourceLabel}`);
    if (spaceLabel) lines.push(`Space: ${spaceLabel}`);
    if (strictSync) lines.push("Strict GM sync: yes");
    if (absSaved) lines.push(`Last successful write: ${absSaved}`);
    if (relSaved) lines.push(`Last write relative: ${relSaved}`);
    lines.push(`Recommended next step: ${recommendedAction}`);
    const rawError = sync.lastError?.trim() ?? "";
    const structuredDiagnostic = detailPasteText?.trim() ?? "";
    if (sync.lastError?.trim()) {
      lines.push("");
      lines.push("Sync error:");
      lines.push(rawError);
    }
    if (structuredDiagnostic && structuredDiagnostic !== rawError) {
      lines.push("");
      lines.push("Structured diagnostic:");
      lines.push(structuredDiagnostic);
    }
    return lines.join("\n");
  }, [
    statusLine,
    detailTitle,
    sync.cloudEnabled,
    sync.pending,
    sync.inFlight,
    sync.lastError,
    awaitingBootAuth,
    bootstrapPending,
    showingCachedWorkspace,
    offlineNoSnapshot,
    sessionLabel,
    sourceLabel,
    spaceLabel,
    strictSync,
    absSaved,
    relSaved,
    recommendedAction,
    detailPasteText,
  ]);

  const copySupportSnapshot = useCallback(() => {
    const text = supportSnapshotText.trim();
    if (!text) return;
    void navigator.clipboard.writeText(text).then(
      () => {
        playVigilUiSound("tap");
        setCopySnapshotHint("copied");
        window.setTimeout(() => setCopySnapshotHint("idle"), 2200);
      },
      () => setCopySnapshotHint("failed"),
    );
  }, [supportSnapshotText]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSyncPopover();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeSyncPopover]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      closeSyncPopover();
    };
    /* Capture: dismiss before canvas / shell bubble handlers; inside-panel hits still target descendants first. */
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, closeSyncPopover]);

  const handleExport = () => {
    playVigilUiSound("button");
    onExportGraphJson?.();
    closeSyncPopover();
  };

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={popoverId}
            data-hg-sync-popover="true"
            className={styles.syncPopover}
            style={{ top: panelPos.top, left: panelPos.left }}
            role="dialog"
            aria-labelledby={`${popoverId}-title`}
            /* Block bubble to document — canvas + other shell listeners must not eat clicks / break copy. */
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div id={`${popoverId}-title`} className={styles.syncPopoverTitle}>
              {detailTitle}
            </div>
            <div className={styles.syncPopoverStatusLineWrap}>
              <span
                className={`${styles.syncPopoverSeverity} ${
                  statusSeverity === "ok"
                    ? styles.syncPopoverSeverityOk
                    : statusSeverity === "error"
                      ? styles.syncPopoverSeverityError
                      : statusSeverity === "loading"
                        ? styles.syncPopoverSeverityLoading
                        : styles.syncPopoverSeverityWarn
                }`}
              >
                {statusSeverity === "ok"
                  ? "Healthy"
                  : statusSeverity === "error"
                    ? "Error"
                    : statusSeverity === "loading"
                      ? "Active"
                      : "Attention"}
              </span>
              <span className={styles.syncPopoverStatusLine}>{statusLine}</span>
            </div>
            <p className={styles.syncPopoverBody}>{detailBody}</p>
            <p className={styles.syncPopoverAction}>{recommendedAction}</p>
            {sessionLabel || sourceLabel || spaceLabel ? (
              <div className={styles.syncPopoverContext}>
                {sessionLabel ? (
                  <div className={styles.syncPopoverContextRow}>
                    <span className={styles.syncPopoverContextKey}>Session</span>
                    <span className={styles.syncPopoverContextVal}>{sessionLabel}</span>
                  </div>
                ) : null}
                {sourceLabel ? (
                  <div className={styles.syncPopoverContextRow}>
                    <span className={styles.syncPopoverContextKey}>Source</span>
                    <span className={styles.syncPopoverContextVal}>{sourceLabel}</span>
                  </div>
                ) : null}
                {spaceLabel ? (
                  <div className={styles.syncPopoverContextRow}>
                    <span className={styles.syncPopoverContextKey}>Space</span>
                    <span className={styles.syncPopoverContextVal}>{spaceLabel}</span>
                  </div>
                ) : null}
                {strictSync ? (
                  <div className={styles.syncPopoverContextBadge}>Strict GM sync</div>
                ) : null}
              </div>
            ) : null}
            <div className={styles.syncPopoverQuickActions}>
              <Button
                type="button"
                size="md"
                variant="neutral"
                tone="focus-light"
                className={styles.syncPopoverCopySnapshot}
                onClick={copySupportSnapshot}
              >
                {copySnapshotHint === "copied"
                  ? "Snapshot copied"
                  : copySnapshotHint === "failed"
                    ? "Copy failed"
                    : "Copy support snapshot"}
              </Button>
            </div>
            {sync.lastError ? (
              <div className={styles.syncPopoverCopyRow}>
                {detailPasteText ? (
                  <pre className={styles.syncPopoverDiagnostic} tabIndex={0}>
                    {detailPasteText}
                  </pre>
                ) : null}
              </div>
            ) : null}
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
                  variant="neutral"
                  tone="focus-light"
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
          getVigilPortalRoot(),
        )
      : null;

  return (
    <div className={styles.statusBarSaveCluster}>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </span>
      <Button
        ref={triggerRef}
        variant="neutral"
        size="sm"
        tone="glass"
        className={styles.statusSaveBarTrigger}
        aria-label={triggerAriaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          setCopySnapshotHint("idle");
          setOpen((v) => !v);
        }}
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
    </div>
  );
}

/** Bottom-left: toggle canvas transitions + ambient detail vs lean mode (icon button). */
export function ArchitecturalCanvasEffectsToggle({
  effectsEnabled,
  onEffectsEnabledChange,
  layout = "fixed",
  trailingSlot,
}: {
  effectsEnabled: boolean;
  /** Must be stable (e.g. `setState` from `useState`) — keep callback identity steady under React 19. */
  onEffectsEnabledChange: (next: boolean) => void;
  /** `fixed` = bottom-left chrome anchor; `inline` = in-flow strip; `bare` = button only (e.g. shared boot dock panel). */
  layout?: "fixed" | "inline" | "bare";
  /** Extra controls in the same glass strip (e.g. app-wide audio mute). `fixed` layout only. */
  trailingSlot?: ReactNode;
}) {
  const checked = Boolean(effectsEnabled);

  const checkedRef = useRef(checked);
  const onEffectsEnabledChangeRef = useRef(onEffectsEnabledChange);

  useLayoutEffect(() => {
    checkedRef.current = checked;
    onEffectsEnabledChangeRef.current = onEffectsEnabledChange;
  }, [checked, onEffectsEnabledChange]);

  const onButtonClick = useCallback((e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onEffectsEnabledChangeRef.current(!checkedRef.current);
  }, []);

  const ariaLabel = checked
    ? "Canvas effects on; turn off for lean mode"
    : "Canvas effects off; turn on for transitions and ambient detail";
  const title = checked
    ? "Turn off flow transitions, vignette, and ambient grid"
    : "Restore transitions and ambient chrome";

  const control = (
    <ArchitecturalTooltip
      content={title}
      side="top"
      delayMs={420}
      avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
    >
      <Button
        type="button"
        variant="ghost"
        tone="glass"
        size="icon"
        iconOnly
        aria-label={ariaLabel}
        isActive={checked}
        onClick={onButtonClick}
      >
        <Waves size={18} weight="bold" aria-hidden />
      </Button>
    </ArchitecturalTooltip>
  );

  if (layout === "bare") {
    return (
      <ArchitecturalTooltip
        content={title}
        side="top"
        delayMs={420}
        avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
      >
        <Button
          type="button"
          variant="ghost"
          tone="glass"
          size="icon"
          iconOnly
          data-hg-chrome="canvas-effects-toggle"
          aria-label={ariaLabel}
          isActive={checked}
          onClick={onButtonClick}
        >
          <Waves size={18} weight="bold" aria-hidden />
        </Button>
      </ArchitecturalTooltip>
    );
  }

  if (layout === "inline") {
    return (
      <div className={styles.focusEffectsStripInline} data-hg-chrome="canvas-effects-toggle">
        {control}
      </div>
    );
  }

  return (
    <div className={styles.focusEffectsStrip} data-hg-chrome="canvas-effects-toggle">
      <div
        className={cx(
          styles.rootDockPanel,
          styles.focusEffectsDockPanel,
          trailingSlot ? styles.focusEffectsDockCluster : undefined,
        )}
      >
        {control}
        {trailingSlot}
      </div>
    </div>
  );
}

/** Bottom-right glass chip: map icon toggles canvas minimap; X/Y = viewport center in world space (0,0 when recentered); zoom read-only. */
export function ArchitecturalViewportMetrics({
  centerWorldX,
  centerWorldY,
  scale,
  zoomPrefixIcon = true,
  minimapOpen = false,
  onToggleMinimap,
}: {
  centerWorldX: number;
  centerWorldY: number;
  scale: number;
  zoomPrefixIcon?: boolean;
  minimapOpen?: boolean;
  onToggleMinimap?: () => void;
}) {
  /** Viewport-derived X/Y differ SSR vs client. Show stable 0,0 on server snapshot. */
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const displayWorldX = isClient ? centerWorldX : 0;
  const displayWorldY = isClient ? centerWorldY : 0;

  const metricsReadout = (
    <>
      <ArchitecturalStatusMetric>
        X:
        <span className={styles.metric}>{displayWorldX}</span> Y:
        <span className={styles.metric}>{displayWorldY}</span>
      </ArchitecturalStatusMetric>
      <div className={styles.sep} />
      <ArchitecturalStatusMetric
        icon={zoomPrefixIcon ? <MagnifyingGlass size={12} aria-hidden /> : undefined}
      >
        <span className={styles.metric}>{Math.round(scale * 100)}%</span>
      </ArchitecturalStatusMetric>
    </>
  );

  const panel = onToggleMinimap ? (
    <div className={cx(styles.rootDockPanel, styles.viewportMetricsPanel)}>
      <div
        className={styles.viewportMetricsReadout}
        role="status"
        aria-label="Viewport center in world coordinates and zoom"
      >
        {metricsReadout}
      </div>
      <div className={styles.sep} aria-hidden />
      <ArchitecturalTooltip
        content={minimapOpen ? "Hide canvas map" : "Show canvas map"}
        side="top"
        delayMs={280}
        avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
      >
        <Button
          type="button"
          size="icon"
          tone="glass"
          variant="ghost"
          iconOnly
          onClick={onToggleMinimap}
          aria-pressed={minimapOpen}
          aria-label={minimapOpen ? "Hide canvas map" : "Show canvas map"}
        >
          <PictureInPicture
            size={20}
            weight={minimapOpen ? "fill" : "regular"}
            aria-hidden
          />
        </Button>
      </ArchitecturalTooltip>
    </div>
  ) : (
    <div className={`${styles.rootDockPanel} ${styles.viewportMetricsPanel}`}>{metricsReadout}</div>
  );

  return (
    <div
      className={styles.viewportMetricsStrip}
      data-hg-chrome="viewport-metrics"
      aria-label={
        onToggleMinimap
          ? "Viewport center in world space, zoom, and canvas map toggle"
          : "Viewport center in world space and zoom"
      }
    >
      {panel}
    </div>
  );
}

function VaultIndexStatusInline() {
  const [, tick] = useState(0);

  useEffect(() => {
    return subscribeVaultIndexStatus(() => tick((n) => n + 1));
  }, []);

  const { pendingCount, inFlightCount, errorLine } = getVaultIndexStatusSnapshot();
  const vaultBusy = pendingCount + inFlightCount > 0;

  if (!vaultBusy && !errorLine) return null;

  const isError = Boolean(errorLine);
  const label = errorLine ?? "Indexing notes for search…";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.vaultIndexToastWrap} role="status" aria-live="polite" aria-atomic="true">
      <div className={cx(styles.vaultIndexToast, isError ? styles.vaultIndexToastError : undefined)}>
        {isError ? (
          <WarningCircle className={styles.statusSaveWarningIcon} size={14} weight="bold" aria-hidden />
        ) : (
          <CircleNotch className={cx(styles.vaultIndexToastSpinner, styles.syncSpin)} size={14} />
        )}
        <span className={styles.vaultIndexToastText}>{label}</span>
      </div>
    </div>,
    getVigilPortalRoot(),
  );
}

export type CollabPeerPresenceChip = {
  clientId: string;
  emoji: string;
  title: string;
  ariaLabel: string;
  muted?: boolean;
  onFollow: () => void;
};

export function ArchitecturalStatusBar({
  envLabel = "波途画電",
  syncSessionLabel,
  syncSourceLabel,
  syncSpaceLabel,
  syncStrictGm,
  showPulse = true,
  syncAwaitingBootAuth = false,
  syncBootstrapPending = false,
  syncShowingCachedWorkspace = false,
  syncOfflineNoSnapshot = false,
  collabPeers = [],
  onExportGraphJson,
  exportGraphPaletteHint,
}: {
  envLabel?: string;
  syncSessionLabel?: string;
  syncSourceLabel?: string;
  syncSpaceLabel?: string;
  syncStrictGm?: boolean;
  showPulse?: boolean;
  /** Boot PIN gate on and no valid session yet — show sign-in copy instead of “offline / Neon”. */
  syncAwaitingBootAuth?: boolean;
  /** True while default-scenario bootstrap is in flight (before we know demo vs Neon). */
  syncBootstrapPending?: boolean;
  syncShowingCachedWorkspace?: boolean;
  syncOfflineNoSnapshot?: boolean;
  /** Other sessions in this space subtree (best-effort); click chip to follow their view. */
  collabPeers?: CollabPeerPresenceChip[];
  onExportGraphJson?: () => void;
  exportGraphPaletteHint?: string;
}) {
  const syncChromeRef = useRef<HTMLDivElement>(null);
  return (
    <div className={styles.statusBarSegment} data-hg-chrome="canvas-status">
      <div
        ref={syncChromeRef}
        className={`${styles.glassPanel} ${styles.shellTopChromePanel}`}
      >
        <SaveAndVersionPopover
          popoverAnchorRef={syncChromeRef}
          envLabel={envLabel}
          sessionLabel={syncSessionLabel}
          sourceLabel={syncSourceLabel}
          spaceLabel={syncSpaceLabel}
          strictSync={syncStrictGm}
          showPulse={showPulse}
          awaitingBootAuth={syncAwaitingBootAuth}
          bootstrapPending={syncBootstrapPending}
          showingCachedWorkspace={syncShowingCachedWorkspace}
          offlineNoSnapshot={syncOfflineNoSnapshot}
          onExportGraphJson={onExportGraphJson}
          exportGraphPaletteHint={exportGraphPaletteHint}
        />
        {collabPeers.length > 0 ? (
          <>
            <div className={styles.sep} />
            <div className={styles.collabPeerStrip} role="group" aria-label="Collaborators in this area">
              {collabPeers.map((p) => (
                <Button
                  key={p.clientId}
                  type="button"
                  size="xs"
                  tone="glass"
                  variant="ghost"
                  className={cx(styles.collabPeerChip, p.muted && styles.collabPeerChipMuted)}
                  title={p.title}
                  aria-label={p.ariaLabel}
                  onClick={p.onFollow}
                >
                  {p.emoji}
                </Button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <VaultIndexStatusInline />
    </div>
  );
}
