"use client";

import { EntityGraphPillCanvas } from "@/src/components/dev/EntityGraphPillCanvas";
import type { GraphCanvasSharedProps } from "@/src/components/dev/entity-graph-renderer-types";

/**
 * Directional scaffold:
 * - Holds the route-level integration points and UX contract.
 * - The underlying renderer can be swapped to react-force-graph without touching callers.
 */
export function EntityGraphRfgCanvas(props: GraphCanvasSharedProps) {
  return <EntityGraphPillCanvas {...props} />;
}
