import type { JSONContent } from "@tiptap/core";

import type { FolderColorSchemeId } from "@/src/components/foundation/architectural-folder-schemes";
import type { FactionRosterEntry } from "@/src/lib/faction-roster-schema";

export type ContentTheme = "default" | "code" | "task" | "media";

/** Lore canvas nodes: stored as `note` rows with `entity_type` + `hgArch.loreCard`. */
export type LoreCardKind = "character" | "faction" | "location";
/** Faction: v4 Archive-091 (canonical). Location: v2–v3 (legacy), v7 ORDO slab. Character: v11 only. */
export type LoreCardVariant = "v1" | "v2" | "v3" | "v4" | "v7" | "v11";
export interface LoreCard {
  kind: LoreCardKind;
  variant: LoreCardVariant;
}

/**
 * Semantic canvas thread anchors persisted under `content_json.hgArch.loreThreadAnchors`.
 * Character cards use primary* fields; location cards use `linkedCharacterItemIds`.
 */
export interface LoreCanvasThreadAnchors {
  linkedCharacterItemIds?: string[];
  primaryFactionItemId?: string;
  primaryFactionRosterEntryId?: string;
  primaryLocationItemId?: string;
}

export type NodeTheme = ContentTheme | "folder" | LoreCardKind;

export type { FolderColorSchemeId } from "@/src/components/foundation/architectural-folder-schemes";
export type CanvasTool = "select" | "pan";
export type TapeVariant = "clear" | "masking" | "dark";

export interface EntitySpatialSlot {
  x: number;
  y: number;
}

export interface CanvasConnectionPin {
  anchor: "topLeftInset";
  insetX: number;
  insetY: number;
}

export type CanvasConnectionSyncState =
  | "local-only"
  | "syncing"
  | "synced"
  | "error";

export interface CanvasEntityBase {
  /** Mirrors `items.entity_meta` (import signals, AI review flags, etc.). */
  entityMeta?: Record<string, unknown> | null;
  /** Rendered card height in world px when known (DB `items.height` or measured layout). */
  height?: number;
  id: string;
  /** Optional DB item id used for dual-write link persistence. */
  persistedItemId?: string | null;
  rotation: number;
  slots: Record<string, EntitySpatialSlot>;
  stackId?: string | null;
  stackOrder?: number | null;
  tapeRotation: number;
  title: string;
  width?: number;
}

export type CanvasContentEntity = CanvasEntityBase & {
  kind: "content";
  theme: ContentTheme;
  tapeVariant?: TapeVariant;
  bodyHtml: string;
  /**
   * TipTap document for default/task prose cards (persisted as `content_json.format === "hgDoc"`).
   * Omitted for HTML-only bodies (code, media, lore templates).
   */
  bodyDoc?: JSONContent | null;
  /** When set, card chrome + `entity_type` on sync; body uses shared lore templates. */
  loreCard?: LoreCard;
  /** From `content_json.hgArch.factionRoster` when present (faction lore cards). */
  factionRoster?: FactionRosterEntry[];
  /** From `content_json.hgArch.loreThreadAnchors` — semantic thread / autofill hints. */
  loreThreadAnchors?: LoreCanvasThreadAnchors;
};

export type CanvasFolderEntity = CanvasEntityBase & {
  kind: "folder";
  theme: "folder";
  childSpaceId: string;
  /** Canvas folder face tint; omit for shell default palette. */
  folderColorScheme?: FolderColorSchemeId;
};

export type CanvasEntity = CanvasContentEntity | CanvasFolderEntity;

export interface CanvasSpace {
  entityIds: string[];
  id: string;
  name: string;
  parentSpaceId: string | null;
}

export interface CanvasPinConnection {
  color: string;
  createdAt: number;
  dbLinkId?: string | null;
  id: string;
  /** Mirrors `item_links.link_type` (pin, ally, quest, …). */
  linkType?: string;
  /** Rope slack multiplier. 1.0 = taut, higher = looser. Stored in `item_links.meta.slackMultiplier`; default constant in `item-link-meta.ts`. */
  slackMultiplier?: number;
  sourceEntityId: string;
  sourcePin: CanvasConnectionPin;
  syncError?: string | null;
  syncState?: CanvasConnectionSyncState;
  targetEntityId: string;
  targetPin: CanvasConnectionPin;
  updatedAt: number;
}

export interface CanvasGraph {
  connections: Record<string, CanvasPinConnection>;
  entities: Record<string, CanvasEntity>;
  rootSpaceId: string;
  spaces: Record<string, CanvasSpace>;
}

/** UI label for the graph root in breadcrumbs, command palette paths, etc. */
export const ROOT_SPACE_DISPLAY_NAME = "Root";

// Backward-compatible shape for isolated node stories.
export type CanvasNode = Omit<CanvasContentEntity, "kind" | "slots"> & {
  x: number;
  y: number;
};

export interface DockFormatAction {
  active?: boolean;
  command: string;
  disabled?: boolean;
  id: string;
  label: string;
  value?: string;
}

export interface DockCreateAction {
  id: string;
  label: string;
  nodeType: NodeTheme;
}

/** Inline canvas body commits — HTML lore/code/media vs hgDoc default/task. */
export type CanvasBodyCommitPayload =
  | { kind: "html"; html: string }
  | { kind: "hgDoc"; doc: JSONContent };

/** Bottom dock: frosted glass on canvas vs solid black in focus editor. */
export type ArchitecturalBottomDockVariant = "canvas" | "editor";
