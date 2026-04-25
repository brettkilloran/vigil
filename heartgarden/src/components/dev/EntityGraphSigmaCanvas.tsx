"use client";

import { EntityGraphPillCanvas } from "@/src/components/dev/EntityGraphPillCanvas";
import type { GraphCanvasSharedProps } from "@/src/components/dev/entity-graph-renderer-types";

/**
 * Directional scaffold:
 * - Keeps feature parity while we validate chrome + inspector integration.
 * - Replaced by Sigma-specific implementation in subsequent bake-off tasks.
 */
export function EntityGraphSigmaCanvas(props: GraphCanvasSharedProps) {
  return <EntityGraphPillCanvas {...props} />;
}
