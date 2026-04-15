import type { JSONContent } from "@tiptap/core";

import type { FolderColorSchemeId } from "@/src/components/foundation/architectural-folder-schemes";

export type ContentTheme = "default" | "code" | "task" | "media";

/** Lore canvas nodes: stored as `note` rows with `entity_type` + `hgArch.loreCard`. */
export type LoreCardKind = "character" | "faction" | "location";
/** Faction: v1–v3. Location: v2–v3 (legacy), v7 ORDO slab (canonical). Character: v11 only. */
export type LoreCardVariant = "v1" | "v2" | "v3" | "v7" | "v11";
export type LoreCard = { kind: LoreCardKind; variant: LoreCardVariant };

export type NodeTheme = ContentTheme | "folder" | LoreCardKind;

export type { FolderColorSchemeId };
export type CanvasTool = "select" | "pan";
export type TapeVariant = "clear" | "masking" | "dark";

export type EntitySpatialSlot = {
  x: number;
  y: number;
};

export type CanvasConnectionPin = {
  anchor: "topLeftInset";
  insetX: number;
  insetY: number;
};

export type CanvasConnectionSyncState = "local-only" | "syncing" | "synced" | "error";

export type CanvasEntityBase = {
  id: string;
  title: string;
  rotation: number;
  width?: number;
  /** Rendered card height in world px when known (DB `items.height` or measured layout). */
  height?: number;
  tapeRotation: number;
  slots: Record<string, EntitySpatialSlot>;
  /** Optional DB item id used for dual-write link persistence. */
  persistedItemId?: string | null;
  stackId?: string | null;
  stackOrder?: number | null;
  /** Mirrors `items.entity_meta` (import signals, AI review flags, etc.). */
  entityMeta?: Record<string, unknown> | null;
};

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
};

export type CanvasFolderEntity = CanvasEntityBase & {
  kind: "folder";
  theme: "folder";
  childSpaceId: string;
  /** Canvas folder face tint; omit for shell default palette. */
  folderColorScheme?: FolderColorSchemeId;
};

export type CanvasEntity = CanvasContentEntity | CanvasFolderEntity;

export type CanvasSpace = {
  id: string;
  name: string;
  parentSpaceId: string | null;
  entityIds: string[];
};

export type CanvasPinConnection = {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourcePin: CanvasConnectionPin;
  targetPin: CanvasConnectionPin;
  color: string;
  /** Rope slack multiplier. 1.0 = taut, higher = looser. Stored in `item_links.meta.slackMultiplier`; default constant in `item-link-meta.ts`. */
  slackMultiplier?: number;
  createdAt: number;
  updatedAt: number;
  dbLinkId?: string | null;
  syncState?: CanvasConnectionSyncState;
  syncError?: string | null;
  /** Mirrors `item_links.link_type` (pin, ally, quest, …). */
  linkType?: string;
};

export type CanvasGraph = {
  rootSpaceId: string;
  spaces: Record<string, CanvasSpace>;
  entities: Record<string, CanvasEntity>;
  connections: Record<string, CanvasPinConnection>;
};

/** UI label for the graph root in breadcrumbs, command palette paths, etc. */
export const ROOT_SPACE_DISPLAY_NAME = "Root";

// Backward-compatible shape for isolated node stories.
export type CanvasNode = Omit<CanvasContentEntity, "kind" | "slots"> & {
  x: number;
  y: number;
};

export type DockFormatAction = {
  id: string;
  label: string;
  command: string;
  value?: string;
  active?: boolean;
  disabled?: boolean;
};

export type DockCreateAction = {
  id: string;
  label: string;
  nodeType: NodeTheme;
};

/** Inline canvas body commits — HTML lore/code/media vs hgDoc default/task. */
export type CanvasBodyCommitPayload =
  | { kind: "html"; html: string }
  | { kind: "hgDoc"; doc: JSONContent };

/** Bottom dock: frosted glass on canvas vs solid black in focus editor. */
export type ArchitecturalBottomDockVariant = "canvas" | "editor";
