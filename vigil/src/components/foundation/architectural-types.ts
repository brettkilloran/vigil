export type NodeTheme = "default" | "code" | "task" | "media";
export type CanvasTool = "select" | "pan";

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
