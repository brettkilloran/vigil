export type GraphNode = {
  id: string;
  title: string;
  itemType: string;
  entityType: string | null;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  color: string | null;
  sourcePin: string | null;
  targetPin: string | null;
};

export type SpaceGraphResponse = {
  ok?: boolean;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  error?: string;
};
