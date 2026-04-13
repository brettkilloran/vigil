import type {
  CanvasConnectionPin,
  CanvasEntity,
  CanvasGraph,
  CanvasPinConnection,
} from "@/src/components/foundation/architectural-types";
import type { GraphEdge } from "@/src/lib/graph-types";
import { resolveSlackMultiplierForDisplay } from "@/src/lib/item-link-meta";

function shallowCloneGraph(graph: CanvasGraph): CanvasGraph {
  return {
    ...graph,
    spaces: { ...graph.spaces },
    entities: { ...graph.entities },
    connections: { ...graph.connections },
  };
}

/** Parse `item_links.source_pin` / `target_pin` written by the canvas (`anchor:insetX:insetY`). */
export function parseItemLinkPinString(
  raw: string | null | undefined,
  fallback: CanvasConnectionPin,
): CanvasConnectionPin {
  if (!raw || typeof raw !== "string") return fallback;
  const parts = raw.split(":");
  if (parts.length >= 3 && parts[0] === "topLeftInset") {
    const insetX = Number(parts[1]);
    const insetY = Number(parts[2]);
    if (Number.isFinite(insetX) && Number.isFinite(insetY)) {
      return { anchor: "topLeftInset", insetX, insetY };
    }
  }
  return fallback;
}

const NEON_LINK_PREFIX = "neon-link-";

function resolveEntityForGraphEdge(graph: CanvasGraph, itemId: string): CanvasEntity | undefined {
  const direct = graph.entities[itemId];
  if (direct) return direct;
  for (const e of Object.values(graph.entities)) {
    if (e.persistedItemId === itemId) return e;
  }
  return undefined;
}

/**
 * Replace server-backed connections with edges from `GET /api/spaces/:id/graph`,
 * while preserving purely local threads (`dbLinkId` unset).
 */
export function mergeHydratedDbConnections(
  graph: CanvasGraph,
  edges: GraphEdge[],
  opts: {
    defaultFolderPin: CanvasConnectionPin;
    defaultContentPin: CanvasConnectionPin;
    fallbackColor: string;
  },
): CanvasGraph {
  const next = shallowCloneGraph(graph);
  const merged: Record<string, CanvasPinConnection> = {};
  for (const [id, c] of Object.entries(next.connections)) {
    if (!c.dbLinkId && !id.startsWith(NEON_LINK_PREFIX)) {
      merged[id] = c;
    }
  }

  const now = Date.now();
  for (const edge of edges) {
    const src = resolveEntityForGraphEdge(graph, edge.source);
    const tgt = resolveEntityForGraphEdge(graph, edge.target);
    if (!src || !tgt) continue;

    const srcFallback = src.kind === "folder" ? opts.defaultFolderPin : opts.defaultContentPin;
    const tgtFallback = tgt.kind === "folder" ? opts.defaultFolderPin : opts.defaultContentPin;
    const sourcePin = parseItemLinkPinString(edge.sourcePin, srcFallback);
    const targetPin = parseItemLinkPinString(edge.targetPin, tgtFallback);

    const connectionId = `${NEON_LINK_PREFIX}${edge.id}`;
    const slackMultiplier = resolveSlackMultiplierForDisplay(edge.slackMultiplier);
    merged[connectionId] = {
      id: connectionId,
      sourceEntityId: src.id,
      targetEntityId: tgt.id,
      sourcePin,
      targetPin,
      color: edge.color ?? opts.fallbackColor,
      slackMultiplier,
      createdAt: now,
      updatedAt: now,
      dbLinkId: edge.id,
      syncState: "synced",
      syncError: null,
      linkType: edge.linkType ?? "pin",
    };
  }

  next.connections = merged;
  return next;
}
