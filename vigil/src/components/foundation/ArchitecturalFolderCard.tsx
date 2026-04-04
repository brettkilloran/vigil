"use client";

import { CornersOut, DownloadSimple } from "@phosphor-icons/react";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { BufferedContentEditable } from "@/src/components/editing/BufferedContentEditable";

export function ArchitecturalFolderCard({
  id,
  title,
  itemCount = 0,
  selected = false,
  dragOver = false,
  onOpen,
  onTitleCommit,
}: {
  id: string;
  title: string;
  itemCount?: number;
  selected?: boolean;
  dragOver?: boolean;
  onOpen?: () => void;
  onTitleCommit?: (title: string) => void;
}) {
  return (
    <div
      data-folder-drop="true"
      data-folder-id={id}
      className={`${styles.folderNode} ${dragOver ? styles.folderDragOver : ""} ${
        selected ? styles.folderSelected : ""
      }`}
    >
      <div className={styles.folderBack} />
      <div className={styles.folderInterior}>
        <DownloadSimple size={28} />
        <span>Drop to insert</span>
      </div>
      <div className={styles.folderFront}>
        <div className={styles.folderTopRow}>
          <div className={styles.folderMetaBlock}>
            <BufferedContentEditable
              value={title}
              className={styles.folderTitleInput}
              editable
              plainText
              spellCheck={false}
              debounceMs={250}
              normalizeOnCommit={(next) => next.trim() || "Untitled Folder"}
              onCommit={(next) => onTitleCommit?.(next)}
              dataAttribute="data-folder-title-editor"
            />
            <div className={styles.folderBadge}>
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </div>
          </div>
          <button
            type="button"
            className={styles.folderOpenBtn}
            data-folder-open-btn="true"
            onClick={(event) => {
              event.stopPropagation();
              onOpen?.();
            }}
          >
            <CornersOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
