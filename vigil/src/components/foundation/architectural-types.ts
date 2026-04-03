export type NodeTheme = "default" | "code" | "task" | "media";
export type CanvasTool = "select" | "pan";
export type TapeVariant = "clear" | "masking" | "dark";

export type CanvasNode = {
  id: string;
  title: string;
  x: number;
  y: number;
  rotation: number;
  width?: number;
  theme: NodeTheme;
  tapeRotation: number;
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
