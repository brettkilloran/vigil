"use client";

import { CornersOut, DownloadSimple } from "@phosphor-icons/react";
import { useMemo } from "react";

import { BufferedContentEditable } from "@/src/components/editing/buffered-content-editable";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import {
  type FolderColorSchemeId,
  folderNodeStyleForScheme,
} from "@/src/components/foundation/architectural-folder-schemes";
import { ArchitecturalTooltip } from "@/src/components/foundation/architectural-tooltip";
import { pointerEventTargetElement } from "@/src/components/foundation/pointer-event-target";
import { Button } from "@/src/components/ui/button";
import { fnv1aHash32 } from "@/src/lib/hash-utils";

/** Folder face lines; keep in sync with `.folderContentPreviewList` in ArchitecturalCanvasApp.module.css */
export const FOLDER_CONTENT_PREVIEW_MAX_LINES = 6;

/** Degrees in ~[-4.5, 3.5], varies by layer so stacks don't look parallel. */
function peekSheetRotationDeg(folderId: string, layer: number): number {
  const n = fnv1aHash32(`vigil:folder-peek:v2:${folderId}:${layer}`);
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
  const visiblePreviewTitles = previewTitles.slice(
    0,
    FOLDER_CONTENT_PREVIEW_MAX_LINES
  );

  const peekRotDeg = useMemo(
    () => ({
      a: peekSheetRotationDeg(id, 0),
      b: peekSheetRotationDeg(id, 1),
      c: peekSheetRotationDeg(id, 2),
    }),
    [id]
  );

  const schemeStyle = folderNodeStyleForScheme(folderColorScheme);

  return (
    <div
      className={`${styles.folderNode} ${dragOver ? styles.folderDragOver : ""} ${
        selected ? styles.folderSelected : ""
      }`}
      data-folder-drop="true"
      data-folder-id={id}
      onDoubleClick={(event) => {
        const el = pointerEventTargetElement(event.target);
        if (!el) {
          return;
        }
        if (el.closest(`.${styles.folderTitleInput}`)) {
          return;
        }
        if (el.closest("[data-folder-open-btn='true']")) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onOpen?.();
      }}
      style={schemeStyle}
    >
      <div className={styles.folderBack} />
      {showPeek ? (
        <div aria-hidden className={styles.folderPeekStack}>
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
            aria-hidden
            className={styles.folderConnectionPinAnchor}
            data-folder-connection-pin-anchor="true"
          />
          <div className={styles.folderMetaBlock}>
            <BufferedContentEditable
              className={styles.folderTitleInput}
              dataAttribute="data-folder-title-editor"
              debounceMs={250}
              editable
              normalizeOnCommit={(next) => next.trim() || "Untitled Folder"}
              onCommit={(next) => onTitleCommit?.(next)}
              plainText
              spellCheck={false}
              value={title}
            />
            <div className={styles.folderBadge}>
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </div>
          </div>
          <ArchitecturalTooltip
            content="Open folder"
            delayMs={320}
            side="bottom"
          >
            <Button
              aria-label="Open folder"
              className={styles.nodeBtn}
              data-folder-open-btn="true"
              onClick={(event) => {
                event.stopPropagation();
                onOpen?.();
              }}
              size="icon"
              tone="card-dark"
              type="button"
              variant="ghost"
            >
              <CornersOut size={14} />
            </Button>
          </ArchitecturalTooltip>
        </div>
        <div className={styles.folderContentPreview}>
          {visiblePreviewTitles.length > 0 ? (
            <ul
              aria-label="Folder contents preview"
              className={styles.folderContentPreviewList}
            >
              {visiblePreviewTitles.map((previewTitle, index) => (
                <li
                  className={styles.folderContentPreviewItem}
                  // biome-ignore lint/suspicious/noArrayIndexKey: preview titles are plain strings that may duplicate; folder id + index is the most stable composite available
                  key={`${id}-preview-${index}`}
                >
                  {previewTitle}
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.folderContentPreviewEmpty}>
              No content yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
