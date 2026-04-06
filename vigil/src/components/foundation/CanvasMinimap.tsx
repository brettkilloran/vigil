"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { CanvasGraph } from "@/src/components/foundation/architectural-types";
import {
  computeSpaceContentBounds,
  listMinimapAtomRects,
  viewportWorldRect,
  type CollapsedStackInfo,
} from "@/src/lib/canvas-view-bounds";

import styles from "./CanvasMinimap.module.css";

type CanvasMinimapProps = {
  graph: CanvasGraph;
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
};

function padBounds(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  padRatio: number,
  minPad: number,
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
}: CanvasMinimapProps) {
  void _minZoom;
  void _maxZoom;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const contentBounds = useMemo(
    () => computeSpaceContentBounds(graph, activeSpaceId, collapsedStacks),
    [graph, activeSpaceId, collapsedStacks],
  );

  const viewBoxRect = useMemo(() => {
    if (!contentBounds) return null;
    return padBounds(contentBounds, 0.1, 80);
  }, [contentBounds]);

  const atoms = useMemo(() => {
    const sel = new Set(selectedNodeIds);
    return listMinimapAtomRects(graph, activeSpaceId, collapsedStacks, sel);
  }, [graph, activeSpaceId, collapsedStacks, selectedNodeIds]);

  const vpWorld = useMemo(
    () => viewportWorldRect(translateX, translateY, scale, viewportWidth, viewportHeight),
    [translateX, translateY, scale, viewportWidth, viewportHeight],
  );

  const clientToWorldDelta = useCallback(
    (movementX: number, movementY: number) => {
      if (!svgRef.current || !viewBoxRect) return { dw: 0, dh: 0 };
      const r = svgRef.current.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return { dw: 0, dh: 0 };
      const vbW = viewBoxRect.maxX - viewBoxRect.minX;
      const vbH = viewBoxRect.maxY - viewBoxRect.minY;
      return {
        dw: (movementX / r.width) * vbW,
        dh: (movementY / r.height) * vbH,
      };
    },
    [viewBoxRect],
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
      if (!draggingRef.current || e.buttons !== 1) return;
      const { dw, dh } = clientToWorldDelta(e.movementX, e.movementY);
      onPanWorldDelta(dw, dh);
    },
    [clientToWorldDelta, onPanWorldDelta],
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

  const onSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if ((e.target as SVGElement).closest("[data-minimap-viewport]")) return;
      if (!svgRef.current || !viewBoxRect) return;
      const svg = svgRef.current;
      const r = svg.getBoundingClientRect();
      const vbW = viewBoxRect.maxX - viewBoxRect.minX;
      const vbH = viewBoxRect.maxY - viewBoxRect.minY;
      const lx = ((e.clientX - r.left) / r.width) * vbW + viewBoxRect.minX;
      const ly = ((e.clientY - r.top) / r.height) * vbH + viewBoxRect.minY;
      onCenterOnWorld(lx, ly);
    },
    [onCenterOnWorld, viewBoxRect],
  );

  const onSvgDblClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if ((e.target as SVGElement).closest("[data-minimap-viewport]")) return;
      onFitAll();
    },
    [onFitAll],
  );

  if (!viewBoxRect) return null;

  const vb = `${viewBoxRect.minX} ${viewBoxRect.minY} ${viewBoxRect.maxX - viewBoxRect.minX} ${viewBoxRect.maxY - viewBoxRect.minY}`;

  return (
    <div className={styles.root} data-hg-chrome="canvas-minimap">
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={vb}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Canvas minimap"
        onPointerMove={onSvgPointerMove}
        onClick={onSvgClick}
        onDoubleClick={onSvgDblClick}
      >
        {atoms.map((a) => (
          <rect
            key={a.key}
            x={a.bounds.minX}
            y={a.bounds.minY}
            width={Math.max(4, a.bounds.maxX - a.bounds.minX)}
            height={Math.max(4, a.bounds.maxY - a.bounds.minY)}
            rx={2}
            className={a.selected ? styles.atomSelected : styles.atom}
          />
        ))}
        <rect
          data-minimap-viewport="true"
          x={vpWorld.minX}
          y={vpWorld.minY}
          width={Math.max(8, vpWorld.maxX - vpWorld.minX)}
          height={Math.max(8, vpWorld.maxY - vpWorld.minY)}
          className={`${styles.viewportRect} ${dragging ? styles.viewportRectDragging : ""}`}
          onPointerDown={onViewportPointerDown}
          onPointerUp={onViewportPointerUp}
          onPointerCancel={onViewportPointerUp}
        />
      </svg>
    </div>
  );
}
