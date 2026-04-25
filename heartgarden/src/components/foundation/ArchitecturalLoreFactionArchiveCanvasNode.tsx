"use client";

import type { CSSProperties } from "react";

import type { WikiLinkAssistConfig } from "@/src/components/editing/BufferedContentEditable";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import {
  ArchitecturalNodeBody,
  ArchitecturalNodeTape,
} from "@/src/components/foundation/ArchitecturalNodeCard";
import type {
  CanvasTool,
  TapeVariant,
} from "@/src/components/foundation/architectural-types";
import { LoreFactionArchive091Slab } from "@/src/components/foundation/LoreFactionArchive091Slab";
import type { FactionRosterEntry } from "@/src/lib/faction-roster-schema";
import { bodyHtmlImpliesFactionArchive091 } from "@/src/lib/lore-faction-archive-html";

/**
 * Faction Archive-091 slab on the infinite canvas — body-only plate (no generic A4 header).
 */
export function ArchitecturalLoreFactionArchiveCanvasNode({
  id,
  width,
  tapeRotation,
  bodyHtml,
  factionRoster,
  activeTool,
  dragged,
  selected,
  onBodyCommit,
  tapeVariant = "dark",
  showTape = true,
  bodyEditable,
  onBodyDraftDirty,
  onFactionRosterChange,
  wikiLinkAssist,
  onRichDocCommand,
  emptyPlaceholder,
}: {
  id: string;
  width?: number;
  tapeVariant?: TapeVariant;
  tapeRotation: number;
  bodyHtml: string;
  factionRoster: FactionRosterEntry[];
  activeTool: CanvasTool;
  dragged: boolean;
  selected: boolean;
  onBodyCommit: (id: string, html: string) => void;
  showTape?: boolean;
  bodyEditable?: boolean;
  onBodyDraftDirty?: (dirty: boolean) => void;
  onFactionRosterChange?: (id: string, roster: FactionRosterEntry[]) => void;
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
      className={`${styles.entityNode} ${styles.loreFactionArchiveCanvasRoot} ${
        dragged ? styles.dragging : ""
      } ${selected ? styles.selectedNode : ""}`}
      data-hg-canvas-role="lore-faction"
      data-lore-kind="faction"
      data-lore-variant="v4"
      style={cardStyle}
    >
      {showTape ? (
        <ArchitecturalNodeTape
          rotationDeg={tapeRotation}
          variant={tapeVariant}
        />
      ) : null}
      {bodyHtmlImpliesFactionArchive091(bodyHtml) ? (
        <LoreFactionArchive091Slab
          bodyHtml={bodyHtml}
          editable={editable}
          emptyPlaceholder={emptyPlaceholder}
          factionRoster={factionRoster}
          nodeId={id}
          onCommit={(html) => onBodyCommit(id, html)}
          onDraftDirty={onBodyDraftDirty}
          onFactionRosterChange={
            onFactionRosterChange
              ? (nextRoster) => onFactionRosterChange(id, nextRoster)
              : undefined
          }
        />
      ) : (
        <ArchitecturalNodeBody
          className={styles.a4DocumentBody}
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
