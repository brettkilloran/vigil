"use client";

import { useRef, useState } from "react";

import { computeForceLayout } from "@/src/lib/graph-layout";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

function clientToSvgCoords(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
) {
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    return { x: clientX, y: clientY };
  }
  return new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
}

export function EntityGraphCanvas({
  nodes,
  edges,
  onPick,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onPick: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [layout, setLayout] = useState(() =>
    computeForceLayout(nodes, edges, 1000, 1000)
  );
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const movedRef = useRef(false);

  return (
    <svg
      className="h-full w-full touch-none"
      preserveAspectRatio="xMidYMid meet"
      ref={svgRef}
      viewBox="0 0 1000 1000"
    >
      <title>Entity graph</title>
      {edges.map((e, i) => {
        const a = layout.get(e.source);
        const b = layout.get(e.target);
        if (!(a && b)) {
          return null;
        }
        return (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: graph edges may share the same source-target pair (parallel edges); index disambiguates duplicates
            key={`${e.source}-${e.target}-${i}`}
            stroke="var(--vigil-snap)"
            strokeOpacity={0.45}
            strokeWidth={2}
            x1={a.x}
            x2={b.x}
            y1={a.y}
            y2={b.y}
          />
        );
      })}
      {nodes.map((node) => {
        const p = layout.get(node.id);
        if (!p) {
          return null;
        }
        const label =
          node.title.length > 22 ? `${node.title.slice(0, 20)}…` : node.title;
        return (
          <g key={node.id}>
            <circle
              className="cursor-grab active:cursor-grabbing"
              cx={p.x}
              cy={p.y}
              fill="var(--vigil-btn-bg)"
              onClick={(e) => {
                if (movedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  movedRef.current = false;
                  return;
                }
                onPick(node.id);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const svg = svgRef.current;
                if (!svg) {
                  return;
                }
                const { x, y } = clientToSvgCoords(svg, e.clientX, e.clientY);
                const cur = layout.get(node.id);
                if (!cur) {
                  return;
                }
                dragRef.current = { id: node.id, ox: x - cur.x, oy: y - cur.y };
                movedRef.current = false;
                (e.currentTarget as SVGCircleElement).setPointerCapture(
                  e.pointerId
                );
              }}
              onPointerMove={(e) => {
                if (!dragRef.current) {
                  return;
                }
                const svg = svgRef.current;
                if (!svg) {
                  return;
                }
                const { x, y } = clientToSvgCoords(svg, e.clientX, e.clientY);
                const { id, ox, oy } = dragRef.current;
                movedRef.current = true;
                setLayout((prev) => {
                  const next = new Map(prev);
                  next.set(id, { x: x - ox, y: y - oy });
                  return next;
                });
              }}
              onPointerUp={(e) => {
                const dragging = dragRef.current;
                if (dragging) {
                  try {
                    (e.currentTarget as SVGCircleElement).releasePointerCapture(
                      e.pointerId
                    );
                  } catch {
                    // Pointer might already be released.
                  }
                }
                const didMove = movedRef.current;
                dragRef.current = null;
                if (didMove) {
                  setLayout((prev) =>
                    computeForceLayout(nodes, edges, 1000, 1000, prev)
                  );
                }
              }}
              r={28}
              stroke="var(--vigil-border)"
              strokeWidth={2}
            />
            <text
              className="pointer-events-none select-none"
              fill="var(--vigil-muted)"
              fontSize={18}
              textAnchor="middle"
              x={p.x}
              y={p.y + 48}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
