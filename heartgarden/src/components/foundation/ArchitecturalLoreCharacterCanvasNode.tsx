"use client";

import type { CSSProperties } from "react";

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
}) {
  const nodeWidth = width ?? 340;
  const cardStyle = {
    width: width != null ? `${width}px` : undefined,
    "--entity-width": `${nodeWidth}px`,
  } as CSSProperties;

  return (
    <div
      className={`${styles.entityNode} ${styles.loreCharacterCanvasRoot} ${
        dragged ? styles.dragging : ""
      } ${selected ? styles.selectedNode : ""}`}
      style={cardStyle}
      data-hg-canvas-role="lore-character-v11"
      data-lore-kind="character"
      data-lore-variant="v11"
    >
      {showTape ? (
        <ArchitecturalNodeTape variant={tapeVariant} rotationDeg={tapeRotation} />
      ) : null}
      <ArchitecturalNodeBody
        nodeId={id}
        documentVariant="html"
        html={bodyHtml}
        className={styles.loreCharacterBody}
        editable={bodyEditable ?? activeTool === "select"}
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
