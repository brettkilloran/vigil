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
  linkType: string | null;
  /** From `item_links.meta.slackMultiplier` when present (rope taut/loose). */
  slackMultiplier?: number | null;
};

export type SpaceGraphResponse = {
  ok?: boolean;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  itemLinksRevision?: string;
  error?: string;
};
