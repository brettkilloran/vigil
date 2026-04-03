"use client";

import { CornersOut, DownloadSimple, Folder } from "@phosphor-icons/react";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

export function ArchitecturalFolderCard({
  id,
  title,
  itemCount = 0,
  selected = false,
  dragOver = false,
  onOpen,
  onTitleInput,
}: {
  id: string;
  title: string;
  itemCount?: number;
  selected?: boolean;
  dragOver?: boolean;
  onOpen?: () => void;
  onTitleInput?: (title: string) => void;
}) {
  return (
    <div
      data-folder-drop="true"
      data-folder-id={id}
      className={`${styles.folderNode} ${dragOver ? styles.folderDragOver : ""} ${
        selected ? styles.folderSelected : ""
      }`}
    >
      <div className={styles.folderTab}>
        <Folder size={12} />
        FOLDER
      </div>
      <div className={styles.folderBack} />
      <div className={styles.folderInterior}>
        <DownloadSimple size={24} />
        <span>Drop to insert</span>
      </div>
      <div className={styles.folderFront}>
        <div className={styles.folderTopRow}>
          <div className={styles.folderMetaBlock}>
            <div
              className={styles.folderTitleInput}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onInput={(event) => onTitleInput?.((event.target as HTMLElement).innerText)}
            >
              {title}
            </div>
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
            <CornersOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
