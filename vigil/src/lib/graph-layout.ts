import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

export type GraphLayoutNode = {
  id: string;
  title: string;
  itemType: string;
  entityType: string | null;
};

export type GraphLayoutEdge = { source: string; target: string };

type SimNode = GraphLayoutNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode>;

/**
 * d3-force layout in [0,width]×[0,height] (matches SVG viewBox).
 */
export function computeForceLayout(
  nodes: GraphLayoutNode[],
  edges: GraphLayoutEdge[],
  width = 1000,
  height = 1000,
): Map<string, { x: number; y: number }> {
  const cx = width / 2;
  const cy = height / 2;
  const out = new Map<string, { x: number; y: number }>();

  if (nodes.length === 0) return out;
  if (nodes.length === 1) {
    out.set(nodes[0]!.id, { x: cx, y: cy });
    return out;
  }

  const byId = new Map<string, SimNode>();
  const simNodes: SimNode[] = nodes.map((n, i) => {
    const a = (2 * Math.PI * i) / nodes.length;
    const sn: SimNode = {
      ...n,
      x: cx + Math.cos(a) * 140,
      y: cy + Math.sin(a) * 140,
    };
    byId.set(n.id, sn);
    return sn;
  });

  const linkData: SimLink[] = edges
    .map((e) => {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) return null;
      return { source: s, target: t } as SimLink;
    })
    .filter((x): x is SimLink => x != null);

  const sim = forceSimulation<SimNode, SimLink>(simNodes)
    .force("link", forceLink<SimNode, SimLink>(linkData).distance(100))
    .force("charge", forceManyBody<SimNode>().strength(-280))
    .force("center", forceCenter(cx, cy))
    .force("collide", forceCollide<SimNode>().radius(40))
    .alphaDecay(0.02)
    .velocityDecay(0.35);

  sim.stop();
  for (let i = 0; i < 520; i++) sim.tick();

  const pad = 36;
  for (const n of simNodes) {
    const x = Math.min(width - pad, Math.max(pad, n.x ?? cx));
    const y = Math.min(height - pad, Math.max(pad, n.y ?? cy));
    out.set(n.id, { x, y });
  }
  return out;
}
