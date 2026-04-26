/// <reference lib="webworker" />

import {
  forceCollide,
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from "d3-force-3d";

import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

type Force3dMessage = {
  type: "solve-force3d";
  requestId: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  options?: {
    width?: number;
    height?: number;
    iterations?: number;
  };
};

type Force3dResponse = {
  type: "solved-force3d";
  requestId: number;
  ids: string[];
  positions: Float32Array;
};

type SimNode = SimulationNodeDatum & {
  id: string;
  z?: number;
};

function seededNoise(seed: number): number {
  let t = seed | 0;
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  t = t ^ (t >>> 16);
  return (t >>> 0) / 4294967296;
}

self.onmessage = (event: MessageEvent<Force3dMessage>) => {
  const message = event.data;
  if (message.type !== "solve-force3d") return;

  const width = message.options?.width ?? 3000;
  const height = message.options?.height ?? 3000;
  const iterations = message.options?.iterations ?? 260;

  const nodes: SimNode[] = message.nodes.map((node, idx) => {
    const u1 = seededNoise(idx * 92821 + 11);
    const u2 = seededNoise(idx * 68917 + 23);
    const u3 = seededNoise(idx * 17749 + 41);
    const theta = u1 * Math.PI * 2;
    const radius = Math.sqrt(u2) * (220 + Math.sqrt(Math.max(1, message.nodes.length)) * 34);
    const zSpread = 28 + Math.sqrt(Math.max(1, message.nodes.length)) * 1.8;
    return {
      id: node.id,
      x: Math.cos(theta) * radius,
      y: Math.sin(theta) * radius,
      z: (u3 - 0.5) * zSpread,
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const links = message.edges
    .map((edge) => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return null;
      return { source, target };
    })
    .filter((value): value is { source: SimNode; target: SimNode } => value !== null);

  const sim = forceSimulation<SimNode>(nodes)
    .force(
      "link",
      forceLink<SimNode, { source: SimNode; target: SimNode }>(links)
        .distance(68)
        .strength(0.34),
    )
    .force("charge", forceManyBody<SimNode>().strength(-68))
    .force("collide", forceCollide<SimNode>(10).strength(0.62).iterations(1))
    .force("center", forceCenter(0, 0))
    .alphaDecay(0.028)
    .velocityDecay(0.42);

  sim.stop();
  for (let i = 0; i < iterations; i += 1) {
    sim.tick();
  }

  const ids = nodes.map((node) => node.id);
  const out = new Float32Array(ids.length * 3);
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (!node) continue;
    const x = (node.x ?? 0) + width * 0.5;
    const y = (node.y ?? 0) + height * 0.5;
    const z = node.z ?? 0;
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }

  const response: Force3dResponse = {
    type: "solved-force3d",
    requestId: message.requestId,
    ids,
    positions: out,
  };
  self.postMessage(response, [out.buffer]);
};
