"use client";

import { useMemo } from "react";
import { CornersOut, DownloadSimple } from "@phosphor-icons/react";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import {
  folderNodeStyleForScheme,
  type FolderColorSchemeId,
} from "@/src/components/foundation/architectural-folder-schemes";
import { BufferedContentEditable } from "@/src/components/editing/BufferedContentEditable";
import { pointerEventTargetElement } from "@/src/components/foundation/pointer-event-target";
import { Button } from "@/src/components/ui/Button";

const FOLDER_PREVIEW_VISIBLE_MAX = 6;

/** Stable 0..2^32-1 from string — same folder id always gets same “random” angles. */
function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Degrees in ~[-4.5, 3.5], varies by layer so stacks don’t look parallel. */
function peekSheetRotationDeg(folderId: string, layer: number): number {
  const n = stableHash(`vigil:folder-peek:v2:${folderId}:${layer}`);
  return (n % 800) / 100 - 4.5;
}

export function ArchitecturalFolderCard({
  id,
  title,
  itemCount = 0,
  previewTitles = [],
  selected = false,
  dragOver = false,
  folderColorScheme,
  onOpen,
  onTitleCommit,
}: {
  id: string;
  title: string;
  itemCount?: number;
  previewTitles?: string[];
  selected?: boolean;
  dragOver?: boolean;
  folderColorScheme?: FolderColorSchemeId;
  onOpen?: () => void;
  onTitleCommit?: (title: string) => void;
}) {
  const showPeek = itemCount > 0;
  const visiblePreviewTitles = previewTitles.slice(0, FOLDER_PREVIEW_VISIBLE_MAX);

  const peekRotDeg = useMemo(
    () => ({
      a: peekSheetRotationDeg(id, 0),
      b: peekSheetRotationDeg(id, 1),
      c: peekSheetRotationDeg(id, 2),
    }),
    [id],
  );

  const schemeStyle = folderNodeStyleForScheme(folderColorScheme);

  return (
    <div
      data-folder-drop="true"
      data-folder-id={id}
      className={`${styles.folderNode} ${dragOver ? styles.folderDragOver : ""} ${
        selected ? styles.folderSelected : ""
      }`}
      style={schemeStyle}
      onDoubleClick={(event) => {
        const el = pointerEventTargetElement(event.target);
        if (!el) return;
        if (el.closest(`.${styles.folderTitleInput}`)) return;
        if (el.closest("[data-folder-open-btn='true']")) return;
        event.preventDefault();
        event.stopPropagation();
        onOpen?.();
      }}
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
          <span
            className={styles.folderConnectionPinAnchor}
            data-folder-connection-pin-anchor="true"
            aria-hidden
          />
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
          <Button
            type="button"
            size="icon"
            variant="ghost"
            tone="card-dark"
            className={styles.nodeBtn}
            data-folder-open-btn="true"
            title="Open folder"
            aria-label="Open folder"
            onClick={(event) => {
              event.stopPropagation();
              onOpen?.();
            }}
          >
            <CornersOut size={14} />
          </Button>
        </div>
        <div className={styles.folderContentPreview}>
          {visiblePreviewTitles.length > 0 ? (
            <ul className={styles.folderContentPreviewList} aria-label="Folder contents preview">
              {visiblePreviewTitles.map((previewTitle, index) => (
                <li key={`${id}-preview-${index}`} className={styles.folderContentPreviewItem}>
                  {previewTitle}
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.folderContentPreviewEmpty}>No content yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
