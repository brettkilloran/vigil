"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "@/src/components/dev/entity-graph-lab.module.css";
import type {
  GraphCanvasSharedProps,
  GraphEdgeHover,
  LayoutMap,
} from "@/src/components/dev/entity-graph-renderer-types";
import { estimatePillGeometry } from "@/src/lib/entity-graph-pill-geometry";
import { getEntityTypeStyle } from "@/src/lib/entity-graph-type-style";
import { getRelationStyle } from "@/src/lib/entity-graph-relation-style";

/**
 * @deprecated The entity-graph lab now canonizes the Three.js renderer.
 * Keep this legacy canvas only for short-term reference while we finish cleanup.
 */
type CameraTransform = {
  x: number;
  y: number;
  scale: number;
};

type VelocityMap = Map<string, { x: number; y: number }>;

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

function initialCameraForWorld(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
): CameraTransform {
  const scale = 1;
  return {
    scale,
    x: (viewportWidth - worldWidth * scale) / 2,
    y: (viewportHeight - worldHeight * scale) / 2,
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

function computeBounds(layout: LayoutMap): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (layout.size === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of layout.values()) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY };
}

export function EntityGraphPillCanvas({
  nodes,
  edges,
  layout,
  worldWidth,
  worldHeight,
  selectedId,
  neighborIds,
  activeEdgeIds,
  onSelect,
  onNodePin,
  cameraActionKey,
  cameraActionType,
  onEdgeHover,
  onEdgeSelect,
}: GraphCanvasSharedProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 1000, height: 760 });
  const [camera, setCamera] = useState<CameraTransform>(() =>
    initialCameraForWorld(1000, 760, worldWidth, worldHeight),
  );
  const [draggingCanvas, setDraggingCanvas] = useState(false);
  const [animatedCamera, setAnimatedCamera] = useState(false);
  const [displayLayout, setDisplayLayout] = useState<LayoutMap>(() => new Map(layout));
  const displayLayoutRef = useRef<LayoutMap>(new Map(layout));
  const velocityRef = useRef<VelocityMap>(new Map());
  const cameraRef = useRef<CameraTransform>(camera);

  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    cameraX: number;
    cameraY: number;
    didMove: boolean;
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
      if (!target) continue;
      next.set(node.id, prev.get(node.id) ?? target);
    }
    displayLayoutRef.current = next;
    setDisplayLayout(next);

    const validIds = new Set(next.keys());
    for (const id of velocityRef.current.keys()) {
      if (!validIds.has(id)) velocityRef.current.delete(id);
    }
  }, [layout, nodes]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

    let quietFrames = 0;
    const tick = (now: number) => {
      const dt = Math.min(32, now - lastTime);
      lastTime = now;
      const frameScale = dt / 16.6667;
      const next = new Map(displayLayoutRef.current);
      const velocities = velocityRef.current;

      let maxVelocity = 0;
      for (const node of nodes) {
        const target = layout.get(node.id);
        if (!target) continue;
        const current = next.get(node.id) ?? target;
        const vel = velocities.get(node.id) ?? { x: 0, y: 0 };
        const spring = 0.085;
        vel.x += (target.x - current.x) * spring * frameScale;
        vel.y += (target.y - current.y) * spring * frameScale;

        const jitterSeed = hashString(node.id) % 997;
        const jitterAmp = selectedId === node.id ? 0.003 : 0.006;
        vel.x += Math.sin(now * 0.0013 + jitterSeed) * jitterAmp * frameScale;
        vel.y += Math.cos(now * 0.0011 + jitterSeed * 1.17) * jitterAmp * frameScale;

        const damping = 0.84;
        vel.x *= damping;
        vel.y *= damping;
        maxVelocity = Math.max(maxVelocity, Math.hypot(vel.x, vel.y));
        velocities.set(node.id, vel);
        next.set(node.id, {
          x: current.x + vel.x * frameScale,
          y: current.y + vel.y * frameScale,
        });
      }

      const values = Array.from(next.entries());
      const grid = new Map<string, Array<[string, { x: number; y: number }]>>();
      const cellSize = 160;
      const cellKey = (x: number, y: number) => `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
      for (const entry of values) {
        const key = cellKey(entry[1].x, entry[1].y);
        const bucket = grid.get(key) ?? [];
        bucket.push(entry);
        grid.set(key, bucket);
      }

      for (const [key, bucket] of grid) {
        const [cx, cy] = key.split(":").map((value) => Number(value));
        const neighbors = [
          `${cx}:${cy}`,
          `${cx + 1}:${cy}`,
          `${cx - 1}:${cy}`,
          `${cx}:${cy + 1}`,
          `${cx}:${cy - 1}`,
          `${cx + 1}:${cy + 1}`,
          `${cx - 1}:${cy - 1}`,
          `${cx + 1}:${cy - 1}`,
          `${cx - 1}:${cy + 1}`,
        ];
        for (const [idA, a] of bucket) {
          const nodeA = nodeById.get(idA);
          if (!nodeA) continue;
          for (const neighborKey of neighbors) {
            const compared = grid.get(neighborKey);
            if (!compared) continue;
            for (const [idB, b] of compared) {
              if (idA >= idB) continue;
          const nodeB = nodeById.get(idB);
          if (!nodeB) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minDist =
            estimatePillGeometry(nodeA.title).collisionRadius +
            estimatePillGeometry(nodeB.title).collisionRadius;
          if (dist >= minDist) continue;
          const overlap = minDist - dist;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x -= ux * overlap * 0.5;
          a.y -= uy * overlap * 0.5;
          b.x += ux * overlap * 0.5;
          b.y += uy * overlap * 0.5;
            }
          }
        }
      }

      const pad = 24;
      for (const [id, pos] of next) {
        const clamped = {
          x: Math.min(worldWidth - pad, Math.max(pad, pos.x)),
          y: Math.min(worldHeight - pad, Math.max(pad, pos.y)),
        };
        next.set(id, clamped);
      }

      displayLayoutRef.current = next;
      setDisplayLayout(next);
      if (maxVelocity < 0.05) {
        quietFrames += 1;
      } else {
        quietFrames = 0;
      }
      if (quietFrames > 30) {
        return;
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [layout, nodes, selectedId, worldHeight, worldWidth]);

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
    if (cameraActionType === "reset") {
      setAnimatedCamera(true);
      setCamera(initialCameraForWorld(viewport.width, viewport.height, worldWidth, worldHeight));
      const timer = window.setTimeout(() => setAnimatedCamera(false), 760);
      return () => window.clearTimeout(timer);
    }
    const currentLayout = displayLayoutRef.current;
    const targetIds =
      cameraActionType === "frame-selection" && selectedId
        ? new Set([selectedId, ...Array.from(neighborIds)])
        : null;
    const subset = new Map<string, { x: number; y: number }>();
    if (targetIds) {
      for (const [id, point] of currentLayout.entries()) {
        if (targetIds.has(id)) subset.set(id, point);
      }
    }
    const bounds = computeBounds(targetIds ? subset : currentLayout);
    if (!bounds) return;
    const boxW = Math.max(80, bounds.maxX - bounds.minX);
    const boxH = Math.max(80, bounds.maxY - bounds.minY);
    const scale = Math.min(2.2, Math.max(0.4, Math.min(viewport.width / (boxW + 180), viewport.height / (boxH + 180))));
    const centerX = (bounds.minX + bounds.maxX) * 0.5;
    const centerY = (bounds.minY + bounds.maxY) * 0.5;
    setAnimatedCamera(true);
    setCamera({
      scale,
      x: viewport.width * 0.5 - centerX * scale,
      y: viewport.height * 0.5 - centerY * scale,
    });
    const timer = window.setTimeout(() => setAnimatedCamera(false), 760);
    return () => window.clearTimeout(timer);
  }, [
    cameraActionKey,
    cameraActionType,
    neighborIds,
    selectedId,
    viewport.height,
    viewport.width,
    worldHeight,
    worldWidth,
  ]);

  useEffect(() => {
    if (!selectedId) {
      setAnimatedCamera(true);
      setCamera(initialCameraForWorld(viewport.width, viewport.height, worldWidth, worldHeight));
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
  }, [layout, selectedId, viewport.height, viewport.width, worldHeight, worldWidth]);

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
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
      didMove: false,
    };
    setAnimatedCamera(false);
    setDraggingCanvas(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pan.startX;
    const deltaY = event.clientY - pan.startY;
    if (!pan.didMove && Math.hypot(deltaX, deltaY) < 3) return;
    pan.didMove = true;
    setCamera((prev) => ({
      ...prev,
      x: pan.cameraX + deltaX,
      y: pan.cameraY + deltaY,
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
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
    const delta = Math.exp(-event.deltaY * 0.0015);
    const nextScale = Math.min(2.5, Math.max(0.4, camera.scale * delta));
    const worldBefore = toWorldCoordinates(event.clientX, event.clientY, rect, camera);
    const nextX = event.clientX - rect.left - worldBefore.x * nextScale;
    const nextY = event.clientY - rect.top - worldBefore.y * nextScale;
    setCamera({ x: nextX, y: nextY, scale: nextScale });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") setCamera((prev) => ({ ...prev, x: prev.x + 24 }));
      if (event.key === "ArrowRight") setCamera((prev) => ({ ...prev, x: prev.x - 24 }));
      if (event.key === "ArrowUp") setCamera((prev) => ({ ...prev, y: prev.y + 24 }));
      if (event.key === "ArrowDown") setCamera((prev) => ({ ...prev, y: prev.y - 24 }));
      if (event.key === "+" || event.key === "=") {
        setCamera((prev) => ({ ...prev, scale: Math.min(2.5, prev.scale * 1.08) }));
      }
      if (event.key === "-") {
        setCamera((prev) => ({ ...prev, scale: Math.max(0.4, prev.scale / 1.08) }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
          width: worldWidth,
          height: worldHeight,
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
        }}
      >
        <svg
          className={styles.edgeSvg}
          viewBox={`0 0 ${worldWidth} ${worldHeight}`}
          preserveAspectRatio="none"
        >
          {edges
            .filter((edge) => visibleEdgeSet.has(edge.id))
            .map((edge) => {
              const source = layout.get(edge.source);
              const target = displayLayout.get(edge.target);
              const src = displayLayout.get(edge.source) ?? source;
              const dst = target;
              if (!src || !dst) return null;
              const selected = selectedId !== null;
              const active = selected && activeEdgeIds.has(edge.id);
              const relation = getRelationStyle(edge.linkType);
              return (
                <g key={edge.id}>
                  <line
                    className={classNames(
                      styles.edge,
                      selected && !active && styles.edgeDimmed,
                      active && styles.edgeActive,
                    )}
                    x1={src.x}
                    y1={src.y}
                    x2={dst.x}
                    y2={dst.y}
                    style={{ stroke: relation.accent, strokeDasharray: relation.strokeDasharray }}
                  />
                  <line
                    className={styles.edgeHit}
                    x1={src.x}
                    y1={src.y}
                    x2={dst.x}
                    y2={dst.y}
                    onMouseEnter={() => {
                      const hover: GraphEdgeHover = {
                        edgeId: edge.id,
                        sourceId: edge.source,
                        targetId: edge.target,
                        linkType: edge.linkType,
                        x: (src.x + dst.x) * 0.5,
                        y: (src.y + dst.y) * 0.5,
                      };
                      onEdgeHover?.(hover);
                    }}
                    onMouseLeave={() => onEdgeHover?.(null)}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdgeSelect?.(edge.id);
                    }}
                  />
                </g>
              );
            })}
        </svg>

        {nodes.map((node) => {
          const point = displayLayout.get(node.id) ?? layout.get(node.id);
          if (!point) return null;
          const selected = selectedId !== null;
          const isSelected = selectedId === node.id;
          const isNeighbor = neighborIds.has(node.id);
          const isDimmed = selected && !isSelected && !isNeighbor;
          const typeStyle = getEntityTypeStyle(node.entityType);
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
              onClick={(event) => {
                event.stopPropagation();
                if (event.altKey) {
                  onNodePin?.(node.id, { x: Number.NaN, y: Number.NaN });
                  return;
                }
                onSelect(node.id);
              }}
            >
              <span className={styles.pillTypeDot} style={{ background: typeStyle.dotColor }} />
              {truncateLabel(node.title)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
