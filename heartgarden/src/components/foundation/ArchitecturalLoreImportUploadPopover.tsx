"use client";

import { useEffect, useId } from "react";
import { Button } from "@/src/components/ui/Button";
import { LoreImportLandModeRadios } from "./LoreImportLandModeRadios";
import type { LoreImportUploadMode } from "./LoreImportLandModeRadios";
import styles from "./ArchitecturalCanvasApp.module.css";

export type { LoreImportUploadMode } from "./LoreImportLandModeRadios";

export function ArchitecturalLoreImportUploadPopover(props: {
  open: boolean;
  fileName: string;
  mode: LoreImportUploadMode;
  contextText: string;
  onModeChange: (mode: LoreImportUploadMode) => void;
  onContextTextChange: (value: string) => void;
  onChangeFile: () => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  const {
    open,
    fileName,
    mode,
    contextText,
    onModeChange,
    onContextTextChange,
    onChangeFile,
    onContinue,
    onClose,
  } = props;
  const contextHintId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className={styles.importUploadPopoverBackdrop} onMouseDown={onClose}>
      <div
        className={styles.importUploadPopover}
        role="dialog"
        aria-modal="true"
        aria-label="Import document"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.importUploadPopoverHeader}>
          <p className={styles.importUploadPopoverTitle}>Import document</p>
          <p className={styles.importUploadPopoverSubtitle}>
            File ready: <strong>{fileName}</strong>
          </p>
        </header>
        <section className={styles.importUploadPopoverSection}>
          <h3 className={styles.importUploadPopoverSectionTitle}>Import focus</h3>
          <label className={styles.importUploadPopoverContext}>
            <textarea
              value={contextText}
              onChange={(event) => onContextTextChange(event.target.value)}
              placeholder="Tell the AI what to prioritize and how to organize this import..."
              aria-describedby={contextHintId}
            />
          </label>
          <p id={contextHintId} className={styles.importUploadPopoverContextHint}>
            Optional. One sentence is usually enough.
          </p>
        </section>
        <section className={styles.importUploadPopoverSection}>
          <h3 className={styles.importUploadPopoverSectionTitle}>How should this import land?</h3>
          <LoreImportLandModeRadios mode={mode} onModeChange={onModeChange} />
        </section>
        <div
          className={styles.importUploadPopoverActions}
          role="group"
          aria-label="Import actions"
        >
          <div className={styles.importUploadPopoverActionsSecondary}>
            <Button size="sm" variant="ghost" tone="glass" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" variant="ghost" tone="glass" type="button" onClick={onChangeFile}>
              Change file
            </Button>
          </div>
          <div className={styles.importUploadPopoverActionsPrimary}>
            <Button size="sm" variant="primary" tone="solid" type="button" onClick={onContinue}>
              Continue import
            </Button>
          </div>
        </div>
        <p className={styles.importUploadPopoverHint}>Accepted: .pdf .md .txt .docx</p>
      </div>
    </div>
  );
}

