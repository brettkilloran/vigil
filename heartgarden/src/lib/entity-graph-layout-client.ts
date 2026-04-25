import type { StableLayoutOptions } from "@/src/lib/entity-graph-stable-layout";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

type SolveResult = Map<string, { x: number; y: number }>;

type SolveResponse = {
  type: "solved" | "progress";
  requestId: number;
  ids: string[];
  positions: Float32Array;
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (value: SolveResult) => void>();
const progressHandlers = new Map<number, (value: SolveResult) => void>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./entity-graph-layout.worker.ts", import.meta.url));
  worker.onmessage = (event: MessageEvent<SolveResponse>) => {
    const msg = event.data;
    const out = new Map<string, { x: number; y: number }>();
    msg.ids.forEach((id, idx) => {
      out.set(id, {
        x: msg.positions[idx * 2] ?? 0,
        y: msg.positions[idx * 2 + 1] ?? 0,
      });
    });
    if (msg.type === "progress") {
      progressHandlers.get(msg.requestId)?.(out);
      return;
    }
    const resolve = pending.get(msg.requestId);
    if (!resolve) return;
    pending.delete(msg.requestId);
    progressHandlers.delete(msg.requestId);
    resolve(out);
  };
  return worker;
}

export function solveStableLayoutInWorker(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: StableLayoutOptions = {},
): Promise<SolveResult> {
  const requestId = ++seq;
  const w = getWorker();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    w.postMessage({
      type: "solve",
      requestId,
      nodes,
      edges,
      options,
    });
  });
}

export function solveStableLayoutIncrementalInWorker(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: StableLayoutOptions = {},
): Promise<SolveResult> {
  const requestId = ++seq;
  const w = getWorker();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    w.postMessage({
      type: "solve-incremental",
      requestId,
      nodes,
      edges,
      options,
    });
  });
}

export function solveStableLayoutStreamingInWorker(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: StableLayoutOptions = {},
  onProgress?: (result: SolveResult) => void,
): Promise<SolveResult> {
  const requestId = ++seq;
  const w = getWorker();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    if (onProgress) progressHandlers.set(requestId, onProgress);
    w.postMessage({
      type: "solve-stream",
      requestId,
      nodes,
      edges,
      options,
    });
  });
}
