import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

import type { GraphLayoutEdge, GraphLayoutNode } from "@/src/lib/graph-layout";

type SimNode = GraphLayoutNode &
  SimulationNodeDatum & {
    fx?: number | null;
    fy?: number | null;
    collisionRadius: number;
  };
type SimLink = SimulationLinkDatum<SimNode>;

export interface StableLayoutOptions {
  height?: number;
  pinned?: Map<string, { x: number; y: number }>;
  seed?: Map<string, { x: number; y: number }>;
  width?: number;
}

function hashFnv1a(input: string): number {
  let hash = 0x81_1c_9d_c5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01_00_01_93) >>> 0;
  }
  return hash >>> 0;
}

function fallbackEntityType(entityType: string | null): string {
  if (!entityType) {
    return "unknown";
  }
  return entityType;
}

export function entityTypeCentroid(
  entityType: string | null,
  width: number,
  height: number
): { x: number; y: number } {
  const key = fallbackEntityType(entityType);
  const xPad = width * 0.18;
  const yPad = height * 0.18;
  const xMid = width * 0.5;
  const yMid = height * 0.5;
  switch (key) {
    case "character":
      return { x: xPad, y: yPad };
    case "faction":
      return { x: width - xPad, y: yPad };
    case "location":
      return { x: xPad, y: height - yPad };
    case "note":
      return { x: width - xPad, y: height - yPad };
    default:
      return { x: xMid, y: yMid };
  }
}

function deterministicSeedPoint(
  node: GraphLayoutNode,
  width: number,
  height: number
): { x: number; y: number } {
  const anchor = entityTypeCentroid(node.entityType, width, height);
  const hA = hashFnv1a(`${node.id}:a`);
  const hR = hashFnv1a(`${node.id}:r`);
  const angle = (hA / 0xff_ff_ff_ff) * Math.PI * 2;
  const radius = 24 + (hR / 0xff_ff_ff_ff) * 120;
  return {
    x: anchor.x + Math.cos(angle) * radius,
    y: anchor.y + Math.sin(angle) * radius,
  };
}

function estimatedPillCollisionRadius(title: string): number {
  const visibleLen = Math.min(28, title.length);
  const estCharPx = 6.4; // 10px uppercase Geist sans + tracking
  const estWidth = Math.min(260, Math.max(64, visibleLen * estCharPx + 24));
  const estHeight = 28;
  const halfDiagonal = Math.hypot(estWidth / 2, estHeight / 2);
  return halfDiagonal + 10;
}

function resolveResidualOverlaps(
  simNodes: SimNode[],
  width: number,
  height: number,
  pinned: ReadonlySet<string>
): void {
  const pad = 36;
  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;
    for (let i = 0; i < simNodes.length; i += 1) {
      const a = simNodes[i]!;
      for (let j = i + 1; j < simNodes.length; j += 1) {
        const b = simNodes[j]!;
        const dx = (b.x ?? 0) - (a.x ?? 0);
        const dy = (b.y ?? 0) - (a.y ?? 0);
        const dist = Math.hypot(dx, dy) || 0.0001;
        const minDist = a.collisionRadius + b.collisionRadius;
        if (dist >= minDist) {
          continue;
        }
        moved = true;
        const overlap = minDist - dist;
        const ux = dx / dist;
        const uy = dy / dist;
        const aPinned = pinned.has(a.id);
        const bPinned = pinned.has(b.id);
        if (aPinned && bPinned) {
          continue;
        }
        if (aPinned) {
          b.x = (b.x ?? 0) + ux * overlap;
          b.y = (b.y ?? 0) + uy * overlap;
        } else if (bPinned) {
          a.x = (a.x ?? 0) - ux * overlap;
          a.y = (a.y ?? 0) - uy * overlap;
        } else {
          a.x = (a.x ?? 0) - ux * overlap * 0.5;
          a.y = (a.y ?? 0) - uy * overlap * 0.5;
          b.x = (b.x ?? 0) + ux * overlap * 0.5;
          b.y = (b.y ?? 0) + uy * overlap * 0.5;
        }
      }
    }
    for (const node of simNodes) {
      node.x = Math.min(width - pad, Math.max(pad, node.x ?? width / 2));
      node.y = Math.min(height - pad, Math.max(pad, node.y ?? height / 2));
    }
    if (!moved) {
      break;
    }
  }
}

export function computeStableLayout(
  nodes: GraphLayoutNode[],
  edges: GraphLayoutEdge[],
  options: StableLayoutOptions = {}
): Map<string, { x: number; y: number }> {
  const width = options.width ?? 1000;
  const height = options.height ?? 1000;
  const cx = width / 2;
  const cy = height / 2;
  const out = new Map<string, { x: number; y: number }>();

  if (nodes.length === 0) {
    return out;
  }
  if (nodes.length === 1) {
    const node = nodes[0]!;
    const pinned = options.pinned?.get(node.id);
    const seeded = options.seed?.get(node.id);
    const base =
      pinned ?? seeded ?? deterministicSeedPoint(node, width, height);
    out.set(node.id, {
      x: Math.min(width - 36, Math.max(36, base.x)),
      y: Math.min(height - 36, Math.max(36, base.y)),
    });
    return out;
  }

  const byId = new Map<string, SimNode>();
  const pinnedIds = new Set(options.pinned?.keys() ?? []);
  const simNodes: SimNode[] = nodes.map((node) => {
    const pinned = options.pinned?.get(node.id);
    const seeded = options.seed?.get(node.id);
    const deterministic = deterministicSeedPoint(node, width, height);
    const start = pinned ?? seeded ?? deterministic;
    const simNode: SimNode = {
      ...node,
      collisionRadius: estimatedPillCollisionRadius(node.title),
      fx: pinned?.x ?? null,
      fy: pinned?.y ?? null,
      x: start.x,
      y: start.y,
    };
    byId.set(node.id, simNode);
    return simNode;
  });

  const linkData: SimLink[] = edges
    .map((edge) => {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!(source && target)) {
        return null;
      }
      return { source, target } as SimLink;
    })
    .filter((value): value is SimLink => value !== null);

  const sim = forceSimulation<SimNode, SimLink>(simNodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(linkData)
        .distance((link) => {
          const source = link.source as SimNode;
          const target = link.target as SimNode;
          return Math.max(
            96,
            source.collisionRadius + target.collisionRadius + 18
          );
        })
        .strength(0.24)
    )
    .force("charge", forceManyBody<SimNode>().strength(-210))
    .force(
      "collide",
      forceCollide<SimNode>()
        .radius((node) => node.collisionRadius)
        .strength(0.92)
    )
    .force(
      "anchorX",
      forceX<SimNode>(
        (node) => entityTypeCentroid(node.entityType, width, height).x
      ).strength(0.1)
    )
    .force(
      "anchorY",
      forceY<SimNode>(
        (node) => entityTypeCentroid(node.entityType, width, height).y
      ).strength(0.1)
    )
    .force("globalX", forceX<SimNode>(cx).strength(0.015))
    .force("globalY", forceY<SimNode>(cy).strength(0.015))
    .alphaDecay(0.026)
    .velocityDecay(0.45);

  sim.stop();
  for (let i = 0; i < 420; i += 1) {
    sim.tick();
  }
  resolveResidualOverlaps(simNodes, width, height, pinnedIds);

  const pad = 36;
  for (const node of simNodes) {
    const x = Math.min(width - pad, Math.max(pad, node.x ?? cx));
    const y = Math.min(height - pad, Math.max(pad, node.y ?? cy));
    out.set(node.id, { x, y });
  }
  return out;
}
