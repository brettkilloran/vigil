export type GraphNode = {
  id: string;
  title: string;
  itemType: string;
  entityType: string | null;
  external?: boolean;
  foreignSpaceId?: string | null;
  /**
   * Optional precomputed community/cluster hint used by force layouts and
   * downstream visuals. When two adjacent nodes share a hint the connecting
   * edge is treated as intra-cluster (short, firm spring); when hints differ
   * the edge is treated as a longer, softer bridge.
   */
  clusterHint?: string | null;
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
