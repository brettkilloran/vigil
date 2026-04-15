"use client";

import type { CSSProperties } from "react";
import { useLayoutEffect, useRef } from "react";

import type {
  CanvasTool,
  TapeVariant,
} from "@/src/components/foundation/architectural-types";
import type { WikiLinkAssistConfig } from "@/src/components/editing/BufferedContentEditable";
import {
  ArchitecturalNodeBody,
  ArchitecturalNodeTape,
} from "@/src/components/foundation/ArchitecturalNodeCard";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

/**
 * Character v11 ID plate on the infinite canvas: one surface, no generic “note / A4” chrome.
 * Intentionally does not use `themeDefault` so document mat colors cannot override the credential.
 */
export function ArchitecturalLoreCharacterCanvasNode({
  id,
  width,
  tapeRotation,
  bodyHtml,
  activeTool,
  dragged,
  selected,
  onBodyCommit,
  tapeVariant = "clear",
  showTape = false,
  bodyEditable,
  onBodyDraftDirty,
  wikiLinkAssist,
  onRichDocCommand,
  emptyPlaceholder,
  onRequestCanvasBodyEdit,
}: {
  id: string;
  width?: number;
  tapeRotation: number;
  tapeVariant?: TapeVariant;
  bodyHtml: string;
  activeTool: CanvasTool;
  dragged: boolean;
  selected: boolean;
  onBodyCommit: (id: string, html: string) => void;
  showTape?: boolean;
  bodyEditable?: boolean;
  onBodyDraftDirty?: (dirty: boolean) => void;
  wikiLinkAssist?: WikiLinkAssistConfig | null;
  onRichDocCommand?: (command: string, value?: string) => void;
  emptyPlaceholder?: string | null;
  /** Standalone canvas: double-click enters inline edit when the body is not yet editable. */
  onRequestCanvasBodyEdit?: () => void;
}) {
  const nodeWidth = width ?? 340;
  const cardStyle = {
    width: width != null ? `${width}px` : undefined,
    "--entity-width": `${nodeWidth}px`,
  } as CSSProperties;

  const editable = bodyEditable ?? activeTool === "select";
  const prevEditableRef = useRef(false);

  useLayoutEffect(() => {
    if (!editable) {
      prevEditableRef.current = false;
      const host = document.querySelector(
        `[data-node-id="${CSS.escape(id)}"] [data-node-body-editor="true"]`,
      ) as HTMLElement | null;
      const ae = document.activeElement;
      if (host && ae && host.contains(ae)) {
        (ae as HTMLElement).blur();
      }
      return;
    }
    if (prevEditableRef.current) return;
    prevEditableRef.current = true;
    const host = document.querySelector(
      `[data-node-id="${CSS.escape(id)}"] [data-node-body-editor="true"]`,
    ) as HTMLElement | null;
    host?.focus();
  }, [editable, id]);

  return (
    <div
      className={`${styles.entityNode} ${styles.loreCharacterCanvasRoot} ${
        dragged ? styles.dragging : ""
      } ${selected ? styles.selectedNode : ""}`}
      style={cardStyle}
      data-hg-canvas-role="lore-character-v11"
      data-lore-kind="character"
      data-lore-variant="v11"
      onDoubleClick={(event) => {
        if (activeTool !== "select") return;
        if (editable) return;
        if (!onRequestCanvasBodyEdit) return;
        event.stopPropagation();
        onRequestCanvasBodyEdit();
      }}
    >
      {showTape ? (
        <ArchitecturalNodeTape variant={tapeVariant} rotationDeg={tapeRotation} />
      ) : null}
      <ArchitecturalNodeBody
        nodeId={id}
        documentVariant="html"
        html={bodyHtml}
        className={styles.loreCharacterBody}
        editable={editable}
        spellCheck={false}
        onCommitPayload={(p) => {
          if (p.kind === "html") onBodyCommit(id, p.html);
        }}
        onDraftDirtyChange={onBodyDraftDirty}
        wikiLinkAssist={wikiLinkAssist ?? null}
        onRichDocCommand={onRichDocCommand}
        emptyPlaceholder={emptyPlaceholder}
      />
    </div>
  );
}
