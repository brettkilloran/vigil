"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";

import type { GraphCanvasSharedProps } from "@/src/components/dev/entity-graph-renderer-types";
import styles from "@/src/components/dev/entity-graph-lab.module.css";
import { estimatePillGeometry } from "@/src/lib/entity-graph-pill-geometry";
import { getEntityTypeStyle } from "@/src/lib/entity-graph-type-style";

type ForceNode = {
  id: string;
  title: string;
  x: number;
  y: number;
  entityType: string | null;
};

type ForceEdge = {
  id: string;
  source: string;
  target: string;
};

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

/**
 * React-force-graph directional prototype for bake-off comparison.
 */
export function EntityGraphRfgCanvas(props: GraphCanvasSharedProps) {
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
  } = props;
  const graphRef = useRef<any>(undefined);

  const data = useMemo(() => {
    const graphNodes: ForceNode[] = nodes
      .map((node) => {
        const point = layout.get(node.id);
        if (!point) return null;
        return {
          id: node.id,
          title: node.title,
          x: point.x,
          y: point.y,
          entityType: node.entityType,
        };
      })
      .filter((value): value is ForceNode => value !== null);
    const graphEdges: ForceEdge[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    }));
    return { nodes: graphNodes, links: graphEdges };
  }, [edges, layout, nodes]);

  const hasSelection = selectedId !== null;

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    if (cameraActionType === "reset") {
      graph.centerAt(500, 500, 320);
      graph.zoom(1, 320);
      return;
    }
    if (cameraActionType === "frame-selection" && selectedId) {
      graph.zoomToFit(
        320,
        120,
        (node: unknown) =>
          selectedId === (node as ForceNode).id || neighborIds.has((node as ForceNode).id),
      );
      return;
    }
    graph.zoomToFit(320, 80);
  }, [cameraActionKey, cameraActionType, neighborIds, selectedId]);

  return (
    <div className={styles.graphRoot}>
      <ForceGraph2D
        ref={graphRef}
        graphData={data}
        cooldownTicks={0}
        d3AlphaDecay={1}
        d3VelocityDecay={1}
        nodeRelSize={5}
        onNodeClick={(node) => onSelect((node as ForceNode).id)}
        onLinkClick={(link) => onEdgeSelect?.((link as ForceEdge).id)}
        onLinkHover={(link) => {
          if (!link) {
            onEdgeHover?.(null);
            return;
          }
          const edge = link as ForceEdge;
          const source = typeof edge.source === "string" ? edge.source : (edge.source as ForceNode).id;
          const target = typeof edge.target === "string" ? edge.target : (edge.target as ForceNode).id;
          const srcPos = layout.get(source);
          const dstPos = layout.get(target);
          if (!srcPos || !dstPos) {
            onEdgeHover?.(null);
            return;
          }
          const fullEdge = edges.find((candidate) => candidate.id === edge.id);
          onEdgeHover?.({
            edgeId: edge.id,
            sourceId: source,
            targetId: target,
            linkType: fullEdge?.linkType ?? null,
            x: (srcPos.x + dstPos.x) * 0.5,
            y: (srcPos.y + dstPos.y) * 0.5,
          });
        }}
        onBackgroundClick={() => {
          onSelect(null);
          onEdgeSelect?.(null);
          onEdgeHover?.(null);
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const typed = node as ForceNode;
          const point = layout.get(typed.id);
          if (!point) return;
          const style = getEntityTypeStyle(typed.entityType);
          const selected = typed.id === selectedId;
          const neighbor = neighborIds.has(typed.id);
          const dimmed = hasSelection && !selected && !neighbor;
          const geom = estimatePillGeometry(typed.title);
          const width = Math.min(220, geom.width);
          const height = 24;
          const x = point.x;
          const y = point.y;
          ctx.save();
          ctx.globalAlpha = dimmed ? 0.2 : 0.9;
          ctx.fillStyle = selected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)";
          ctx.strokeStyle = style.edgeTint;
          ctx.lineWidth = selected ? 1.8 : 1;
          ctx.beginPath();
          const rx = height * 0.5;
          ctx.moveTo(x - width / 2 + rx, y - height / 2);
          ctx.arcTo(x + width / 2, y - height / 2, x + width / 2, y + height / 2, rx);
          ctx.arcTo(x + width / 2, y + height / 2, x - width / 2, y + height / 2, rx);
          ctx.arcTo(x - width / 2, y + height / 2, x - width / 2, y - height / 2, rx);
          ctx.arcTo(x - width / 2, y - height / 2, x + width / 2, y - height / 2, rx);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = style.dotColor;
          ctx.beginPath();
          ctx.arc(x - width / 2 + 12, y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = selected ? "#0b0b0c" : "rgba(255,255,255,0.92)";
          ctx.font = `${selected ? 700 : 600} ${Math.max(10, 10 / globalScale)}px Geist, sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          const trimmed = typed.title.length > 28 ? `${typed.title.slice(0, 27)}…` : typed.title;
          ctx.fillText(trimmed, x - width / 2 + 20, y);
          ctx.restore();
        }}
        linkColor={(link) => {
          const edge = link as ForceEdge;
          if (!hasSelection) return "rgba(140,140,150,0.7)";
          return activeEdgeIds.has(edge.id) ? "rgba(245,170,118,0.95)" : "rgba(140,140,150,0.1)";
        }}
        linkWidth={(link) => (activeEdgeIds.has((link as ForceEdge).id) ? 2 : 1)}
        linkDirectionalParticles={(link) => (activeEdgeIds.has((link as ForceEdge).id) ? 2 : 0)}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={() => "rgba(245,170,118,0.92)"}
        nodePointerAreaPaint={(node, color, ctx) => {
          const typed = node as ForceNode;
          const point = layout.get(typed.id);
          if (!point) return;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 16, 0, Math.PI * 2);
          ctx.fill();
        }}
      />
    </div>
  );
}
