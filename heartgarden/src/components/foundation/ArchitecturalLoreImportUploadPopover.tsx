"use client";

import { useEffect } from "react";
import { Button } from "@/src/components/ui/Button";
import styles from "./ArchitecturalCanvasApp.module.css";
import type { LoreImportUploadMode } from "./LoreImportLandModeRadios";
import { LoreImportLandModeRadios } from "./LoreImportLandModeRadios";
import type { LoreImportScopeMode } from "./LoreImportScopeRadios";
import { LoreImportScopeRadios } from "./LoreImportScopeRadios";

export type { LoreImportUploadMode } from "./LoreImportLandModeRadios";
export type { LoreImportScopeMode } from "./LoreImportScopeRadios";

export function ArchitecturalLoreImportUploadPopover(props: {
  open: boolean;
  fileName: string;
  mode: LoreImportUploadMode;
  scope: LoreImportScopeMode;
  contextText: string;
  onModeChange: (mode: LoreImportUploadMode) => void;
  onScopeChange: (scope: LoreImportScopeMode) => void;
  onContextTextChange: (value: string) => void;
  onChangeFile: () => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  const {
    open,
    fileName,
    mode,
    scope,
    contextText,
    onModeChange,
    onScopeChange,
    onContextTextChange,
    onChangeFile,
    onContinue,
    onClose,
  } = props;
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

  if (!open) {
    return null;
  }

  return (
    <div className={styles.importUploadPopoverBackdrop} onMouseDown={onClose}>
      <div
        aria-label="Import document"
        aria-modal="true"
        className={styles.importUploadPopover}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={styles.importUploadPopoverHeader}>
          <p className={styles.importUploadPopoverTitle}>Import document</p>
          <p className={styles.importUploadPopoverSubtitle}>
            File ready: <strong>{fileName}</strong>
          </p>
        </header>
        <section className={styles.importUploadPopoverSection}>
          <h3 className={styles.importUploadPopoverSectionTitle}>
            Import focus
          </h3>
          <label className={styles.importUploadPopoverContext}>
            <textarea
              onChange={(event) => onContextTextChange(event.target.value)}
              placeholder="Tell the AI what to prioritize and how to organize this import..."
              value={contextText}
            />
          </label>
        </section>
        <section className={styles.importUploadPopoverSection}>
          <h3 className={styles.importUploadPopoverSectionTitle}>
            How should this import land?
          </h3>
          <LoreImportLandModeRadios mode={mode} onModeChange={onModeChange} />
        </section>
        <section className={styles.importUploadPopoverSection}>
          <h3 className={styles.importUploadPopoverSectionTitle}>
            Where can this import place notes?
          </h3>
          <LoreImportScopeRadios onScopeChange={onScopeChange} scope={scope} />
        </section>
        <div
          aria-label="Import actions"
          className={styles.importUploadPopoverActions}
          role="group"
        >
          <div className={styles.importUploadPopoverActionsSecondary}>
            <Button
              onClick={onClose}
              size="sm"
              tone="glass"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              onClick={onChangeFile}
              size="sm"
              tone="glass"
              type="button"
              variant="ghost"
            >
              Change file
            </Button>
          </div>
          <div className={styles.importUploadPopoverActionsPrimary}>
            <Button
              onClick={onContinue}
              size="sm"
              tone="focus-light"
              type="button"
              variant="default"
            >
              Continue import
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
