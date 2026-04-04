import type { FolderColorSchemeId } from "@/src/components/foundation/architectural-folder-schemes";

export type ContentTheme = "default" | "code" | "task" | "media";
export type NodeTheme = ContentTheme | "folder";

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
  tapeRotation: number;
  slots: Record<string, EntitySpatialSlot>;
  /** Optional DB item id used for dual-write link persistence. */
  persistedItemId?: string | null;
  stackId?: string | null;
  stackOrder?: number | null;
};

export type CanvasContentEntity = CanvasEntityBase & {
  kind: "content";
  theme: ContentTheme;
  tapeVariant?: TapeVariant;
  bodyHtml: string;
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
  /** Rope slack multiplier. 1.0 = taut, higher = looser. */
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

/** Bottom dock: frosted glass on canvas vs solid black in focus editor. */
export type ArchitecturalBottomDockVariant = "canvas" | "editor";
