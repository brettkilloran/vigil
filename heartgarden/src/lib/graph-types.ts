export interface GraphNode {
  entityType: string | null;
  external?: boolean;
  foreignSpaceId?: string | null;
  id: string;
  itemType: string;
  title: string;
}

export interface GraphEdge {
  color: string | null;
  id: string;
  linkType: string | null;
  /** From `item_links.meta.slackMultiplier` when present (rope taut/loose). */
  slackMultiplier?: number | null;
  source: string;
  sourcePin: string | null;
  target: string;
  targetPin: string | null;
}

export interface SpaceGraphResponse {
  edges?: GraphEdge[];
  error?: string;
  itemLinksRevision?: string;
  nodes?: GraphNode[];
  ok?: boolean;
}
