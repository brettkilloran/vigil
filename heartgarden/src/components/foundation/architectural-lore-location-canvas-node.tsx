"use client";

import type { CSSProperties } from "react";

import type { WikiLinkAssistConfig } from "@/src/components/editing/buffered-content-editable";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { ArchitecturalNodeBody } from "@/src/components/foundation/architectural-node-card";
import type { CanvasTool } from "@/src/components/foundation/architectural-types";
import { LoreLocationOrdoV7Slab } from "@/src/components/foundation/lore-location-ordo-v-7-slab";
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
  /** Location canvas cards always use staples (never tape). */
  showStaple = true,
  bodyEditable,
  onBodyDraftDirty,
  wikiLinkAssist,
  onRichDocCommand,
  emptyPlaceholder,
}: {
  id: string;
  width?: number;
  tapeRotation: number;
  bodyHtml: string;
  activeTool: CanvasTool;
  dragged: boolean;
  selected: boolean;
  onBodyCommit: (id: string, html: string) => void;
  showStaple?: boolean;
  bodyEditable?: boolean;
  onBodyDraftDirty?: (dirty: boolean) => void;
  wikiLinkAssist?: WikiLinkAssistConfig | null;
  onRichDocCommand?: (command: string, value?: string) => void;
  emptyPlaceholder?: string | null;
}) {
  const MAX_ENTITY_CARD_WIDTH = 340;
  const nodeWidth = Math.min(
    width ?? MAX_ENTITY_CARD_WIDTH,
    MAX_ENTITY_CARD_WIDTH
  );
  const cardStyle = {
    "--entity-width": `${nodeWidth}px`,
    width: `${nodeWidth}px`,
  } as CSSProperties;

  const editable = bodyEditable ?? activeTool === "select";

  return (
    <div
      className={`${styles.entityNode} ${styles.loreLocationOrdoCanvasRoot} ${
        dragged ? styles.dragging : ""
      } ${selected ? styles.selectedNode : ""}`}
      data-hg-canvas-role="lore-location"
      data-lore-kind="location"
      data-lore-variant="v7"
      style={cardStyle}
    >
      {bodyHtmlImpliesLoreLocationOrdoV7(bodyHtml) ? (
        <LoreLocationOrdoV7Slab
          bodyHtml={bodyHtml}
          editable={editable}
          emptyPlaceholder={emptyPlaceholder}
          nodeId={id}
          onCommit={(html) => onBodyCommit(id, html)}
          onDraftDirty={onBodyDraftDirty}
          showStaple={showStaple}
          tapeRotationDeg={tapeRotation}
        />
      ) : (
        <ArchitecturalNodeBody
          className={styles.loreLocationOrdoBody}
          documentVariant="html"
          editable={editable}
          emptyPlaceholder={emptyPlaceholder}
          html={bodyHtml}
          nodeId={id}
          onCommitPayload={(p) => {
            if (p.kind === "html") {
              onBodyCommit(id, p.html);
            }
          }}
          onDraftDirtyChange={onBodyDraftDirty}
          onRichDocCommand={onRichDocCommand}
          spellCheck={false}
          wikiLinkAssist={wikiLinkAssist ?? null}
        />
      )}
    </div>
  );
}
