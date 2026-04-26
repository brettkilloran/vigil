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

import { estimatePillGeometry } from "@/src/lib/entity-graph-pill-geometry";
import type { GraphLayoutEdge, GraphLayoutNode } from "@/src/lib/graph-layout";

type SimNode = GraphLayoutNode &
  SimulationNodeDatum & {
    fx?: number | null;
    fy?: number | null;
    collisionRadius: number;
  };
type SimLink = SimulationLinkDatum<SimNode>;

export type StableLayoutOptions = {
  width?: number;
  height?: number;
  seed?: Map<string, { x: number; y: number }>;
  pinned?: Map<string, { x: number; y: number }>;
};

function hashFnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function fallbackEntityType(entityType: string | null): string {
  if (!entityType) return "unknown";
  return entityType;
}

export function entityTypeCentroid(
  entityType: string | null,
  width: number,
  height: number,
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
  height: number,
): { x: number; y: number } {
  const anchor = entityTypeCentroid(node.entityType, width, height);
  const hA = hashFnv1a(`${node.id}:a`);
  const hR = hashFnv1a(`${node.id}:r`);
  const angle = (hA / 0xffffffff) * Math.PI * 2;
  const radius = 24 + ((hR / 0xffffffff) * 120);
  return {
    x: anchor.x + Math.cos(angle) * radius,
    y: anchor.y + Math.sin(angle) * radius,
  };
}

function organicSeedPoint(
  node: GraphLayoutNode,
  width: number,
  height: number,
): { x: number; y: number } {
  const anchor = entityTypeCentroid(node.entityType, width, height);
  const angle = Math.random() * Math.PI * 2;
  const radius = 48 + Math.random() * Math.min(width, height) * 0.2;
  return {
    x: anchor.x + Math.cos(angle) * radius,
    y: anchor.y + Math.sin(angle) * radius,
  };
}

function resolveResidualOverlaps(
  simNodes: SimNode[],
  width: number,
  height: number,
  pinned: ReadonlySet<string>,
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
        if (dist >= minDist) continue;
        moved = true;
        const overlap = minDist - dist;
        const ux = dx / dist;
        const uy = dy / dist;
        const aPinned = pinned.has(a.id);
        const bPinned = pinned.has(b.id);
        if (aPinned && bPinned) continue;
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
    if (!moved) break;
  }
}

export function computeStableLayout(
  nodes: GraphLayoutNode[],
  edges: GraphLayoutEdge[],
  options: StableLayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const width = options.width ?? 1000;
  const height = options.height ?? 1000;
  const cx = width / 2;
  const cy = height / 2;
  const out = new Map<string, { x: number; y: number }>();

  if (nodes.length === 0) return out;
  if (nodes.length === 1) {
    const node = nodes[0]!;
    const pinned = options.pinned?.get(node.id);
    const seeded = options.seed?.get(node.id);
    const base = pinned ?? seeded ?? deterministicSeedPoint(node, width, height);
    out.set(node.id, {
      x: Math.min(width - 36, Math.max(36, base.x)),
      y: Math.min(height - 36, Math.max(36, base.y)),
    });
    return out;
  }

  const byId = new Map<string, SimNode>();
  const pinnedIds = new Set(options.pinned?.keys() ?? []);
  const shouldUseDeterministicSeeds = nodes.length < 400;
  const simNodes: SimNode[] = nodes.map((node) => {
    const pinned = options.pinned?.get(node.id);
    const seeded = options.seed?.get(node.id);
    const organic = organicSeedPoint(node, width, height);
    const deterministic = deterministicSeedPoint(node, width, height);
    const start = pinned ?? seeded ?? (shouldUseDeterministicSeeds ? deterministic : organic);
    const simNode: SimNode = {
      ...node,
      x: start.x,
      y: start.y,
      fx: pinned?.x ?? null,
      fy: pinned?.y ?? null,
      collisionRadius: estimatePillGeometry(node.title).collisionRadius,
    };
    byId.set(node.id, simNode);
    return simNode;
  });

  const linkData: SimLink[] = edges
    .map((edge) => {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) return null;
      return { source, target } as SimLink;
    })
    .filter((value): value is SimLink => value !== null);

  const largeGraph = nodes.length >= 1200;
  const linkDistanceBoost = largeGraph ? 1.3 : 1;
  const chargeStrength = largeGraph
    ? -Math.min(520, 260 + nodes.length * 0.018)
    : -210;
  const linkStrength = largeGraph ? 0.15 : 0.24;
  const collideStrength = largeGraph ? 0.84 : 0.92;
  const anchorStrength = largeGraph ? 0.04 : 0.1;
  const globalStrength = largeGraph ? 0.008 : 0.015;
  const tickCount = largeGraph ? 360 : 420;

  const sim = forceSimulation<SimNode, SimLink>(simNodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(linkData)
        .distance((link) => {
          const source = link.source as SimNode;
          const target = link.target as SimNode;
          return (
            Math.max(112, source.collisionRadius + target.collisionRadius + 24) *
            linkDistanceBoost
          );
        })
        .strength(linkStrength),
    )
    .force("charge", forceManyBody<SimNode>().strength(chargeStrength))
    .force(
      "collide",
      forceCollide<SimNode>()
        .radius((node) => node.collisionRadius)
        .strength(collideStrength),
    )
    .force(
      "anchorX",
      forceX<SimNode>((node) => entityTypeCentroid(node.entityType, width, height).x).strength(
        anchorStrength,
      ),
    )
    .force(
      "anchorY",
      forceY<SimNode>((node) => entityTypeCentroid(node.entityType, width, height).y).strength(
        anchorStrength,
      ),
    )
    .force("globalX", forceX<SimNode>(cx).strength(globalStrength))
    .force("globalY", forceY<SimNode>(cy).strength(globalStrength))
    .alphaDecay(largeGraph ? 0.028 : 0.026)
    .velocityDecay(largeGraph ? 0.5 : 0.45);

  sim.stop();
  for (let i = 0; i < tickCount; i += 1) sim.tick();
  if (simNodes.length <= 2500) {
    resolveResidualOverlaps(simNodes, width, height, pinnedIds);
  }

  const pad = 36;
  for (const node of simNodes) {
    const x = Math.min(width - pad, Math.max(pad, node.x ?? cx));
    const y = Math.min(height - pad, Math.max(pad, node.y ?? cy));
    out.set(node.id, { x, y });
  }
  return out;
}
