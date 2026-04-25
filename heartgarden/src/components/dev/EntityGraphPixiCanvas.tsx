"use client";

import { Application, Container, Graphics } from "pixi.js";
import { useEffect, useMemo, useRef, useState } from "react";

import type { GraphCanvasSharedProps } from "@/src/components/dev/entity-graph-renderer-types";
import { estimatePillGeometry } from "@/src/lib/entity-graph-pill-geometry";
import { getEntityTypeStyle } from "@/src/lib/entity-graph-type-style";
import styles from "@/src/components/dev/entity-graph-lab.module.css";

/**
 * Pixi renderer with a viewport-bounded HTML overlay at close zoom.
 * WebGL handles large graph primitives, HTML handles close-range pill readability.
 */
export function EntityGraphPixiCanvas(props: GraphCanvasSharedProps) {
  const {
    nodes,
    edges,
    layout,
    selectedId,
    neighborIds,
    activeEdgeIds,
    cameraActionKey,
    cameraActionType,
    onSelect,
    onEdgeHover,
    onEdgeSelect,
    onLayoutChange,
    onNodePin,
  } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const edgesRef = useRef<Graphics | null>(null);
  const nodesRef = useRef<Graphics | null>(null);
  const worldRef = useRef<Container | null>(null);
  const [viewport, setViewport] = useState({ width: 1000, height: 760 });
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(
    null,
  );
  const pointerMovedRef = useRef(false);

  const edgesWithPoints = useMemo(
    () =>
      edges
        .map((edge) => {
          const src = layout.get(edge.source);
          const dst = layout.get(edge.target);
          if (!src || !dst) return null;
          return { edge, src, dst };
        })
        .filter((value): value is { edge: (typeof edges)[number]; src: { x: number; y: number }; dst: { x: number; y: number } } => value !== null),
    [edges, layout],
  );

  const nearestEdgeAt = (worldX: number, worldY: number) => {
    let best:
      | {
          edgeId: string;
          sourceId: string;
          targetId: string;
          linkType: string | null;
          x: number;
          y: number;
          distance: number;
        }
      | null = null;

    for (const entry of edgesWithPoints) {
      const { src, dst, edge } = entry;
      const vx = dst.x - src.x;
      const vy = dst.y - src.y;
      const lenSq = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((worldX - src.x) * vx + (worldY - src.y) * vy) / lenSq));
      const px = src.x + vx * t;
      const py = src.y + vy * t;
      const dist = Math.hypot(worldX - px, worldY - py);
      if (!best || dist < best.distance) {
        best = {
          edgeId: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          linkType: edge.linkType ?? null,
          x: (src.x + dst.x) * 0.5,
          y: (src.y + dst.y) * 0.5,
          distance: dist,
        };
      }
    }
    return best;
  };

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    let disposed = false;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setViewport({ width: rect.width, height: rect.height });
    });
    observer.observe(node);

    const app = new Application();
    void app
      .init({
        width: node.clientWidth || 1000,
        height: node.clientHeight || 760,
        backgroundAlpha: 0,
        antialias: true,
      })
      .then(() => {
        if (disposed) return;
        node.appendChild(app.canvas);
        const world = new Container();
        const edgesLayer = new Graphics();
        const nodesLayer = new Graphics();
        world.addChild(edgesLayer);
        world.addChild(nodesLayer);
        app.stage.addChild(world);
        worldRef.current = world;
        edgesRef.current = edgesLayer;
        nodesRef.current = nodesLayer;
        appRef.current = app;
      });

    return () => {
      disposed = true;
      observer.disconnect();
      app.destroy(true);
      appRef.current = null;
      edgesRef.current = null;
      nodesRef.current = null;
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    app.renderer.resize(viewport.width, viewport.height);
  }, [viewport.height, viewport.width]);

  useEffect(() => {
    if (cameraActionType === "reset") {
      setCamera({
        x: (viewport.width - 1000) * 0.5,
        y: (viewport.height - 1000) * 0.5,
        scale: 1,
      });
      return;
    }
    const targetIds =
      cameraActionType === "frame-selection" && selectedId
        ? new Set([selectedId, ...Array.from(neighborIds)])
        : null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [id, point] of layout.entries()) {
      if (targetIds && !targetIds.has(id)) continue;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    if (!Number.isFinite(minX)) return;
    const w = Math.max(100, maxX - minX);
    const h = Math.max(100, maxY - minY);
    const scale = Math.min(2.2, Math.max(0.35, Math.min(viewport.width / (w + 180), viewport.height / (h + 180))));
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    setCamera({
      scale,
      x: viewport.width * 0.5 - cx * scale,
      y: viewport.height * 0.5 - cy * scale,
    });
  }, [cameraActionKey, cameraActionType, layout, neighborIds, selectedId, viewport.height, viewport.width]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.position.set(camera.x, camera.y);
    world.scale.set(camera.scale);
  }, [camera]);

  useEffect(() => {
    const edgeGraphics = edgesRef.current;
    const nodeGraphics = nodesRef.current;
    if (!edgeGraphics || !nodeGraphics) return;
    edgeGraphics.clear();
    nodeGraphics.clear();

    const selected = selectedId !== null;
    for (const edge of edges) {
      const src = layout.get(edge.source);
      const dst = layout.get(edge.target);
      if (!src || !dst) continue;
      const active = selected && activeEdgeIds.has(edge.id);
      const alpha = selected && !active ? 0.08 : 0.72;
      const thickness = active ? 1.8 : 1;
      const color = active ? 0xf8a060 : 0x8a8f98;
      edgeGraphics.moveTo(src.x, src.y);
      edgeGraphics.lineTo(dst.x, dst.y);
      edgeGraphics.stroke({ color, alpha, width: thickness });
    }

    for (const node of nodes) {
      const point = layout.get(node.id);
      if (!point) continue;
      const style = getEntityTypeStyle(node.entityType);
      const selectedNode = node.id === selectedId;
      const neighbor = neighborIds.has(node.id);
      const dimmed = selected && !selectedNode && !neighbor;
      const geom = estimatePillGeometry(node.title);
      const radius = camera.scale < 0.58 ? 4 : Math.max(5, geom.collisionRadius * 0.18);
      const alpha = dimmed ? 0.16 : selectedNode ? 1 : 0.74;
      nodeGraphics.circle(point.x, point.y, radius);
      nodeGraphics.fill({ color: Number.parseInt(style.dotColor.slice(5, 11), 16) || 0xffffff, alpha });
    }
  }, [activeEdgeIds, camera.scale, edges, layout, neighborIds, nodes, selectedId]);

  const overlayNodes = useMemo(() => {
    if (camera.scale < 1.08) return [];
    const inView: Array<{ id: string; x: number; y: number; title: string; selected: boolean; neighbor: boolean }> = [];
    for (const node of nodes) {
      const point = layout.get(node.id);
      if (!point) continue;
      const sx = point.x * camera.scale + camera.x;
      const sy = point.y * camera.scale + camera.y;
      if (sx < -40 || sy < -40 || sx > viewport.width + 40 || sy > viewport.height + 40) continue;
      inView.push({
        id: node.id,
        x: point.x,
        y: point.y,
        title: node.title,
        selected: node.id === selectedId,
        neighbor: neighborIds.has(node.id),
      });
      if (inView.length >= 140) break;
    }
    return inView;
  }, [camera.scale, camera.x, camera.y, layout, neighborIds, nodes, selectedId, viewport.height, viewport.width]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    pointerMovedRef.current = false;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: camera.x,
      y: camera.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = hostRef.current?.getBoundingClientRect();
    if (rect) {
      const worldX = (event.clientX - rect.left - camera.x) / camera.scale;
      const worldY = (event.clientY - rect.top - camera.y) / camera.scale;
      const hover = nearestEdgeAt(worldX, worldY);
      const tolerance = camera.scale < 0.8 ? 22 : 14;
      onEdgeHover?.(hover && hover.distance <= tolerance ? hover : null);
    }

    if (panRef.current?.pointerId !== event.pointerId) return;
    const dx = event.clientX - panRef.current.startX;
    const dy = event.clientY - panRef.current.startY;
    if (Math.hypot(dx, dy) > 2) pointerMovedRef.current = true;
    setCamera((prev) => ({ ...prev, x: panRef.current!.x + dx, y: panRef.current!.y + dy }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    const rect = hostRef.current?.getBoundingClientRect();
    if (rect && !pointerMovedRef.current) {
      const worldX = (event.clientX - rect.left - camera.x) / camera.scale;
      const worldY = (event.clientY - rect.top - camera.y) / camera.scale;
      const hover = nearestEdgeAt(worldX, worldY);
      const tolerance = camera.scale < 0.8 ? 22 : 14;
      if (hover && hover.distance <= tolerance) {
        onEdgeSelect?.(hover.edgeId);
        onEdgeHover?.(hover);
      }
    }
    panRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // noop
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return;
    const delta = Math.exp(-event.deltaY * 0.0015);
    const nextScale = Math.min(2.5, Math.max(0.35, camera.scale * delta));
    const worldX = (event.clientX - rect.left - camera.x) / camera.scale;
    const worldY = (event.clientY - rect.top - camera.y) / camera.scale;
    setCamera({
      scale: nextScale,
      x: event.clientX - rect.left - worldX * nextScale,
      y: event.clientY - rect.top - worldY * nextScale,
    });
  };

  return (
    <div
      ref={hostRef}
      className={styles.graphRoot}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onClick={() => {
        onSelect(null);
        onEdgeSelect?.(null);
      }}
      role="presentation"
    >
      {overlayNodes.map((node) => (
        <button
          key={node.id}
          type="button"
          className={`${styles.pillNode} ${node.selected ? styles.pillNodeSelected : ""} ${
            !node.selected && node.neighbor ? styles.pillNodeNeighbor : ""
          }`}
          style={{ left: node.x, top: node.y, transform: "translate(-50%, -50%)" }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(node.id);
          }}
          onMouseEnter={() => onEdgeHover?.(null)}
          onPointerDown={(event) => {
            if (!event.shiftKey) return;
            if (!layout.get(node.id)) return;
            event.stopPropagation();
            const rect = hostRef.current?.getBoundingClientRect();
            if (!rect) return;
            const world = {
              x: (event.clientX - rect.left - camera.x) / camera.scale,
              y: (event.clientY - rect.top - camera.y) / camera.scale,
            };
            const base = layout.get(node.id)!;
            const move = (moveEvent: PointerEvent) => {
              const nextWorld = {
                x: (moveEvent.clientX - rect.left - camera.x) / camera.scale,
                y: (moveEvent.clientY - rect.top - camera.y) / camera.scale,
              };
              const next = new Map(layout);
              next.set(node.id, {
                x: nextWorld.x - (world.x - base.x),
                y: nextWorld.y - (world.y - base.y),
              });
              onLayoutChange?.(next);
            };
            const up = (upEvent: PointerEvent) => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
              const finalPos = layout.get(node.id);
              if (event.altKey) {
                onNodePin?.(node.id, { x: Number.NaN, y: Number.NaN });
                return;
              }
              if (finalPos) onNodePin?.(node.id, finalPos);
              upEvent.preventDefault();
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          {node.title}
        </button>
      ))}
    </div>
  );
}
