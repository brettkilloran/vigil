import type { CanvasGraph } from "@/src/components/foundation/architectural-types";

/** Cap snapshot count to bound memory (each entry is a full graph clone). */
export const MAX_ARCHITECTURAL_UNDO = 96;

export interface ArchitecturalUndoSnapshot {
  activeSpaceId: string;
  graph: CanvasGraph;
  navigationPath: string[];
  selectedNodeIds: string[];
}

export function cloneArchitecturalGraph(graph: CanvasGraph): CanvasGraph {
  return structuredClone(graph);
}
