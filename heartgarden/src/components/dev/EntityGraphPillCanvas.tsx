"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "@/src/components/dev/entity-graph-lab.module.css";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

type LayoutMap = Map<string, { x: number; y: number }>;

type CameraTransform = {
  x: number;
  y: number;
  scale: number;
};

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function toWorldCoordinates(
  clientX: number,
  clientY: number,
  rootRect: DOMRect,
  camera: CameraTransform,
): { x: number; y: number } {
  return {
    x: (clientX - rootRect.left - camera.x) / camera.scale,
    y: (clientY - rootRect.top - camera.y) / camera.scale,
  };
}

function truncateLabel(input: string, max = 28): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function initialCamera(viewportWidth: number, viewportHeight: number): CameraTransform {
  const scale = 1;
  return {
    scale,
    x: (viewportWidth - 1000 * scale) / 2,
    y: (viewportHeight - 1000 * scale) / 2,
  };
}

export function EntityGraphPillCanvas({
  nodes,
  edges,
  layout,
  selectedId,
  neighborIds,
  activeEdgeIds,
  onSelect,
  onLayoutChange,
  onNodePin,
  cameraResetKey,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: LayoutMap;
  selectedId: string | null;
  neighborIds: Set<string>;
  activeEdgeIds: Set<string>;
  onSelect: (id: string | null) => void;
  onLayoutChange?: (next: LayoutMap) => void;
  onNodePin?: (id: string, position: { x: number; y: number }) => void;
  cameraResetKey: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 1000, height: 760 });
  const [camera, setCamera] = useState<CameraTransform>(() => initialCamera(1000, 760));
  const [draggingCanvas, setDraggingCanvas] = useState(false);
  const [animatedCamera, setAnimatedCamera] = useState(false);

  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    cameraX: number;
    cameraY: number;
  } | null>(null);
  const nodeDragRef = useRef<{
    pointerId: number;
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect;
      if (!next) return;
      setViewport({ width: next.width, height: next.height });
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setAnimatedCamera(true);
    setCamera(initialCamera(viewport.width, viewport.height));
    const timer = window.setTimeout(() => setAnimatedCamera(false), 760);
    return () => window.clearTimeout(timer);
  }, [cameraResetKey, viewport.height, viewport.width]);

  useEffect(() => {
    if (!selectedId) {
      setAnimatedCamera(true);
      setCamera(initialCamera(viewport.width, viewport.height));
      const timer = window.setTimeout(() => setAnimatedCamera(false), 760);
      return () => window.clearTimeout(timer);
    }

    const point = layout.get(selectedId);
    if (!point) return;
    const nextScale = 1.2;
    const nextX = viewport.width * 0.34 - point.x * nextScale;
    const nextY = viewport.height * 0.5 - point.y * nextScale;
    setAnimatedCamera(true);
    setCamera({ x: nextX, y: nextY, scale: nextScale });
    const timer = window.setTimeout(() => setAnimatedCamera(false), 760);
    return () => window.clearTimeout(timer);
  }, [layout, selectedId, viewport.height, viewport.width]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!selectedId) return;
      onSelect(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSelect, selectedId]);

  const visibleEdgeSet = useMemo(() => {
    const ids = new Set(nodes.map((node) => node.id));
    const set = new Set<string>();
    for (const edge of edges) {
      if (ids.has(edge.source) && ids.has(edge.target)) {
        set.add(edge.id);
      }
    }
    return set;
  }, [edges, nodes]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (!rootRef.current) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
    };
    setAnimatedCamera(false);
    setDraggingCanvas(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (nodeDragRef.current && nodeDragRef.current.pointerId === event.pointerId) {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const world = toWorldCoordinates(event.clientX, event.clientY, rect, camera);
      const next = new Map(layout);
      next.set(nodeDragRef.current.nodeId, {
        x: world.x - nodeDragRef.current.offsetX,
        y: world.y - nodeDragRef.current.offsetY,
      });
      onLayoutChange?.(next);
      return;
    }

    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pan.startX;
    const deltaY = event.clientY - pan.startY;
    setCamera((prev) => ({
      ...prev,
      x: pan.cameraX + deltaX,
      y: pan.cameraY + deltaY,
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (nodeDragRef.current && nodeDragRef.current.pointerId === event.pointerId) {
      const draggedId = nodeDragRef.current.nodeId;
      const pos = layout.get(draggedId);
      if (pos) onNodePin?.(draggedId, pos);
      nodeDragRef.current = null;
    }

    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
      setDraggingCanvas(false);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // No-op if pointer capture is already gone.
      }
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!rootRef.current) return;
    setAnimatedCamera(false);
    const rect = rootRef.current.getBoundingClientRect();
    const delta = event.deltaY > 0 ? 0.92 : 1.08;
    const nextScale = Math.min(2.5, Math.max(0.4, camera.scale * delta));
    const worldBefore = toWorldCoordinates(event.clientX, event.clientY, rect, camera);
    const nextX = event.clientX - rect.left - worldBefore.x * nextScale;
    const nextY = event.clientY - rect.top - worldBefore.y * nextScale;
    setCamera({ x: nextX, y: nextY, scale: nextScale });
  };

  return (
    <div
      ref={rootRef}
      className={classNames(styles.graphRoot, draggingCanvas && styles.graphRootDragging)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onClick={() => onSelect(null)}
      role="presentation"
    >
      <div
        className={classNames(styles.graphLayer, animatedCamera && styles.graphLayerAnimated)}
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
        }}
      >
        <svg className={styles.edgeSvg} viewBox="0 0 1000 1000" preserveAspectRatio="none">
          {edges
            .filter((edge) => visibleEdgeSet.has(edge.id))
            .map((edge) => {
              const source = layout.get(edge.source);
              const target = layout.get(edge.target);
              if (!source || !target) return null;
              const selected = selectedId !== null;
              const active = selected && activeEdgeIds.has(edge.id);
              return (
                <line
                  key={edge.id}
                  className={classNames(
                    styles.edge,
                    selected && !active && styles.edgeDimmed,
                    active && styles.edgeActive,
                  )}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                />
              );
            })}
        </svg>

        {nodes.map((node) => {
          const point = layout.get(node.id);
          if (!point) return null;
          const selected = selectedId !== null;
          const isSelected = selectedId === node.id;
          const isNeighbor = neighborIds.has(node.id);
          const isDimmed = selected && !isSelected && !isNeighbor;
          return (
            <button
              key={node.id}
              type="button"
              className={classNames(
                styles.pillNode,
                isSelected && styles.pillNodeSelected,
                !isSelected && isNeighbor && styles.pillNodeNeighbor,
                isDimmed && styles.pillNodeDimmed,
              )}
              style={{ left: point.x, top: point.y }}
              title={node.title}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (!rootRef.current) return;
                const rect = rootRef.current.getBoundingClientRect();
                const world = toWorldCoordinates(event.clientX, event.clientY, rect, camera);
                nodeDragRef.current = {
                  pointerId: event.pointerId,
                  nodeId: node.id,
                  offsetX: world.x - point.x,
                  offsetY: world.y - point.y,
                };
                (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(node.id);
              }}
            >
              {truncateLabel(node.title)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
