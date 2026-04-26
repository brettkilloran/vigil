"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "@/src/components/dev/entity-graph-lab.module.css";
import type {
  GraphCanvasSharedProps,
  GraphEdgeHover,
  LayoutMap,
} from "@/src/components/dev/entity-graph-renderer-types";
import { getRelationStyle } from "@/src/lib/entity-graph-relation-style";
import { getEntityTypeStyle } from "@/src/lib/entity-graph-type-style";
import {
  CustomWebGLRenderer,
  type RenderEdge,
  type RenderNode,
} from "@/src/lib/graph-webgl/renderer";
import { TextAtlas } from "@/src/lib/graph-webgl/text-atlas";

type CameraTransform = {
  x: number;
  y: number;
  scale: number;
};

type PreparedScene = {
  nodes: RenderNode[];
  edges: RenderEdge[];
  culledNodes: number;
  culledEdges: number;
};

const DEFAULT_NODE_COLOR: [number, number, number, number] = [0.83, 0.85, 0.89, 0.85];
const DEFAULT_EDGE_COLOR: [number, number, number, number] = [0.54, 0.54, 0.58, 0.5];

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function truncateLabel(input: string, max = 28): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function parseRgba(input: string, fallback: [number, number, number, number]): [number, number, number, number] {
  const m = input.match(/rgba?\(([^)]+)\)/i);
  if (!m) return fallback;
  const parts = m[1]?.split(",").map((part) => Number(part.trim())) ?? [];
  if (parts.length < 3) return fallback;
  const r = Number.isFinite(parts[0]) ? parts[0] / 255 : fallback[0];
  const g = Number.isFinite(parts[1]) ? parts[1] / 255 : fallback[1];
  const b = Number.isFinite(parts[2]) ? parts[2] / 255 : fallback[2];
  const a = Number.isFinite(parts[3]) ? parts[3] : fallback[3];
  return [r, g, b, Math.max(0, Math.min(1, a))];
}

function initialCameraForWorld(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
): CameraTransform {
  return {
    scale: 1,
    x: (viewportWidth - worldWidth) / 2,
    y: (viewportHeight - worldHeight) / 2,
  };
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

function toScreenCoordinates(point: { x: number; y: number }, camera: CameraTransform): { x: number; y: number } {
  return {
    x: point.x * camera.scale + camera.x,
    y: point.y * camera.scale + camera.y,
  };
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

function cameraForLayoutBounds(
  layout: LayoutMap,
  viewportWidth: number,
  viewportHeight: number,
): CameraTransform | null {
  const bounds = computeBounds(layout);
  if (!bounds) return null;
  const boxW = Math.max(80, bounds.maxX - bounds.minX);
  const boxH = Math.max(80, bounds.maxY - bounds.minY);
  const scale = Math.min(2.4, Math.max(0.2, Math.min(viewportWidth / (boxW + 220), viewportHeight / (boxH + 220))));
  const centerX = (bounds.minX + bounds.maxX) * 0.5;
  const centerY = (bounds.minY + bounds.maxY) * 0.5;
  return {
    scale,
    x: viewportWidth * 0.5 - centerX * scale,
    y: viewportHeight * 0.5 - centerY * scale,
  };
}

function distancePointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 0.0001) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return Math.hypot(px - cx, py - cy);
}

export function EntityGraphWebGLCanvas({
  nodes,
  edges,
  layout,
  worldWidth,
  worldHeight,
  selectedId,
  neighborIds,
  activeEdgeIds,
  degreeByNode,
  onSelect,
  onNodePin,
  cameraActionKey,
  cameraActionType,
  onEdgeHover,
  onEdgeSelect,
}: GraphCanvasSharedProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CustomWebGLRenderer | null>(null);
  const textAtlasRef = useRef<TextAtlas | null>(null);
  const cameraRef = useRef<CameraTransform>(initialCameraForWorld(1000, 760, worldWidth, worldHeight));
  const [camera, setCamera] = useState<CameraTransform>(cameraRef.current);
  const [viewport, setViewport] = useState({ width: 1000, height: 760 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [renderStats, setRenderStats] = useState({ nodes: 0, edges: 0 });
  const interactTimeoutRef = useRef<number | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    cameraX: number;
    cameraY: number;
    didMove: boolean;
  } | null>(null);
  const lastHandledCameraActionKeyRef = useRef<number>(-1);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setViewport({ width: rect.width, height: rect.height });
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const prepared = useMemo<PreparedScene>(() => {
    const hasSelection = selectedId !== null;
    const selectedSet = selectedId ? new Set([selectedId, ...Array.from(neighborIds)]) : new Set<string>();
    const nodeBudget = isInteracting ? 3200 : 12000;
    const edgeBudget = isInteracting ? 4500 : 24000;
    const margin = isInteracting ? 40 : 120;

    const nodeCandidates: Array<RenderNode & { priority: number }> = [];
    for (const node of nodes) {
      const point = layout.get(node.id);
      if (!point) continue;
      const isSelected = selectedId === node.id;
      const isNeighbor = neighborIds.has(node.id);
      const isHovered = hoveredNodeId === node.id;
      const dimmed = hasSelection && !isSelected && !isNeighbor;
      const degree = degreeByNode?.get(node.id) ?? 1;
      const size = 9.5;
      const typeColor = parseRgba(getEntityTypeStyle(node.entityType).dotColor, DEFAULT_NODE_COLOR);
      const alpha = dimmed ? 0.2 : isSelected ? 0.98 : isHovered ? 0.96 : isNeighbor ? 0.88 : 0.78;
      const color: [number, number, number, number] = [typeColor[0], typeColor[1], typeColor[2], alpha];
      const screen = toScreenCoordinates(point, camera);
      const inside =
        screen.x >= -margin &&
        screen.y >= -margin &&
        screen.x <= viewport.width + margin &&
        screen.y <= viewport.height + margin;
      const priority =
        (isSelected ? 1_000_000 : 0) +
        (isHovered ? 500_000 : 0) +
        (isNeighbor ? 250_000 : 0) +
        degree * 10 +
        (inside ? 1000 : 0);
      if (inside || isSelected || isNeighbor) {
        nodeCandidates.push({
          id: node.id,
          label: node.title,
          x: point.x,
          y: point.y,
          size,
          color,
          priority,
        });
      }
    }

    nodeCandidates.sort((a, b) => b.priority - a.priority);
    const nodesToDraw = nodeCandidates.slice(0, nodeBudget);
    const drawnNodeIds = new Set(nodesToDraw.map((node) => node.id));
    const nodesById = new Map(nodesToDraw.map((node) => [node.id, node]));

    const edgeCandidates: Array<RenderEdge & { priority: number }> = [];
    for (const edge of edges) {
      if (!drawnNodeIds.has(edge.source) || !drawnNodeIds.has(edge.target)) continue;
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);
      if (!source || !target) continue;
      const active = activeEdgeIds.has(edge.id);
      const style = parseRgba(getRelationStyle(edge.linkType).accent, DEFAULT_EDGE_COLOR);
      const color: [number, number, number, number] = hasSelection
        ? active
          ? [style[0], style[1], style[2], 0.9]
          : [0.45, 0.45, 0.49, isInteracting ? 0.03 : 0.08]
        : [style[0], style[1], style[2], isInteracting ? 0.28 : 0.52];
      const priority = (active ? 100_000 : 0) + (selectedSet.has(edge.source) || selectedSet.has(edge.target) ? 10_000 : 0);
      edgeCandidates.push({
        id: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        sourceX: source.x,
        sourceY: source.y,
        targetX: target.x,
        targetY: target.y,
        color,
        priority,
      });
    }
    edgeCandidates.sort((a, b) => b.priority - a.priority);
    const edgesToDraw = edgeCandidates.slice(0, edgeBudget);
    return {
      nodes: nodesToDraw,
      edges: edgesToDraw,
      culledNodes: Math.max(0, nodes.length - nodesToDraw.length),
      culledEdges: Math.max(0, edges.length - edgesToDraw.length),
    };
  }, [
    activeEdgeIds,
    camera,
    degreeByNode,
    edges,
    hoveredNodeId,
    isInteracting,
    layout,
    neighborIds,
    nodes,
    selectedId,
    viewport.height,
    viewport.width,
  ]);

  useEffect(() => {
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = new CustomWebGLRenderer(canvas);
      textAtlasRef.current = new TextAtlas();
    } catch {
      rendererRef.current = null;
      textAtlasRef.current = null;
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
      textAtlasRef.current?.clear();
      textAtlasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    const glCanvas = glCanvasRef.current;
    if (!renderer || !glCanvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    renderer.resize(viewport.width, viewport.height, dpr);
    const stats = renderer.render(prepared, camera);
    setRenderStats({ nodes: stats.drawnNodes, edges: stats.drawnEdges });
  }, [camera, prepared, viewport.height, viewport.width]);

  useEffect(() => {
    const atlas = textAtlasRef.current;
    if (!atlas) return;
    if (isInteracting) return;
    for (const node of prepared.nodes) {
      if (node.id !== selectedId && !neighborIds.has(node.id)) continue;
      atlas.getLabel(truncateLabel(node.label ?? node.id), node.id === selectedId);
    }
  }, [isInteracting, neighborIds, prepared.nodes, selectedId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!selectedId) return;
      onSelect(null);
      onEdgeSelect?.(null);
      onEdgeHover?.(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onEdgeHover, onEdgeSelect, onSelect, selectedId]);

  useEffect(() => {
    if (lastHandledCameraActionKeyRef.current === cameraActionKey) {
      return;
    }
    lastHandledCameraActionKeyRef.current = cameraActionKey;
    if (cameraActionType === "reset") {
      const framed = cameraForLayoutBounds(layout, viewport.width, viewport.height);
      setCamera(
        framed ?? initialCameraForWorld(viewport.width, viewport.height, worldWidth, worldHeight),
      );
      return;
    }
    const selectedSubset = new Map<string, { x: number; y: number }>();
    if (cameraActionType === "frame-selection" && selectedId) {
      for (const [id, point] of layout.entries()) {
        if (id === selectedId || neighborIds.has(id)) selectedSubset.set(id, point);
      }
    }
    const targetLayout = selectedSubset.size > 0 ? selectedSubset : layout;
    const bounds = computeBounds(targetLayout);
    if (!bounds) return;
    const boxW = Math.max(80, bounds.maxX - bounds.minX);
    const boxH = Math.max(80, bounds.maxY - bounds.minY);
    const scale = Math.min(2.4, Math.max(0.28, Math.min(viewport.width / (boxW + 200), viewport.height / (boxH + 200))));
    const centerX = (bounds.minX + bounds.maxX) * 0.5;
    const centerY = (bounds.minY + bounds.maxY) * 0.5;
    setCamera({
      scale,
      x: viewport.width * 0.5 - centerX * scale,
      y: viewport.height * 0.5 - centerY * scale,
    });
  }, [cameraActionKey, cameraActionType, layout, neighborIds, selectedId, viewport.height, viewport.width, worldHeight, worldWidth]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") setCamera((prev) => ({ ...prev, x: prev.x + 24 }));
      if (event.key === "ArrowRight") setCamera((prev) => ({ ...prev, x: prev.x - 24 }));
      if (event.key === "ArrowUp") setCamera((prev) => ({ ...prev, y: prev.y + 24 }));
      if (event.key === "ArrowDown") setCamera((prev) => ({ ...prev, y: prev.y - 24 }));
      if (event.key === "+" || event.key === "=") {
        setCamera((prev) => ({ ...prev, scale: Math.min(2.8, prev.scale * 1.08) }));
      }
      if (event.key === "-") {
        setCamera((prev) => ({ ...prev, scale: Math.max(0.25, prev.scale / 1.08) }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const markInteracting = () => {
    setIsInteracting(true);
    if (interactTimeoutRef.current) window.clearTimeout(interactTimeoutRef.current);
    interactTimeoutRef.current = window.setTimeout(() => setIsInteracting(false), 220);
  };

  const pickNode = (worldX: number, worldY: number): RenderNode | null => {
    let best: RenderNode | null = null;
    let bestDist = Infinity;
    for (const node of prepared.nodes) {
      const r = (node.size * 0.5) / Math.max(0.4, cameraRef.current.scale);
      const dist = Math.hypot(worldX - node.x, worldY - node.y);
      if (dist <= r * 1.8 && dist < bestDist) {
        best = node;
        bestDist = dist;
      }
    }
    return best;
  };

  const pickEdge = (worldX: number, worldY: number): RenderEdge | null => {
    let best: RenderEdge | null = null;
    let bestDist = Infinity;
    for (const edge of prepared.edges) {
      const dist = distancePointToSegment(
        worldX,
        worldY,
        edge.sourceX,
        edge.sourceY,
        edge.targetX,
        edge.targetY,
      );
      if (dist < 12 / Math.max(0.4, cameraRef.current.scale) && dist < bestDist) {
        best = edge;
        bestDist = dist;
      }
    }
    return best;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !rootRef.current) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cameraX: cameraRef.current.x,
      cameraY: cameraRef.current.y,
      didMove: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const world = toWorldCoordinates(event.clientX, event.clientY, rect, cameraRef.current);

    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      const dx = event.clientX - pan.startX;
      const dy = event.clientY - pan.startY;
      if (!pan.didMove && Math.hypot(dx, dy) < 2.5) {
        const hoveredNode = pickNode(world.x, world.y);
        setHoveredNodeId(hoveredNode?.id ?? null);
        return;
      }
      pan.didMove = true;
      setCamera((prev) => ({
        ...prev,
        x: pan.cameraX + dx,
        y: pan.cameraY + dy,
      }));
      markInteracting();
      return;
    }

    const hoveredNode = pickNode(world.x, world.y);
    setHoveredNodeId(hoveredNode?.id ?? null);
    if (hoveredNode) {
      onEdgeHover?.(null);
      return;
    }
    const edge = pickEdge(world.x, world.y);
    if (!edge) {
      onEdgeHover?.(null);
      return;
    }
    const fullEdge = edges.find((candidate) => candidate.id === edge.id);
    const hover: GraphEdgeHover = {
      edgeId: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      linkType: fullEdge?.linkType ?? null,
      x: (edge.sourceX + edge.targetX) * 0.5,
      y: (edge.sourceY + edge.targetY) * 0.5,
    };
    onEdgeHover?.(hover);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      panRef.current = null;
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const world = toWorldCoordinates(event.clientX, event.clientY, rect, cameraRef.current);
      if (!pan.didMove) {
        const node = pickNode(world.x, world.y);
        if (node) {
          if (event.altKey) {
            onNodePin?.(node.id, { x: Number.NaN, y: Number.NaN });
          } else {
            onSelect(node.id);
            onEdgeSelect?.(null);
          }
        } else {
          const edge = pickEdge(world.x, world.y);
          if (edge) {
            onEdgeSelect?.(edge.id);
          } else {
            onSelect(null);
            onEdgeSelect?.(null);
            onEdgeHover?.(null);
          }
        }
      }
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const delta = Math.exp(-event.deltaY * 0.00145);
    const nextScale = Math.min(2.8, Math.max(0.25, cameraRef.current.scale * delta));
    const worldBefore = toWorldCoordinates(event.clientX, event.clientY, rect, cameraRef.current);
    const nextX = event.clientX - rect.left - worldBefore.x * nextScale;
    const nextY = event.clientY - rect.top - worldBefore.y * nextScale;
    setCamera({ x: nextX, y: nextY, scale: nextScale });
    markInteracting();
  };

  useEffect(() => {
    return () => {
      if (interactTimeoutRef.current) window.clearTimeout(interactTimeoutRef.current);
    };
  }, []);

  const cullSummary = `draw ${renderStats.nodes}/${nodes.length} nodes · ${renderStats.edges}/${edges.length} edges · cull ${prepared.culledNodes}/${prepared.culledEdges}`;
  const overlayNodes = useMemo(() => {
    const ids = new Set<string>();
    if (selectedId) {
      ids.add(selectedId);
      let count = 0;
      for (const id of neighborIds) {
        ids.add(id);
        count += 1;
        if (count >= 48) break;
      }
    }
    if (hoveredNodeId) ids.add(hoveredNodeId);
    if (!selectedId) {
      // Keep an always-on readability layer at all densities (including during pan),
      // with capped budgets to preserve frame stability.
      const softCap = isInteracting
        ? nodes.length <= 1200
          ? 320
          : nodes.length <= 4000
            ? 220
            : 140
        : nodes.length <= 1200
          ? 1200
          : nodes.length <= 4000
            ? 900
            : 700;
      const candidates: Array<{ id: string; score: number }> = [];
      for (const node of nodes) {
        const point = layout.get(node.id);
        if (!point) continue;
        const screen = toScreenCoordinates(point, camera);
        if (
          screen.x < -160 ||
          screen.y < -120 ||
          screen.x > viewport.width + 160 ||
          screen.y > viewport.height + 120
        ) {
          continue;
        }
        const degree = degreeByNode?.get(node.id) ?? 1;
        const centerBias =
          1 /
          (1 +
            Math.hypot(
              screen.x - viewport.width * 0.5,
              screen.y - viewport.height * 0.5,
            ) *
              0.004);
        candidates.push({ id: node.id, score: degree * 10 + centerBias * 30 });
      }
      candidates.sort((a, b) => b.score - a.score);
      for (let i = 0; i < Math.min(softCap, candidates.length); i += 1) {
        const next = candidates[i];
        if (next) ids.add(next.id);
      }
    }
    const result: Array<{
      id: string;
      title: string;
      entityType: string | null;
      screenX: number;
      screenY: number;
      selected: boolean;
      neighbor: boolean;
    }> = [];
    for (const id of ids) {
      const node = nodeById.get(id);
      const point = layout.get(id);
      if (!node || !point) continue;
      const screen = toScreenCoordinates(point, camera);
      if (
        screen.x < -180 ||
        screen.y < -120 ||
        screen.x > viewport.width + 180 ||
        screen.y > viewport.height + 120
      ) {
        continue;
      }
      result.push({
        id,
        title: node.title,
        entityType: node.entityType,
        screenX: screen.x,
        screenY: screen.y,
        selected: id === selectedId,
        neighbor: neighborIds.has(id),
      });
    }
    result.sort((a, b) => Number(a.selected) - Number(b.selected));
    return result;
  }, [
    camera,
    degreeByNode,
    hoveredNodeId,
    isInteracting,
    layout,
    neighborIds,
    nodeById,
    nodes,
    selectedId,
    viewport.height,
    viewport.width,
  ]);

  return (
    <div
      ref={rootRef}
      className={styles.graphRoot}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      role="presentation"
      aria-label={cullSummary}
    >
      <canvas ref={glCanvasRef} className={styles.edgeSvg} />
      <div className={styles.webglHtmlOverlay}>
        {overlayNodes.map((node) => {
          const typeStyle = getEntityTypeStyle(node.entityType);
          return (
            <button
              key={node.id}
              type="button"
              className={classNames(
                styles.pillNode,
                node.selected && styles.pillNodeSelected,
                !node.selected && node.neighbor && styles.pillNodeNeighbor,
              )}
              style={{
                left: node.screenX,
                top: node.screenY,
                paddingInline: "12px",
              }}
              title={node.title}
              onClick={(event) => {
                event.stopPropagation();
                if (event.altKey) {
                  onNodePin?.(node.id, { x: Number.NaN, y: Number.NaN });
                  return;
                }
                onSelect(node.id);
                onEdgeSelect?.(null);
              }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId((current) => (current === node.id ? null : current))}
            >
              <span className={styles.pillTypeDot} style={{ background: typeStyle.dotColor }} />
              {truncateLabel(node.title)}
            </button>
          );
        })}
      </div>
      <div className={styles.edgeTooltip}>{cullSummary}</div>
    </div>
  );
}
