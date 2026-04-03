export type ContentTheme = "default" | "code" | "task" | "media";
export type NodeTheme = ContentTheme | "folder";
export type CanvasTool = "select" | "pan";
export type TapeVariant = "clear" | "masking" | "dark";

export type EntitySpatialSlot = {
  x: number;
  y: number;
};

export type CanvasEntityBase = {
  id: string;
  title: string;
  rotation: number;
  width?: number;
  tapeRotation: number;
  slots: Record<string, EntitySpatialSlot>;
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
};

export type CanvasEntity = CanvasContentEntity | CanvasFolderEntity;

export type CanvasSpace = {
  id: string;
  name: string;
  parentSpaceId: string | null;
  entityIds: string[];
};

export type CanvasGraph = {
  rootSpaceId: string;
  spaces: Record<string, CanvasSpace>;
  entities: Record<string, CanvasEntity>;
};

// Backward-compatible shape for isolated node stories.
export type CanvasNode = {
  id: string;
  title: string;
  x: number;
  y: number;
  rotation: number;
  width?: number;
  theme: ContentTheme;
  tapeRotation: number;
  tapeVariant?: TapeVariant;
  bodyHtml: string;
};

export type DockFormatAction = {
  id: string;
  label: string;
  command: string;
  value?: string;
};

export type DockCreateAction = {
  id: string;
  label: string;
  nodeType: NodeTheme;
};
