import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

export type LayoutMap = Map<string, { x: number; y: number }>;

export type GraphEdgeHover = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  linkType: string | null;
  x: number;
  y: number;
};

export type CameraAction = "reset" | "frame-all" | "frame-selection";

export type GraphCanvasSharedProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: LayoutMap;
  worldWidth: number;
  worldHeight: number;
  blurEffectsEnabled?: boolean;
  selectedId: string | null;
  neighborIds: Set<string>;
  activeEdgeIds: Set<string>;
  degreeByNode?: Map<string, number>;
  cameraActionKey: number;
  cameraActionType: CameraAction;
  rightPanelOcclusionPx?: number;
  showStatsFooter?: boolean;
  enableNodeOverlayCard?: boolean;
  statsFooterLabel?: string;
  onSelect: (id: string | null) => void;
  onLayoutChange?: (next: LayoutMap) => void;
  onNodePin?: (id: string, position: { x: number; y: number }) => void;
  onEdgeHover?: (hover: GraphEdgeHover | null) => void;
  onEdgeSelect?: (edgeId: string | null) => void;
};
