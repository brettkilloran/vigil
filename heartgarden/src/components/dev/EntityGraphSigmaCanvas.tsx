"use client";

import Graph from "graphology";
import Sigma from "sigma";
import { useEffect, useMemo, useRef } from "react";

import type { GraphCanvasSharedProps } from "@/src/components/dev/entity-graph-renderer-types";
import styles from "@/src/components/dev/entity-graph-lab.module.css";
import { getEntityTypeStyle } from "@/src/lib/entity-graph-type-style";

/**
 * Sigma directional prototype for bake-off comparison.
 */
export function EntityGraphSigmaCanvas(props: GraphCanvasSharedProps) {
  const {
    nodes,
    edges,
    layout,
    selectedId,
    neighborIds,
    activeEdgeIds,
    cameraActionType,
    cameraActionKey,
    onSelect,
    onEdgeSelect,
  } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);

  const graph = useMemo(() => {
    const g = new Graph();
    for (const node of nodes) {
      const point = layout.get(node.id);
      if (!point) continue;
      const style = getEntityTypeStyle(node.entityType);
      const isSelected = node.id === selectedId;
      const isNeighbor = neighborIds.has(node.id);
      const dimmed = selectedId !== null && !isSelected && !isNeighbor;
      g.addNode(node.id, {
        x: point.x / 1000,
        y: point.y / 1000,
        size: isSelected ? 9 : 6,
        label: node.title,
        color: style.dotColor,
        hidden: false,
        forceLabel: isSelected,
        zIndex: isSelected ? 3 : 1,
        highlighted: isSelected || isNeighbor,
        dimmed,
      });
    }
    for (const edge of edges) {
      if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) continue;
      const active = selectedId !== null && activeEdgeIds.has(edge.id);
      const dimmed = selectedId !== null && !active;
      g.addEdgeWithKey(edge.id, edge.source, edge.target, {
        size: active ? 2.2 : 1,
        color: active ? "rgba(250,170,120,0.95)" : "rgba(150,150,160,0.75)",
        hidden: false,
        zIndex: active ? 2 : 1,
        type: "line",
        dimmed,
      });
    }
    return g;
  }, [activeEdgeIds, edges, layout, neighborIds, nodes, selectedId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const sigma = new Sigma(graph, host, {
      renderLabels: true,
      renderEdgeLabels: false,
      defaultNodeColor: "rgba(200,200,200,0.9)",
      defaultEdgeColor: "rgba(140,140,150,0.75)",
      minCameraRatio: 0.2,
      maxCameraRatio: 3.5,
      labelRenderedSizeThreshold: 8,
      allowInvalidContainer: true,
      zIndex: true,
    });
    sigmaRef.current = sigma;
    sigma.on("clickNode", ({ node }) => onSelect(node));
    sigma.on("clickEdge", ({ edge }) => onEdgeSelect?.(edge));
    sigma.on("clickStage", () => {
      onSelect(null);
      onEdgeSelect?.(null);
    });
    return () => {
      sigma.kill();
      sigmaRef.current = null;
    };
  }, [graph, onEdgeSelect, onSelect]);

  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;
    if (cameraActionType === "reset") {
      sigma.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1.3 }, { duration: 360 });
      return;
    }
    const targetIds =
      cameraActionType === "frame-selection" && selectedId
        ? new Set([selectedId, ...Array.from(neighborIds)])
        : new Set(nodes.map((node) => node.id));
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const id of targetIds) {
      if (!graph.hasNode(id)) continue;
      const x = graph.getNodeAttribute(id, "x") as number;
      const y = graph.getNodeAttribute(id, "y") as number;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    if (!Number.isFinite(minX)) return;
    sigma.getCamera().animate(
      {
        x: (minX + maxX) * 0.5,
        y: (minY + maxY) * 0.5,
        ratio: Math.max(0.22, Math.min(2.4, Math.max(maxX - minX, maxY - minY) * 4.2)),
      },
      { duration: 360 },
    );
  }, [cameraActionKey, cameraActionType, graph, neighborIds, nodes, selectedId]);

  return <div ref={hostRef} className={styles.graphRoot} role="presentation" />;
}
