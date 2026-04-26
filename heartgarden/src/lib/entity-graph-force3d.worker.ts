/// <reference lib="webworker" />

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force-3d";

import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

type SimStatus = "active" | "idle" | "frozen";

type InitMessage = {
  type: "init-sim";
  requestId: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  options?: {
    width?: number;
    height?: number;
    progressEvery?: number;
    alphaThreshold?: number;
    warmNodeThreshold?: number;
    initialTicks?: number;
  };
};

type ReheatMessage = {
  type: "reheat";
  requestId: number;
  alpha?: number;
  options?: {
    width?: number;
    height?: number;
  };
  addNodes?: GraphNode[];
  removeNodeIds?: string[];
  addEdges?: GraphEdge[];
  removeEdgeIds?: string[];
  updateNodes?: Array<Pick<GraphNode, "id" | "clusterHint">>;
  fixedNodes?: Array<{ id: string; x: number; y: number; z?: number; ttlTicks?: number }>;
  /** Node IDs in the focused cluster (selected + neighbors). Nodes in this set
   *  receive an expanded collision radius so the simulation spreads them apart
   *  enough for pill labels to be legible. Pass an empty array to reset. */
  focusNodeIds?: string[];
};

type StopMessage = {
  type: "stop";
  requestId: number;
};

type Force3dMessage = InitMessage | ReheatMessage | StopMessage;

type TickResponse = {
  type: "tick-force3d";
  requestId: number;
  ids: string[];
  positions: Float32Array;
};

type StatusResponse = {
  type: "status-force3d";
  requestId: number;
  status: SimStatus;
};

type Force3dResponse = TickResponse | StatusResponse;

type SimNode = SimulationNodeDatum & {
  id: string;
  z?: number;
  fz?: number | null;
  visualRadius: number;
  degree: number;
  clusterHint?: string | null;
  clusterTargetX?: number;
  clusterTargetY?: number;
};

type SimLink = {
  id: string;
  source: SimNode;
  target: SimNode;
  distance: number;
  strength: number;
};

type WorkerState = {
  requestId: number;
  sim: Simulation<SimNode, SimLink>;
  nodeMetaById: Map<string, GraphNode>;
  edgeMetaById: Map<string, GraphEdge>;
  nodes: SimNode[];
  links: SimLink[];
  nodeById: Map<string, SimNode>;
  width: number;
  height: number;
  progressEvery: number;
  alphaThreshold: number;
  warmNodeThreshold: number;
  status: SimStatus;
  tickCount: number;
  timer: ReturnType<typeof setTimeout> | null;
  pinTicksById: Map<string, number>;
  clusterCentroids: Map<string, { x: number; y: number }>;
  focusedNodeIds: Set<string>;
};

const FAST_TICK_MS = 16;
const IDLE_TICK_MS = 200;

const NODE_VISUAL_RADIUS = 6.4;
// Expanded collision radius applied to focused nodes (selected + neighbors) so
// the simulation pushes them far enough apart for pill labels to be readable.
// At DEFAULT_CAMERA_ZOOM (1.45), two nodes at this radius are ~150px apart,
// leaving room for a typical ~120px pill with a comfortable margin.
const NODE_FOCUS_VISUAL_RADIUS = 44;
const NODE_LABEL_MARGIN = 5.2;
const HUB_RADIUS_PER_EDGE = 0.32;
const HUB_RADIUS_CAP = 7.5;
const INTRA_CLUSTER_BASE_DISTANCE = 72;
const CROSS_CLUSTER_BASE_DISTANCE = 168;
const INTRA_CLUSTER_BASE_STRENGTH = 0.46;
const CROSS_CLUSTER_BASE_STRENGTH = 0.18;
const TIGHT_LINK_TYPES = new Set(["member_of", "operates_in", "trade_route"]);
const LOOSE_LINK_TYPES = new Set(["mentioned_in", "referenced_by", "cross_ref"]);

let state: WorkerState | null = null;

function seededNoise(seed: number): number {
  let t = seed | 0;
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  t = t ^ (t >>> 16);
  return (t >>> 0) / 4294967296;
}

function classifyLinkWeight(linkType: string | null | undefined): number {
  if (!linkType) return 1;
  if (TIGHT_LINK_TYPES.has(linkType)) return 0.78;
  if (LOOSE_LINK_TYPES.has(linkType)) return 1.22;
  return 1;
}

function resolveEdgeWeight(edge: GraphEdge): number {
  if (typeof edge.slackMultiplier === "number" && Number.isFinite(edge.slackMultiplier)) {
    return Math.max(0.6, Math.min(1.6, edge.slackMultiplier));
  }
  return classifyLinkWeight(edge.linkType);
}

function postStatus(requestId: number, status: SimStatus): void {
  const payload: StatusResponse = { type: "status-force3d", requestId, status };
  self.postMessage(payload);
}

function setStatus(next: SimStatus): void {
  if (!state) return;
  if (state.status === next) return;
  state.status = next;
  postStatus(state.requestId, next);
}

function clearTimer(): void {
  if (!state?.timer) return;
  clearTimeout(state.timer);
  state.timer = null;
}

function writePositions(): Float32Array {
  if (!state) return new Float32Array();
  const ids = state.nodes.map((node) => node.id);
  const out = new Float32Array(ids.length * 3);
  for (let i = 0; i < state.nodes.length; i += 1) {
    const node = state.nodes[i];
    if (!node) continue;
    const x = (node.x ?? 0) + state.width * 0.5;
    const y = (node.y ?? 0) + state.height * 0.5;
    const z = node.z ?? 0;
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}

function emitTick(): void {
  if (!state) return;
  const ids = state.nodes.map((node) => node.id);
  const positions = writePositions();
  const payload: TickResponse = {
    type: "tick-force3d",
    requestId: state.requestId,
    ids,
    positions,
  };
  self.postMessage(payload, [positions.buffer]);
}

function recomputeDegrees(): void {
  if (!state) return;
  const degreeById = new Map<string, number>();
  for (const edge of state.edgeMetaById.values()) {
    degreeById.set(edge.source, (degreeById.get(edge.source) ?? 0) + 1);
    degreeById.set(edge.target, (degreeById.get(edge.target) ?? 0) + 1);
  }
  for (const node of state.nodes) {
    node.degree = degreeById.get(node.id) ?? 0;
  }
}

function buildLinksFromMeta(): SimLink[] {
  if (!state) return [];
  const next: SimLink[] = [];
  for (const edge of state.edgeMetaById.values()) {
    const source = state.nodeById.get(edge.source);
    const target = state.nodeById.get(edge.target);
    if (!source || !target) continue;
    const sameCluster =
      source.clusterHint != null &&
      target.clusterHint != null &&
      source.clusterHint === target.clusterHint;
    const weight = resolveEdgeWeight(edge);
    const baseDistance = sameCluster ? INTRA_CLUSTER_BASE_DISTANCE : CROSS_CLUSTER_BASE_DISTANCE;
    const baseStrength = sameCluster ? INTRA_CLUSTER_BASE_STRENGTH : CROSS_CLUSTER_BASE_STRENGTH;
    const hubBoost = 1 + Math.min(0.35, Math.max(0, (source.degree + target.degree - 12) * 0.012));
    next.push({
      id: edge.id,
      source,
      target,
      distance: baseDistance * weight * hubBoost,
      strength: baseStrength * (sameCluster ? 1 : 1 / weight),
    });
  }
  return next;
}

function applyGraphToSimulation(): void {
  if (!state) return;
  recomputeDegrees();
  state.links = buildLinksFromMeta();
  state.sim.nodes(state.nodes);
  const linkForce = state.sim.force("link");
  if (linkForce) {
    (linkForce as ReturnType<typeof forceLink<SimNode, SimLink>>).links(state.links);
  }
}

function releaseExpiredPins(): void {
  if (!state || state.pinTicksById.size === 0) return;
  for (const [id, ticks] of state.pinTicksById.entries()) {
    const node = state.nodeById.get(id);
    if (!node) {
      state.pinTicksById.delete(id);
      continue;
    }
    const next = ticks - 1;
    if (next > 0) {
      state.pinTicksById.set(id, next);
      continue;
    }
    node.fx = null;
    node.fy = null;
    node.fz = null;
    state.pinTicksById.delete(id);
  }
}

function scheduleNextTick(ms: number): void {
  if (!state) return;
  clearTimer();
  state.timer = setTimeout(stepSimulation, ms);
}

function stepSimulation(): void {
  if (!state) return;
  state.sim.tick();
  state.tickCount += 1;
  releaseExpiredPins();

  const shouldEmit =
    state.tickCount % state.progressEvery === 0 ||
    state.sim.alpha() <= state.alphaThreshold;
  if (shouldEmit) emitTick();

  if (state.sim.alpha() <= state.alphaThreshold) {
    if (state.nodes.length > state.warmNodeThreshold) {
      setStatus("frozen");
      return;
    }
    setStatus("idle");
    scheduleNextTick(IDLE_TICK_MS);
    return;
  }

  setStatus("active");
  scheduleNextTick(FAST_TICK_MS);
}

function stopSimulation(): void {
  if (!state) return;
  clearTimer();
  state.sim.stop();
  state = null;
}

const GOLDEN_ANGLE = 2.399963229728653;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildSeededNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { simNodes: SimNode[]; centroids: Map<string, { x: number; y: number }> } {
  const degreeMap = new Map<string, number>();
  for (const edge of edges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
  }

  const clusterGroups = new Map<string, GraphNode[]>();
  const unclustered: GraphNode[] = [];
  for (const node of nodes) {
    const hint = node.clusterHint;
    if (hint) {
      let group = clusterGroups.get(hint);
      if (!group) {
        group = [];
        clusterGroups.set(hint, group);
      }
      group.push(node);
    } else {
      unclustered.push(node);
    }
  }

  const clusterKeys = [...clusterGroups.keys()];
  const clusterCount = clusterKeys.length;
  const orbitRadius = 160 + Math.sqrt(nodes.length) * 30;
  const centroids = new Map<string, { x: number; y: number }>();

  for (let i = 0; i < clusterCount; i++) {
    const angle = (i / Math.max(1, clusterCount)) * Math.PI * 2;
    const group = clusterGroups.get(clusterKeys[i]!)!;
    const sizeWeight = Math.sqrt(group.length / Math.max(1, nodes.length));
    const r = orbitRadius * (0.65 + sizeWeight * 0.7);
    centroids.set(clusterKeys[i]!, {
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    });
  }

  const zSpread = 28 + Math.sqrt(Math.max(1, nodes.length)) * 1.8;
  const result: SimNode[] = [];

  for (const [key, group] of clusterGroups) {
    const centroid = centroids.get(key)!;
    const sorted = [...group].sort(
      (a, b) => (degreeMap.get(b.id) ?? 0) - (degreeMap.get(a.id) ?? 0),
    );
    const clusterRadius = Math.max(36, Math.sqrt(group.length) * 16);
    const keyHash = hashString(key);

    for (let i = 0; i < sorted.length; i++) {
      const node = sorted[i]!;
      const t = i / Math.max(1, sorted.length - 1);
      const r = Math.sqrt(t) * clusterRadius;
      const angle = i * GOLDEN_ANGLE;
      const u3 = seededNoise(i * 17749 + 41 + keyHash);
      result.push({
        id: node.id,
        x: centroid.x + Math.cos(angle) * r,
        y: centroid.y + Math.sin(angle) * r,
        z: (u3 - 0.5) * zSpread,
        visualRadius: NODE_VISUAL_RADIUS,
        degree: degreeMap.get(node.id) ?? 0,
        clusterHint: node.clusterHint ?? null,
        clusterTargetX: centroid.x,
        clusterTargetY: centroid.y,
      });
    }
  }

  const orphans: GraphNode[] = [];
  const connectedUnclustered: GraphNode[] = [];
  for (const node of unclustered) {
    if ((degreeMap.get(node.id) ?? 0) === 0) {
      orphans.push(node);
    } else {
      connectedUnclustered.push(node);
    }
  }

  const connectedRadius = Math.max(60, Math.sqrt(connectedUnclustered.length) * 18);
  for (let i = 0; i < connectedUnclustered.length; i++) {
    const node = connectedUnclustered[i]!;
    const t = i / Math.max(1, connectedUnclustered.length - 1);
    const r = Math.sqrt(t) * connectedRadius;
    const angle = i * GOLDEN_ANGLE;
    const u3 = seededNoise(i * 17749 + 41);
    result.push({
      id: node.id,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      z: (u3 - 0.5) * zSpread,
      visualRadius: NODE_VISUAL_RADIUS,
      degree: degreeMap.get(node.id) ?? 0,
      clusterHint: node.clusterHint ?? null,
    });
  }

  const orphanRing = 180 + Math.sqrt(nodes.length) * 36;
  for (let i = 0; i < orphans.length; i++) {
    const node = orphans[i]!;
    const angle = i * GOLDEN_ANGLE;
    const jitter = seededNoise(i * 53731 + 7) * 30;
    const u3 = seededNoise(i * 17749 + 41 + 9999);
    result.push({
      id: node.id,
      x: Math.cos(angle) * (orphanRing + jitter),
      y: Math.sin(angle) * (orphanRing + jitter),
      z: (u3 - 0.5) * zSpread,
      visualRadius: NODE_VISUAL_RADIUS,
      degree: 0,
      clusterHint: node.clusterHint ?? null,
    });
  }

  return { simNodes: result, centroids };
}

function createSimulation(nodes: SimNode[], links: SimLink[]): Simulation<SimNode, SimLink> {
  const n = nodes.length;
  const baseCharge = n > 6000 ? -160 : n > 2000 ? -210 : -260;
  const orphanPerimeter = 180 + Math.sqrt(n) * 36;

  return forceSimulation<SimNode>(nodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((node) => node.id)
        .distance((link) => link.distance)
        .strength((link) => link.strength),
    )
    .force(
      "charge",
      forceManyBody<SimNode>()
        .strength((d) => (d.degree === 0 ? baseCharge * 3 : baseCharge))
        .theta(0.82)
        .distanceMax(1400),
    )
    .force(
      "collide",
      forceCollide<SimNode>(
        (node) =>
          node.visualRadius +
          NODE_LABEL_MARGIN + 2.4 +
          Math.min(HUB_RADIUS_CAP, Math.max(0, node.degree - 4) * HUB_RADIUS_PER_EDGE),
      )
        .strength(0.9)
        .iterations(3),
    )
    .force(
      "centerX",
      forceX<SimNode>(0).strength((d) => {
        if (d.degree === 0) return 0;
        if (d.clusterHint && d.clusterTargetX != null) return 0;
        return 0.012;
      }),
    )
    .force(
      "centerY",
      forceY<SimNode>(0).strength((d) => {
        if (d.degree === 0) return 0;
        if (d.clusterHint && d.clusterTargetY != null) return 0;
        return 0.012;
      }),
    )
    .force(
      "clusterX",
      forceX<SimNode>((d) => d.clusterTargetX ?? 0)
        .strength((d) => (d.clusterHint && d.clusterTargetX != null ? 0.07 : 0)),
    )
    .force(
      "clusterY",
      forceY<SimNode>((d) => d.clusterTargetY ?? 0)
        .strength((d) => (d.clusterHint && d.clusterTargetY != null ? 0.07 : 0)),
    )
    .force(
      "orphanRadial",
      forceRadial<SimNode>(orphanPerimeter, 0, 0)
        .strength((d) => (d.degree === 0 ? 0.09 : 0)),
    )
    .alphaDecay(0.016)
    .velocityDecay(0.38);
}

function applyReheat(message: ReheatMessage): void {
  if (!state) return;
  if (message.options?.width != null) state.width = message.options.width;
  if (message.options?.height != null) state.height = message.options.height;

  if (message.removeNodeIds?.length) {
    const toRemove = new Set(message.removeNodeIds);
    state.nodes = state.nodes.filter((node) => !toRemove.has(node.id));
    for (const id of message.removeNodeIds) {
      state.nodeById.delete(id);
      state.nodeMetaById.delete(id);
      state.pinTicksById.delete(id);
    }
    for (const [edgeId, edge] of state.edgeMetaById) {
      if (toRemove.has(edge.source) || toRemove.has(edge.target)) {
        state.edgeMetaById.delete(edgeId);
      }
    }
  }

  if (message.addNodes?.length) {
    const baseIndex = state.nodes.length;
    for (let i = 0; i < message.addNodes.length; i += 1) {
      const graphNode = message.addNodes[i];
      if (!graphNode || state.nodeById.has(graphNode.id)) continue;
      const idx = baseIndex + i;
      const hint = graphNode.clusterHint ?? null;
      const centroid = hint ? state.clusterCentroids.get(hint) : null;
      const u3 = seededNoise(idx * 17749 + 41);
      let px: number;
      let py: number;
      if (centroid) {
        const jitter = 40 + Math.sqrt(state.nodes.length) * 2;
        px = centroid.x + (seededNoise(idx * 92821 + 11) - 0.5) * jitter;
        py = centroid.y + (seededNoise(idx * 68917 + 23) - 0.5) * jitter;
      } else {
        const theta = seededNoise(idx * 92821 + 11) * Math.PI * 2;
        const radius = Math.sqrt(seededNoise(idx * 68917 + 23)) * 300;
        px = Math.cos(theta) * radius;
        py = Math.sin(theta) * radius;
      }
      const simNode: SimNode = {
        id: graphNode.id,
        x: px,
        y: py,
        z: (u3 - 0.5) * 24,
        visualRadius: NODE_VISUAL_RADIUS,
        degree: 0,
        clusterHint: hint,
        clusterTargetX: centroid?.x,
        clusterTargetY: centroid?.y,
      };
      state.nodes.push(simNode);
      state.nodeById.set(simNode.id, simNode);
      state.nodeMetaById.set(simNode.id, graphNode);
    }
  }

  if (message.updateNodes?.length) {
    for (const update of message.updateNodes) {
      const node = state.nodeById.get(update.id);
      if (!node) continue;
      if (update.clusterHint !== undefined) node.clusterHint = update.clusterHint;
      const previous = state.nodeMetaById.get(update.id);
      if (previous) {
        state.nodeMetaById.set(update.id, { ...previous, ...update });
      }
    }
  }

  if (message.removeEdgeIds?.length) {
    for (const id of message.removeEdgeIds) state.edgeMetaById.delete(id);
  }
  if (message.addEdges?.length) {
    for (const edge of message.addEdges) state.edgeMetaById.set(edge.id, edge);
  }

  if (message.fixedNodes?.length) {
    for (const fixed of message.fixedNodes) {
      const node = state.nodeById.get(fixed.id);
      if (!node) continue;
      node.fx = fixed.x - state.width * 0.5;
      node.fy = fixed.y - state.height * 0.5;
      node.fz = fixed.z ?? node.z ?? 0;
      state.pinTicksById.set(fixed.id, Math.max(1, fixed.ttlTicks ?? 40));
    }
  }

  if (message.focusNodeIds !== undefined) {
    // Reset previously focused nodes back to the default visual radius.
    for (const id of state.focusedNodeIds) {
      const node = state.nodeById.get(id);
      if (node) node.visualRadius = NODE_VISUAL_RADIUS;
    }
    state.focusedNodeIds = new Set(message.focusNodeIds);
    // Apply expanded radius so the collision force spreads these nodes apart.
    for (const id of state.focusedNodeIds) {
      const node = state.nodeById.get(id);
      if (node) node.visualRadius = NODE_FOCUS_VISUAL_RADIUS;
    }
  }

  applyGraphToSimulation();
  state.sim.alpha(Math.max(state.sim.alpha(), message.alpha ?? 0.12)).restart();
  setStatus("active");
  scheduleNextTick(FAST_TICK_MS);
}

function initSimulation(message: InitMessage): void {
  stopSimulation();

  const width = message.options?.width ?? 3000;
  const height = message.options?.height ?? 3000;
  const progressEvery = Math.max(1, message.options?.progressEvery ?? 6);
  const alphaThreshold = message.options?.alphaThreshold ?? 0.003;
  const warmNodeThreshold = message.options?.warmNodeThreshold ?? 4000;
  const initialTicks = Math.max(0, message.options?.initialTicks ?? 200);

  const nodeMetaById = new Map(message.nodes.map((node) => [node.id, node]));
  const edgeMetaById = new Map(message.edges.map((edge) => [edge.id, edge]));
  const { simNodes: nodes, centroids } = buildSeededNodes(message.nodes, message.edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  state = {
    requestId: message.requestId,
    sim: createSimulation(nodes, []),
    nodeMetaById,
    edgeMetaById,
    nodes,
    links: [],
    nodeById,
    width,
    height,
    progressEvery,
    alphaThreshold,
    warmNodeThreshold,
    status: "active",
    tickCount: 0,
    timer: null,
    pinTicksById: new Map(),
    clusterCentroids: centroids,
    focusedNodeIds: new Set(),
  };

  applyGraphToSimulation();
  state.sim.stop();
  for (let i = 0; i < initialTicks; i += 1) {
    state.sim.tick();
  }

  setStatus("active");
  emitTick();
  scheduleNextTick(FAST_TICK_MS);
}

self.onmessage = (event: MessageEvent<Force3dMessage>) => {
  const message = event.data;
  if (message.type === "stop") {
    stopSimulation();
    return;
  }
  if (message.type === "init-sim") {
    initSimulation(message);
    return;
  }
  if (message.type === "reheat") {
    applyReheat(message);
  }
};
