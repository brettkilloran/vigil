"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { Button } from "@/src/components/ui/button";
import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";
import {
  formatLoreImportFailureReport,
  type LoreImportFailureDetail,
  loreImportSummaryLine,
} from "@/src/lib/lore-import-diagnostic";
import { playVigilUiSound } from "@/src/lib/vigil-ui-sounds";

interface Props {
  failure: LoreImportFailureDetail | null;
  onClose: () => void;
  onRetry?: () => void;
}

const RETRYABLE_STAGES = new Set(["parse", "job_create", "timeout", "unknown"]);

export function ArchitecturalLoreImportErrorDialog({
  failure,
  onClose,
  onRetry,
}: Props) {
  const [copyHint, setCopyHint] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const canRetry = Boolean(
    onRetry && failure && RETRYABLE_STAGES.has(failure.stage)
  );

  const report = useMemo(
    () => (failure ? formatLoreImportFailureReport(failure) : ""),
    [failure]
  );
  const statusLine = useMemo(
    () => (failure ? loreImportSummaryLine(failure) : ""),
    [failure]
  );
  const severity = failure?.stage === "timeout" ? "warn" : "error";

  const copySnapshot = useCallback(() => {
    const payload = report.trim();
    if (!payload) {
      return;
    }
    navigator.clipboard.writeText(payload).then(
      () => {
        playVigilUiSound("tap");
        setCopyHint("copied");
        if (timerRef.current != null) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setCopyHint("idle");
        }, 2200);
      },
      () => setCopyHint("failed")
    );
  }, [report]);

  useEffect(
    () => () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!failure) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [failure, onClose]);

  useEffect(() => {
    if (!failure) {
      return;
    }
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) {
        return;
      }
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) {
        return;
      }
      onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [failure, onClose]);

  if (!failure || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div aria-hidden={false} className={styles.loreImportErrorBackdrop}>
      <div
        aria-labelledby={`${panelId}-title`}
        aria-modal="true"
        className={`${styles.syncPopover} ${styles.loreImportErrorDialog}`}
        id={panelId}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        ref={panelRef}
        role="dialog"
      >
        <div className={styles.syncPopoverTitle} id={`${panelId}-title`}>
          Import failed
        </div>
        <div className={styles.syncPopoverStatusLineWrap}>
          <span
            className={`${styles.syncPopoverSeverity} ${
              severity === "warn"
                ? styles.syncPopoverSeverityWarn
                : styles.syncPopoverSeverityError
            }`}
          >
            {severity === "warn" ? "Attention" : "Error"}
          </span>
          <span className={styles.syncPopoverStatusLine}>{statusLine}</span>
        </div>
        <p className={styles.syncPopoverBody}>{failure.message}</p>
        <p className={styles.syncPopoverAction}>
          {failure.recommendedAction ??
            "Copy diagnostics and share it so we can isolate the failing stage."}
        </p>
        <div className={styles.syncPopoverContext}>
          <div className={styles.syncPopoverContextRow}>
            <span className={styles.syncPopoverContextKey}>Attempt</span>
            <span className={styles.syncPopoverContextVal}>
              {failure.attemptId}
            </span>
          </div>
          <div className={styles.syncPopoverContextRow}>
            <span className={styles.syncPopoverContextKey}>Stage</span>
            <span className={styles.syncPopoverContextVal}>
              {failure.stage}
            </span>
          </div>
          <div className={styles.syncPopoverContextRow}>
            <span className={styles.syncPopoverContextKey}>Operation</span>
            <span className={styles.syncPopoverContextVal}>
              {failure.operation}
            </span>
          </div>
          {failure.jobId ? (
            <div className={styles.syncPopoverContextRow}>
              <span className={styles.syncPopoverContextKey}>Job</span>
              <span className={styles.syncPopoverContextVal}>
                {failure.jobId}
              </span>
            </div>
          ) : null}
          {failure.phase ? (
            <div className={styles.syncPopoverContextRow}>
              <span className={styles.syncPopoverContextKey}>Phase</span>
              <span className={styles.syncPopoverContextVal}>
                {failure.phase}
              </span>
            </div>
          ) : null}
          {typeof failure.httpStatus === "number" ? (
            <div className={styles.syncPopoverContextRow}>
              <span className={styles.syncPopoverContextKey}>HTTP</span>
              <span className={styles.syncPopoverContextVal}>
                {failure.httpStatus}
              </span>
            </div>
          ) : null}
        </div>
        <div className={styles.syncPopoverQuickActions}>
          <Button
            className={styles.syncPopoverCopySnapshot}
            onClick={copySnapshot}
            size="md"
            tone="focus-light"
            type="button"
            variant="default"
          >
            {copyHint === "copied"
              ? "Snapshot copied"
              : copyHint === "failed"
                ? "Copy failed"
                : "Copy support snapshot"}
          </Button>
          {canRetry ? (
            <Button
              onClick={() => onRetry?.()}
              size="md"
              tone="focus-light"
              type="button"
              variant="default"
            >
              Retry import
            </Button>
          ) : null}
          <Button
            onClick={onClose}
            size="md"
            tone="focus-light"
            type="button"
            variant="default"
          >
            Dismiss
          </Button>
        </div>
        <div className={styles.syncPopoverCopyRow}>
          <pre className={styles.syncPopoverDiagnostic}>{report}</pre>
        </div>
      </div>
    </div>,
    getVigilPortalRoot()
  );
}
