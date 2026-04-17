"use client";

import type { CSSProperties } from "react";

import type { CanvasTool, TapeVariant } from "@/src/components/foundation/architectural-types";
import type { WikiLinkAssistConfig } from "@/src/components/editing/BufferedContentEditable";
import {
  ArchitecturalNodeBody,
  ArchitecturalNodeTape,
} from "@/src/components/foundation/ArchitecturalNodeCard";
import { LoreLocationOrdoV7Slab } from "@/src/components/foundation/LoreLocationOrdoV7Slab";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { bodyHtmlImpliesLoreLocationOrdoV7 } from "@/src/lib/lore-node-seed-html";

/**
 * Location ORDO v7 slab on the infinite canvas: body-only plate (no generic A4 header), like character v11.
 * Long-form notes are in `bodyHtml` and shown in the slab (`HeartgardenDocEditor`); focus hybrid editor edits the same document.
 */
export function ArchitecturalLoreLocationCanvasNode({
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
  /** Ordo staple bar; independent of `showTape` (location cards keep tape off but show staples when not grouped). */
  showStaple = true,
  bodyEditable,
  onBodyDraftDirty,
  wikiLinkAssist,
  onRichDocCommand,
  emptyPlaceholder,
}: {
  id: string;
  width?: number;
  tapeVariant?: TapeVariant;
  tapeRotation: number;
  bodyHtml: string;
  activeTool: CanvasTool;
  dragged: boolean;
  selected: boolean;
  onBodyCommit: (id: string, html: string) => void;
  showTape?: boolean;
  showStaple?: boolean;
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

  const editable = bodyEditable ?? activeTool === "select";

  return (
    <div
      className={`${styles.entityNode} ${styles.loreLocationOrdoCanvasRoot} ${
        dragged ? styles.dragging : ""
      } ${selected ? styles.selectedNode : ""}`}
      style={cardStyle}
      data-hg-canvas-role="lore-location"
      data-lore-kind="location"
      data-lore-variant="v7"
    >
      {showTape ? (
        <ArchitecturalNodeTape variant={tapeVariant} rotationDeg={tapeRotation} />
      ) : null}
      {bodyHtmlImpliesLoreLocationOrdoV7(bodyHtml) ? (
        <LoreLocationOrdoV7Slab
          nodeId={id}
          bodyHtml={bodyHtml}
          showStaple={showStaple}
          tapeRotationDeg={tapeRotation}
          editable={editable}
          onCommit={(html) => onBodyCommit(id, html)}
          onDraftDirty={onBodyDraftDirty}
          emptyPlaceholder={emptyPlaceholder}
        />
      ) : (
        <ArchitecturalNodeBody
          nodeId={id}
          documentVariant="html"
          html={bodyHtml}
          className={styles.loreLocationOrdoBody}
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
      )}
    </div>
  );
}
