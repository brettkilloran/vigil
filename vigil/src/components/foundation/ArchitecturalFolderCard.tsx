"use client";

import { useMemo } from "react";
import { CornersOut, DownloadSimple } from "@phosphor-icons/react";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { BufferedContentEditable } from "@/src/components/editing/BufferedContentEditable";

/** Stable 0..2^32-1 from string — same folder id always gets same “random” angles. */
function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Degrees in ~[-3.6, 3.5], varies by layer so stacks don’t look parallel. */
function peekSheetRotationDeg(folderId: string, layer: number): number {
  const n = stableHash(`vigil:folder-peek:${folderId}:${layer}`);
  return (n % 720) / 100 - 3.6;
}

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
  const showPeek = itemCount > 0;

  const peekRotDeg = useMemo(
    () => ({
      a: peekSheetRotationDeg(id, 0),
      b: peekSheetRotationDeg(id, 1),
      c: peekSheetRotationDeg(id, 2),
    }),
    [id],
  );

  return (
    <div
      data-folder-drop="true"
      data-folder-id={id}
      className={`${styles.folderNode} ${dragOver ? styles.folderDragOver : ""} ${
        selected ? styles.folderSelected : ""
      }`}
    >
      <div className={styles.folderBack} />
      {showPeek ? (
        <div className={styles.folderPeekStack} aria-hidden>
          <div
            className={`${styles.folderPeekCard} ${styles.folderPeekA}`}
            style={{ transform: `rotate(${peekRotDeg.a}deg)` }}
          />
          {itemCount >= 2 ? (
            <div
              className={`${styles.folderPeekCard} ${styles.folderPeekB}`}
              style={{ transform: `rotate(${peekRotDeg.b}deg)` }}
            />
          ) : null}
          {itemCount >= 3 ? (
            <div
              className={`${styles.folderPeekCard} ${styles.folderPeekC}`}
              style={{ transform: `rotate(${peekRotDeg.c}deg)` }}
            />
          ) : null}
        </div>
      ) : null}
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
