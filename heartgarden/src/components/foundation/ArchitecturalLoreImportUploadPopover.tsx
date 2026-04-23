"use client";

import { Button } from "@/src/components/ui/Button";
import styles from "./ArchitecturalCanvasApp.module.css";

export type LoreImportUploadMode = "one_note" | "many_loose" | "many_folders";

export function ArchitecturalLoreImportUploadPopover(props: {
  open: boolean;
  top: number;
  left: number;
  mode: LoreImportUploadMode;
  contextText: string;
  onModeChange: (mode: LoreImportUploadMode) => void;
  onContextTextChange: (value: string) => void;
  onChooseFile: () => void;
  onClose: () => void;
}) {
  const {
    open,
    top,
    left,
    mode,
    contextText,
    onModeChange,
    onContextTextChange,
    onChooseFile,
    onClose,
  } = props;
  if (!open) return null;
  const showContext = mode !== "one_note";
  return (
    <div className={styles.importUploadPopoverBackdrop} onMouseDown={onClose}>
      <div
        className={styles.importUploadPopover}
        role="dialog"
        aria-modal="true"
        aria-label="Import document"
        style={{ top, left }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className={styles.importUploadPopoverTitle}>How should this import land?</p>
        <div className={styles.importUploadPopoverModes}>
          <label className={styles.importUploadPopoverModeRow}>
            <input
              type="radio"
              name="import-mode"
              checked={mode === "one_note"}
              onChange={() => onModeChange("one_note")}
            />
            <span>
              <strong>One note</strong>
              <small>Drop the whole document as one card. No AI planning.</small>
            </span>
          </label>
          <label className={styles.importUploadPopoverModeRow}>
            <input
              type="radio"
              name="import-mode"
              checked={mode === "many_loose"}
              onChange={() => onModeChange("many_loose")}
            />
            <span>
              <strong>Many loose</strong>
              <small>Extract entities and drop them on this canvas. No folders.</small>
            </span>
          </label>
          <label className={styles.importUploadPopoverModeRow}>
            <input
              type="radio"
              name="import-mode"
              checked={mode === "many_folders"}
              onChange={() => onModeChange("many_folders")}
            />
            <span>
              <strong>Many in folders</strong>
              <small>Extract entities and organize them into folders.</small>
            </span>
          </label>
        </div>
        {showContext ? (
          <label className={styles.importUploadPopoverContext}>
            <span>Optional context</span>
            <textarea
              value={contextText}
              onChange={(event) => onContextTextChange(event.target.value)}
              placeholder="Example: Session 12 notes. Prefer characters and factions."
            />
          </label>
        ) : null}
        <div className={styles.importUploadPopoverActions}>
          <Button size="sm" variant="neutral" tone="card-dark" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" tone="solid" type="button" onClick={onChooseFile}>
            Choose file
          </Button>
        </div>
        <p className={styles.importUploadPopoverHint}>Accepted: .pdf .md .txt .docx</p>
      </div>
    </div>
  );
}

