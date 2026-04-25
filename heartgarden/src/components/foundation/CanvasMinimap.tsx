"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CanvasGraph } from "@/src/components/foundation/architectural-types";
import {
  type CollapsedStackInfo,
  computeSpaceContentBounds,
  listMinimapAtomRects,
  type MinimapPlacementSize,
  viewportWorldRect,
} from "@/src/lib/canvas-view-bounds";
import { cx } from "@/src/lib/cx";

import styles from "./CanvasMinimap.module.css";

type CanvasMinimapProps = {
  graph: CanvasGraph;
  /** Output of `minimapLayoutSignature(graph, activeSpaceId)` — throttles work when `graph` ref churns (collab). */
  layoutSignature: string;
  activeSpaceId: string;
  collapsedStacks: readonly CollapsedStackInfo[];
  translateX: number;
  translateY: number;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
  selectedNodeIds: readonly string[];
  minZoom: number;
  maxZoom: number;
  /** Pan camera when viewport handle is dragged (`dw`/`dh` in world units matching minimap viewBox). */
  onPanWorldDelta: (dw: number, dh: number) => void;
  /** Center viewport on a world point at current zoom. */
  onCenterOnWorld: (wx: number, wy: number) => void;
  onFitAll: () => void;
  /** Live placement sizes from DOM (`offsetWidth`/`offsetHeight`) keyed by entity id. */
  placementSizes?: ReadonlyMap<string, MinimapPlacementSize> | null;
  /** Compact chrome for embedding in the bottom-right viewport metrics dock row. */
  toolbarEmbed?: boolean;
  /** Stretch to host width (metrics cluster strip above minimap). */
  metricsDockWidth?: boolean;
};

function padBounds(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  padRatio: number,
  minPad: number
) {
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const px = Math.max(w * padRatio, minPad);
  const py = Math.max(h * padRatio, minPad);
  return {
    minX: b.minX - px,
    minY: b.minY - py,
    maxX: b.maxX + px,
    maxY: b.maxY + py,
  };
}

export function CanvasMinimap({
  graph,
  layoutSignature,
  activeSpaceId,
  collapsedStacks,
  translateX,
  translateY,
  scale,
  viewportWidth,
  viewportHeight,
  selectedNodeIds,
  minZoom: _minZoom,
  maxZoom: _maxZoom,
  onPanWorldDelta,
  onCenterOnWorld,
  onFitAll,
  placementSizes = null,
  toolbarEmbed = false,
  metricsDockWidth = false,
}: CanvasMinimapProps) {
  void _minZoom;
  void _maxZoom;
  void layoutSignature;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const contentBounds = useMemo(
    () =>
      computeSpaceContentBounds(
        graph,
        activeSpaceId,
        collapsedStacks,
        placementSizes
      ),
    [graph, activeSpaceId, collapsedStacks, placementSizes]
  );

  const vpWorld = useMemo(
    () =>
      viewportWorldRect(
        translateX,
        translateY,
        scale,
        viewportWidth,
        viewportHeight
      ),
    [translateX, translateY, scale, viewportWidth, viewportHeight]
  );

  /** Empty spaces have no content bounds; still show the map frame from the current viewport. */
  const viewBoxRect = useMemo(() => {
    if (contentBounds) {
      return padBounds(contentBounds, 0.1, 80);
    }
    return padBounds(vpWorld, 0.12, 120);
  }, [contentBounds, vpWorld]);

  const atoms = useMemo(() => {
    const sel = new Set(selectedNodeIds);
    return listMinimapAtomRects(
      graph,
      activeSpaceId,
      collapsedStacks,
      sel,
      placementSizes
    );
  }, [graph, activeSpaceId, collapsedStacks, placementSizes, selectedNodeIds]);

  const clientToWorldDelta = useCallback(
    (movementX: number, movementY: number) => {
      if (!(svgRef.current && viewBoxRect)) {
        return { dw: 0, dh: 0 };
      }
      const r = svgRef.current.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) {
        return { dw: 0, dh: 0 };
      }
      const vbW = viewBoxRect.maxX - viewBoxRect.minX;
      const vbH = viewBoxRect.maxY - viewBoxRect.minY;
      return {
        dw: (movementX / r.width) * vbW,
        dh: (movementY / r.height) * vbH,
      };
    },
    [viewBoxRect]
  );

  const onViewportPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!draggingRef.current || e.buttons !== 1) {
        return;
      }
      const { dw, dh } = clientToWorldDelta(e.movementX, e.movementY);
      onPanWorldDelta(dw, dh);
    },
    [clientToWorldDelta, onPanWorldDelta]
  );

  const onViewportPointerUp = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false;
    setDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onViewportLostPointerCapture = useCallback(() => {
    draggingRef.current = false;
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) {
      return;
    }
    const end = () => {
      draggingRef.current = false;
      setDragging(false);
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging]);

  const onSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if ((e.target as SVGElement).closest("[data-minimap-viewport]")) {
        return;
      }
      if (!(svgRef.current && viewBoxRect)) {
        return;
      }
      const svg = svgRef.current;
      const r = svg.getBoundingClientRect();
      const vbW = viewBoxRect.maxX - viewBoxRect.minX;
      const vbH = viewBoxRect.maxY - viewBoxRect.minY;
      const lx = ((e.clientX - r.left) / r.width) * vbW + viewBoxRect.minX;
      const ly = ((e.clientY - r.top) / r.height) * vbH + viewBoxRect.minY;
      onCenterOnWorld(lx, ly);
    },
    [onCenterOnWorld, viewBoxRect]
  );

  const onSvgDblClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if ((e.target as SVGElement).closest("[data-minimap-viewport]")) {
        return;
      }
      onFitAll();
    },
    [onFitAll]
  );

  const vb = `${viewBoxRect.minX} ${viewBoxRect.minY} ${viewBoxRect.maxX - viewBoxRect.minX} ${viewBoxRect.maxY - viewBoxRect.minY}`;

  return (
    <div
      className={cx(
        styles.root,
        toolbarEmbed && styles.rootToolbarEmbed,
        metricsDockWidth && styles.rootMetricsDock
      )}
      data-hg-chrome="canvas-minimap"
    >
      <svg
        aria-label="Canvas minimap"
        className={cx(styles.svg, toolbarEmbed && styles.svgToolbarEmbed)}
        onClick={onSvgClick}
        onDoubleClick={onSvgDblClick}
        onLostPointerCapture={onViewportLostPointerCapture}
        onPointerMove={onSvgPointerMove}
        preserveAspectRatio="xMidYMid meet"
        ref={svgRef}
        role="img"
        tabIndex={-1}
        viewBox={vb}
      >
        {atoms.map((a) => {
          const cx = a.x + a.width / 2;
          const cy = a.y + a.height / 2;
          return (
            <rect
              className={a.selected ? styles.atomSelected : styles.atom}
              height={a.height}
              key={a.key}
              rx={2}
              transform={
                a.rotationDeg === 0
                  ? undefined
                  : `rotate(${a.rotationDeg} ${cx} ${cy})`
              }
              width={a.width}
              x={a.x}
              y={a.y}
            />
          );
        })}
        <rect
          className={`${styles.viewportRect} ${dragging ? styles.viewportRectDragging : ""}`}
          data-minimap-viewport="true"
          height={Math.max(8, vpWorld.maxY - vpWorld.minY)}
          onLostPointerCapture={onViewportLostPointerCapture}
          onPointerCancel={onViewportPointerUp}
          onPointerDown={onViewportPointerDown}
          onPointerUp={onViewportPointerUp}
          width={Math.max(8, vpWorld.maxX - vpWorld.minX)}
          x={vpWorld.minX}
          y={vpWorld.minY}
        />
      </svg>
    </div>
  );
}
