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

type VelocityMap = Map<string, { x: number; y: number }>;

function classNames(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

function toWorldCoordinates(
  clientX: number,
  clientY: number,
  rootRect: DOMRect,
  camera: CameraTransform
): { x: number; y: number } {
  return {
    x: (clientX - rootRect.left - camera.x) / camera.scale,
    y: (clientY - rootRect.top - camera.y) / camera.scale,
  };
}

function truncateLabel(input: string, max = 28): string {
  if (input.length <= max) {
    return input;
  }
  return `${input.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function initialCamera(
  viewportWidth: number,
  viewportHeight: number
): CameraTransform {
  const scale = 1;
  return {
    scale,
    x: (viewportWidth - 1000 * scale) / 2,
    y: (viewportHeight - 1000 * scale) / 2,
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function estimatedPillRadius(title: string): number {
  const visibleLen = Math.min(28, title.length);
  const width = Math.min(260, Math.max(64, visibleLen * 6.4 + 26));
  const height = 30;
  return Math.hypot(width / 2, height / 2) + 6;
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
  const [camera, setCamera] = useState<CameraTransform>(() =>
    initialCamera(1000, 760)
  );
  const [draggingCanvas, setDraggingCanvas] = useState(false);
  const [animatedCamera, setAnimatedCamera] = useState(false);
  const [displayLayout, setDisplayLayout] = useState<LayoutMap>(
    () => new Map(layout)
  );
  const displayLayoutRef = useRef<LayoutMap>(new Map(layout));
  const velocityRef = useRef<VelocityMap>(new Map());
  const cameraRef = useRef<CameraTransform>(camera);

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
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    displayLayoutRef.current = displayLayout;
  }, [displayLayout]);

  useEffect(() => {
    const next = new Map<string, { x: number; y: number }>();
    const prev = displayLayoutRef.current;
    for (const node of nodes) {
      const target = layout.get(node.id);
      if (!target) {
        continue;
      }
      next.set(node.id, prev.get(node.id) ?? target);
    }
    displayLayoutRef.current = next;
    setDisplayLayout(next);

    const validIds = new Set(next.keys());
    for (const id of velocityRef.current.keys()) {
      if (!validIds.has(id)) {
        velocityRef.current.delete(id);
      }
    }
  }, [layout, nodes]);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) {
      const snapped = new Map(layout);
      displayLayoutRef.current = snapped;
      setDisplayLayout(snapped);
      velocityRef.current.clear();
      return;
    }

    let frameId = 0;
    let lastTime = performance.now();
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    const tick = (now: number) => {
      const dt = Math.min(32, now - lastTime);
      lastTime = now;
      const frameScale = dt / 16.6667;
      const next = new Map(displayLayoutRef.current);
      const velocities = velocityRef.current;
      const draggedNodeId = nodeDragRef.current?.nodeId ?? null;

      for (const node of nodes) {
        const target = layout.get(node.id);
        if (!target) {
          continue;
        }
        const current = next.get(node.id) ?? target;
        const vel = velocities.get(node.id) ?? { x: 0, y: 0 };
        const spring = draggedNodeId === node.id ? 0.03 : 0.085;
        vel.x += (target.x - current.x) * spring * frameScale;
        vel.y += (target.y - current.y) * spring * frameScale;

        const jitterSeed = hashString(node.id) % 997;
        const jitterAmp = selectedId === node.id ? 0.003 : 0.006;
        vel.x += Math.sin(now * 0.0013 + jitterSeed) * jitterAmp * frameScale;
        vel.y +=
          Math.cos(now * 0.0011 + jitterSeed * 1.17) * jitterAmp * frameScale;

        const damping = draggedNodeId === node.id ? 0.62 : 0.84;
        vel.x *= damping;
        vel.y *= damping;
        velocities.set(node.id, vel);
        next.set(node.id, {
          x: current.x + vel.x * frameScale,
          y: current.y + vel.y * frameScale,
        });
      }

      const values = Array.from(next.entries());
      for (let i = 0; i < values.length; i += 1) {
        const [idA, a] = values[i]!;
        const nodeA = nodeById.get(idA);
        if (!nodeA) {
          continue;
        }
        for (let j = i + 1; j < values.length; j += 1) {
          const [idB, b] = values[j]!;
          const nodeB = nodeById.get(idB);
          if (!nodeB) {
            continue;
          }
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minDist =
            estimatedPillRadius(nodeA.title) + estimatedPillRadius(nodeB.title);
          if (dist >= minDist) {
            continue;
          }
          const overlap = minDist - dist;
          const ux = dx / dist;
          const uy = dy / dist;
          const aDragged = draggedNodeId === idA;
          const bDragged = draggedNodeId === idB;
          if (aDragged && bDragged) {
            continue;
          }
          if (aDragged) {
            b.x += ux * overlap;
            b.y += uy * overlap;
          } else if (bDragged) {
            a.x -= ux * overlap;
            a.y -= uy * overlap;
          } else {
            a.x -= ux * overlap * 0.5;
            a.y -= uy * overlap * 0.5;
            b.x += ux * overlap * 0.5;
            b.y += uy * overlap * 0.5;
          }
        }
      }

      const pad = 24;
      for (const [id, pos] of next) {
        const clamped = {
          x: Math.min(1000 - pad, Math.max(pad, pos.x)),
          y: Math.min(1000 - pad, Math.max(pad, pos.y)),
        };
        next.set(id, clamped);
      }

      displayLayoutRef.current = next;
      setDisplayLayout(next);
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [layout, nodes, selectedId]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect;
      if (!next) {
        return;
      }
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
    if (!point) {
      return;
    }
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
      if (event.key !== "Escape") {
        return;
      }
      if (!selectedId) {
        return;
      }
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
    if (event.button !== 0) {
      return;
    }
    if (!rootRef.current) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) {
      return;
    }
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
    if (
      nodeDragRef.current &&
      nodeDragRef.current.pointerId === event.pointerId
    ) {
      if (!rootRef.current) {
        return;
      }
      const rect = rootRef.current.getBoundingClientRect();
      const world = toWorldCoordinates(
        event.clientX,
        event.clientY,
        rect,
        cameraRef.current
      );
      const next = new Map(layout);
      const nextPos = {
        x: world.x - nodeDragRef.current.offsetX,
        y: world.y - nodeDragRef.current.offsetY,
      };
      const prevPos = displayLayoutRef.current.get(nodeDragRef.current.nodeId);
      if (prevPos) {
        const dx = nextPos.x - prevPos.x;
        const dy = nextPos.y - prevPos.y;
        if (Math.hypot(dx, dy) > 1.5) {
          nodeDragRef.current.moved = true;
        }
      }
      next.set(nodeDragRef.current.nodeId, nextPos);
      onLayoutChange?.(next);
      setDisplayLayout((prev) => {
        const updated = new Map(prev);
        updated.set(nodeDragRef.current!.nodeId, nextPos);
        displayLayoutRef.current = updated;
        return updated;
      });
      return;
    }

    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - pan.startX;
    const deltaY = event.clientY - pan.startY;
    setCamera((prev) => ({
      ...prev,
      x: pan.cameraX + deltaX,
      y: pan.cameraY + deltaY,
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      nodeDragRef.current &&
      nodeDragRef.current.pointerId === event.pointerId
    ) {
      const draggedId = nodeDragRef.current.nodeId;
      const pos =
        displayLayoutRef.current.get(draggedId) ?? layout.get(draggedId);
      if (pos) {
        onNodePin?.(draggedId, pos);
      }
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
    if (!rootRef.current) {
      return;
    }
    if (nodeDragRef.current) {
      return;
    }
    setAnimatedCamera(false);
    const rect = rootRef.current.getBoundingClientRect();
    const delta = event.deltaY > 0 ? 0.92 : 1.08;
    const nextScale = Math.min(2.5, Math.max(0.4, camera.scale * delta));
    const worldBefore = toWorldCoordinates(
      event.clientX,
      event.clientY,
      rect,
      camera
    );
    const nextX = event.clientX - rect.left - worldBefore.x * nextScale;
    const nextY = event.clientY - rect.top - worldBefore.y * nextScale;
    setCamera({ x: nextX, y: nextY, scale: nextScale });
  };

  return (
    <div
      className={classNames(
        styles.graphRoot,
        draggingCanvas && styles.graphRootDragging
      )}
      onClick={() => onSelect(null)}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      ref={rootRef}
      role="presentation"
    >
      <div
        className={classNames(
          styles.graphLayer,
          animatedCamera && styles.graphLayerAnimated
        )}
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
        }}
      >
        <svg
          className={styles.edgeSvg}
          preserveAspectRatio="none"
          viewBox="0 0 1000 1000"
        >
          {edges
            .filter((edge) => visibleEdgeSet.has(edge.id))
            .map((edge) => {
              const source = layout.get(edge.source);
              const target = displayLayout.get(edge.target);
              const src = displayLayout.get(edge.source) ?? source;
              const dst = target;
              if (!(src && dst)) {
                return null;
              }
              const selected = selectedId !== null;
              const active = selected && activeEdgeIds.has(edge.id);
              return (
                <line
                  className={classNames(
                    styles.edge,
                    selected && !active && styles.edgeDimmed,
                    active && styles.edgeActive
                  )}
                  key={edge.id}
                  x1={src.x}
                  x2={dst.x}
                  y1={src.y}
                  y2={dst.y}
                />
              );
            })}
        </svg>

        {nodes.map((node) => {
          const point = displayLayout.get(node.id) ?? layout.get(node.id);
          if (!point) {
            return null;
          }
          const selected = selectedId !== null;
          const isSelected = selectedId === node.id;
          const isNeighbor = neighborIds.has(node.id);
          const isDimmed = selected && !isSelected && !isNeighbor;
          return (
            <button
              className={classNames(
                styles.pillNode,
                isSelected && styles.pillNodeSelected,
                !isSelected && isNeighbor && styles.pillNodeNeighbor,
                isDimmed && styles.pillNodeDimmed
              )}
              key={node.id}
              onClick={(event) => {
                event.stopPropagation();
                if (
                  nodeDragRef.current?.nodeId === node.id &&
                  nodeDragRef.current.moved
                ) {
                  return;
                }
                onSelect(node.id);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (!event.shiftKey) {
                  return;
                }
                if (!rootRef.current) {
                  return;
                }
                const rect = rootRef.current.getBoundingClientRect();
                const world = toWorldCoordinates(
                  event.clientX,
                  event.clientY,
                  rect,
                  cameraRef.current
                );
                nodeDragRef.current = {
                  pointerId: event.pointerId,
                  nodeId: node.id,
                  offsetX: world.x - point.x,
                  offsetY: world.y - point.y,
                  moved: false,
                };
                (event.currentTarget as HTMLButtonElement).setPointerCapture(
                  event.pointerId
                );
              }}
              style={{ left: point.x, top: point.y }}
              title={node.title}
              type="button"
            >
              {truncateLabel(node.title)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
