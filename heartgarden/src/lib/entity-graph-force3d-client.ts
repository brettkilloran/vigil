import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

type SimStatus = "active" | "idle" | "frozen";

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

type TickResult = {
  ids: string[];
  positions: Float32Array;
};

type ReheatOptions = {
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
  focusNodeIds?: string[];
};

export type Force3dSession = {
  requestId: number;
  reheat: (options?: ReheatOptions) => void;
  stop: () => void;
};

let worker: Worker | null = null;
let requestSeq = 0;
let activeRequestId: number | null = null;
let tickHandler: ((value: TickResult) => void) | null = null;
let statusHandler: ((status: SimStatus) => void) | null = null;

function teardownWorker(): void {
  if (!worker) return;
  worker.terminate();
  worker = null;
  activeRequestId = null;
  tickHandler = null;
  statusHandler = null;
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./entity-graph-force3d.worker.ts", import.meta.url));
  worker.onmessage = (event: MessageEvent<Force3dResponse>) => {
    const message = event.data;
    if (activeRequestId === null || message.requestId !== activeRequestId) return;
    if (message.type === "tick-force3d") {
      tickHandler?.({ ids: message.ids, positions: message.positions });
      return;
    }
    if (message.type === "status-force3d") {
      statusHandler?.(message.status);
    }
  };
  return worker;
}

export function initForce3dSim(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: {
    width?: number;
    height?: number;
    progressEvery?: number;
    alphaThreshold?: number;
    warmNodeThreshold?: number;
    initialTicks?: number;
  } = {},
  onTick?: (result: TickResult) => void,
  onStatus?: (status: SimStatus) => void,
): Force3dSession {
  const previous = activeRequestId;
  if (previous !== null && worker) {
    worker.postMessage({ type: "stop", requestId: previous });
  }

  const requestId = ++requestSeq;
  const w = getWorker();
  activeRequestId = requestId;
  tickHandler = onTick ?? null;
  statusHandler = onStatus ?? null;

  w.postMessage({
    type: "init-sim",
    requestId,
    nodes,
    edges,
    options,
  });

  return {
    requestId,
    reheat: (reheatOptions = {}) => {
      if (!worker || activeRequestId !== requestId) return;
      worker.postMessage({
        type: "reheat",
        requestId,
        ...reheatOptions,
      });
    },
    stop: () => {
      if (!worker || activeRequestId !== requestId) return;
      worker.postMessage({ type: "stop", requestId });
      teardownWorker();
    },
  };
}
