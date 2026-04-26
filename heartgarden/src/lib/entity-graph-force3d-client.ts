import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

type SolveForce3dResponse = {
  type: "solved-force3d";
  requestId: number;
  ids: string[];
  positions: Float32Array;
};

type SolveForce3dResult = {
  ids: string[];
  positions: Float32Array;
};

let worker: Worker | null = null;
let requestSeq = 0;
const pending = new Map<number, (value: SolveForce3dResult) => void>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./entity-graph-force3d.worker.ts", import.meta.url));
  worker.onmessage = (event: MessageEvent<SolveForce3dResponse>) => {
    const message = event.data;
    if (message.type !== "solved-force3d") return;
    const resolver = pending.get(message.requestId);
    if (!resolver) return;
    pending.delete(message.requestId);
    resolver({
      ids: message.ids,
      positions: message.positions,
    });
  };
  return worker;
}

export function solveGraphForce3dInWorker(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: { width?: number; height?: number; iterations?: number } = {},
): Promise<SolveForce3dResult> {
  const requestId = ++requestSeq;
  const w = getWorker();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    w.postMessage({
      type: "solve-force3d",
      requestId,
      nodes,
      edges,
      options,
    });
  });
}
