/// <reference lib="webworker" />

import { computeStableLayout, type StableLayoutOptions } from "@/src/lib/entity-graph-stable-layout";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

type SolveMessage = {
  type: "solve" | "solve-stream" | "solve-incremental";
  requestId: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  options?: StableLayoutOptions;
};

type WorkerResponse = {
  type: "solved" | "progress";
  requestId: number;
  ids: string[];
  positions: Float32Array;
};

const bufferPool = new Map<number, Float32Array>();
const lastSolvedByNodeId = new Map<string, { x: number; y: number }>();

function getBuffer(size: number): Float32Array {
  const reusable = bufferPool.get(size);
  if (reusable) {
    bufferPool.delete(size);
    return reusable;
  }
  return new Float32Array(size);
}

function releaseBuffer(buffer: Float32Array): void {
  bufferPool.set(buffer.length, buffer);
}

function serializeLayout(out: Map<string, { x: number; y: number }>): { ids: string[]; positions: Float32Array } {
  const ids = Array.from(out.keys());
  const positions = getBuffer(ids.length * 2);
  ids.forEach((id, idx) => {
    const point = out.get(id);
    positions[idx * 2] = point?.x ?? 0;
    positions[idx * 2 + 1] = point?.y ?? 0;
  });
  return { ids, positions };
}

self.onmessage = (event: MessageEvent<SolveMessage>) => {
  const message = event.data;
  if (message.type !== "solve" && message.type !== "solve-stream" && message.type !== "solve-incremental") return;

  let seed = message.options?.seed;
  if (message.type === "solve-incremental") {
    const seedFromLast = new Map<string, { x: number; y: number }>();
    for (const node of message.nodes) {
      const prev = lastSolvedByNodeId.get(node.id);
      if (prev) seedFromLast.set(node.id, prev);
    }
    seed = seedFromLast.size > 0 ? seedFromLast : seed;
  }

  const out = computeStableLayout(message.nodes, message.edges, { ...(message.options ?? {}), seed });
  for (const [id, point] of out.entries()) {
    lastSolvedByNodeId.set(id, point);
  }

  const serialized = serializeLayout(out);
  if (message.type === "solve-stream") {
    const progressBuffer = serialized.positions.slice();
    const progress: WorkerResponse = {
      type: "progress",
      requestId: message.requestId,
      ids: serialized.ids,
      positions: progressBuffer,
    };
    self.postMessage(progress, [progressBuffer.buffer]);
  }

  const response: WorkerResponse = {
    type: "solved",
    requestId: message.requestId,
    ids: serialized.ids,
    positions: serialized.positions.slice(),
  };
  self.postMessage(response, [response.positions.buffer]);
  releaseBuffer(serialized.positions);
};
