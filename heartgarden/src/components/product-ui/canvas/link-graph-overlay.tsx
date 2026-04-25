"use client";

import { ArrowCounterClockwise, Graph, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/src/components/ui/button";
import { computeForceLayout } from "@/src/lib/graph-layout";
import type {
  GraphEdge,
  GraphNode,
  SpaceGraphResponse,
} from "@/src/lib/graph-types";
import {
  HEARTGARDEN_CHROME_ICON,
  HEARTGARDEN_GLASS_PANEL,
} from "@/src/lib/vigil-ui-classes";

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

function LinkGraphInteractiveSvg({
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
      <title>Link graph</title>
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
                dragRef.current = {
                  id: node.id,
                  ox: x - cur.x,
                  oy: y - cur.y,
                };
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
                    /* already released */
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

function LinkGraphInner({
  spaceId,
  onClose,
  onSelectItem,
}: {
  spaceId: string;
  onClose: () => void;
  onSelectItem: (id: string) => void;
}) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [layoutRevision, setLayoutRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/spaces/${spaceId}/graph`)
      .then((res) => res.json())
      .then((data: SpaceGraphResponse) => {
        if (cancelled) {
          return;
        }
        if (data.ok && data.nodes) {
          setErr(null);
          setNodes(data.nodes);
          setEdges(data.edges ?? []);
        } else {
          setErr(data.error ?? "Could not load graph");
          setNodes([]);
          setEdges([]);
        }
        setDone(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setErr("Could not load graph");
        setNodes([]);
        setEdges([]);
        setDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const loading = !done;

  const onPick = useCallback(
    (id: string) => {
      onSelectItem(id);
      onClose();
    },
    [onClose, onSelectItem]
  );

  return (
    <div
      className={`flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden ${HEARTGARDEN_GLASS_PANEL}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-[var(--vigil-border)]/80 border-b px-4 py-3">
        <span className="flex items-center gap-2 font-semibold text-[var(--vigil-label)] text-sm tracking-tight">
          <Graph
            aria-hidden
            className="size-4 shrink-0 text-[var(--vigil-muted)] opacity-90"
            weight="bold"
          />
          Link graph
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setLayoutRevision((n) => n + 1)}
            size="md"
            tone="glass"
            variant="default"
          >
            <ArrowCounterClockwise
              aria-hidden
              className={HEARTGARDEN_CHROME_ICON}
              weight="bold"
            />
            Reset layout
          </Button>
          <Button onClick={onClose} size="md" tone="glass" variant="default">
            <X aria-hidden className={HEARTGARDEN_CHROME_ICON} weight="bold" />
            Close
          </Button>
        </div>
      </div>
      <div className="min-h-[min(70vh,520px)] flex-1 bg-[var(--vigil-canvas)]">
        {loading ? (
          <p className="p-4 text-[var(--vigil-muted)] text-sm">Loading…</p>
        ) : err ? (
          <p className="p-4 text-red-600 text-sm dark:text-red-400">{err}</p>
        ) : nodes.length === 0 ? (
          <p className="p-4 text-[var(--vigil-muted)] text-sm">
            No items in this space yet.
          </p>
        ) : (
          <LinkGraphInteractiveSvg
            edges={edges}
            key={layoutRevision}
            nodes={nodes}
            onPick={onPick}
          />
        )}
      </div>
      <p className="border-[var(--vigil-border)] border-t px-4 py-2.5 text-[10px] text-[var(--vigil-muted)] leading-relaxed">
        Layout: <strong>d3-force</strong> (charge + links + collision). Circles
        are items; lines are <code className="text-[9px]">item_links</code>.
        <strong> Reset layout</strong> starts fresh; <strong>drag</strong> a
        node to reposition; release to re-run layout from that pose. Click
        (without dragging) to jump to the item.
      </p>
    </div>
  );
}

export function LinkGraphOverlay({
  open,
  spaceId,
  onClose,
  onSelectItem,
}: {
  open: boolean;
  spaceId: string | null;
  onClose: () => void;
  onSelectItem: (id: string) => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      aria-label="Link graph"
      aria-modal="true"
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px] dark:bg-black/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
    >
      {spaceId ? (
        <LinkGraphInner
          key={spaceId}
          onClose={onClose}
          onSelectItem={onSelectItem}
          spaceId={spaceId}
        />
      ) : (
        <div
          className={`max-w-md p-4 text-[var(--vigil-muted)] text-sm ${HEARTGARDEN_GLASS_PANEL}`}
        >
          Select a cloud space to view the graph.
        </div>
      )}
    </div>
  );
}
