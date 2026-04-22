"use client";

import type { CSSProperties } from "react";

import type { CanvasTool, TapeVariant } from "@/src/components/foundation/architectural-types";
import type { WikiLinkAssistConfig } from "@/src/components/editing/BufferedContentEditable";
import { ArchitecturalNodeTape } from "@/src/components/foundation/ArchitecturalNodeCard";
import { LoreFactionArchive091Slab } from "@/src/components/foundation/LoreFactionArchive091Slab";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { bodyHtmlImpliesFactionArchive091 } from "@/src/lib/lore-faction-archive-html";
import type { FactionRosterEntry } from "@/src/lib/faction-roster-schema";
import {
  ArchitecturalNodeBody,
} from "@/src/components/foundation/ArchitecturalNodeCard";

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
  const nodeWidth = Math.min(width ?? MAX_ENTITY_CARD_WIDTH, MAX_ENTITY_CARD_WIDTH);
  const cardStyle = {
    width: `${nodeWidth}px`,
    "--entity-width": `${nodeWidth}px`,
  } as CSSProperties;

  const editable = bodyEditable ?? activeTool === "select";

  return (
    <div
      className={`${styles.entityNode} ${styles.loreFactionArchiveCanvasRoot} ${
        dragged ? styles.dragging : ""
      } ${selected ? styles.selectedNode : ""}`}
      style={cardStyle}
      data-hg-canvas-role="lore-faction"
      data-lore-kind="faction"
      data-lore-variant="v4"
    >
      {showTape ? (
        <ArchitecturalNodeTape variant={tapeVariant} rotationDeg={tapeRotation} />
      ) : null}
      {bodyHtmlImpliesFactionArchive091(bodyHtml) ? (
        <LoreFactionArchive091Slab
          nodeId={id}
          bodyHtml={bodyHtml}
          factionRoster={factionRoster}
          editable={editable}
          onFactionRosterChange={
            onFactionRosterChange ? (nextRoster) => onFactionRosterChange(id, nextRoster) : undefined
          }
          onCommit={(html) => onBodyCommit(id, html)}
          onDraftDirty={onBodyDraftDirty}
          emptyPlaceholder={emptyPlaceholder}
        />
      ) : (
        <ArchitecturalNodeBody
          nodeId={id}
          documentVariant="html"
          html={bodyHtml}
          className={styles.a4DocumentBody}
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
