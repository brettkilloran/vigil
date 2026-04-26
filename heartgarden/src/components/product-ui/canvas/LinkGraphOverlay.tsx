"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowCounterClockwise, Graph, X } from "@phosphor-icons/react";

import { Button } from "@/src/components/ui/Button";
import {
  GRAPH_LAYOUT_CACHE_LAYOUT_VERSION,
  graphLayoutPositionsFromMap,
  graphLayoutPositionsToMap,
  type GraphLayoutPositions,
} from "@/src/lib/graph-layout-cache-contract";
import { computeForceLayout } from "@/src/lib/graph-layout";
import type { GraphEdge, GraphNode, SpaceGraphResponse } from "@/src/lib/graph-types";
import {
  HEARTGARDEN_CHROME_ICON,
  HEARTGARDEN_GLASS_PANEL,
} from "@/src/lib/vigil-ui-classes";

function clientToSvgCoords(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  return new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
}

function LinkGraphInteractiveSvg({
  spaceId,
  graphRevision,
  layoutVersion,
  initialPositions,
  nodes,
  edges,
  onPick,
}: {
  spaceId: string;
  graphRevision: string | null;
  layoutVersion: string;
  initialPositions: GraphLayoutPositions | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onPick: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [layout, setLayout] = useState(() => {
    const seed = graphLayoutPositionsToMap(initialPositions);
    if (seed.size > 0) return computeForceLayout(nodes, edges, 1000, 1000, seed);
    return computeForceLayout(nodes, edges, 1000, 1000);
  });
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const movedRef = useRef(false);
  const lastPersistKeyRef = useRef<string>("");

  useEffect(() => {
    if (!graphRevision || nodes.length === 0) return;
    const timer = window.setTimeout(() => {
      const positions = graphLayoutPositionsFromMap(layout);
      const nodeCount = Object.keys(positions).length;
      if (nodeCount === 0) return;
      let sample = 2166136261;
      let sampled = 0;
      for (const [id, point] of Object.entries(positions)) {
        for (let i = 0; i < id.length; i += 1) {
          sample ^= id.charCodeAt(i);
          sample = Math.imul(sample, 16777619);
        }
        sample ^= Math.trunc(point.x * 10);
        sample = Math.imul(sample, 16777619);
        sample ^= Math.trunc(point.y * 10);
        sample = Math.imul(sample, 16777619);
        sampled += 1;
        if (sampled >= 96) break;
      }
      const persistKey = `${graphRevision}:${layoutVersion}:${nodeCount}:${sample >>> 0}`;
      if (persistKey === lastPersistKeyRef.current) return;
      lastPersistKeyRef.current = persistKey;
      void fetch(`/api/spaces/${encodeURIComponent(spaceId)}/graph-layout-cache`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graphRevision,
          layoutVersion,
          nodeCount,
          positions,
        }),
      }).catch(() => {
        /* non-fatal cache write miss */
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [graphRevision, layout, layoutVersion, nodes.length, spaceId]);

  return (
    <svg
      ref={svgRef}
      className="h-full w-full touch-none"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
    >
      {edges.map((e, i) => {
        const a = layout.get(e.source);
        const b = layout.get(e.target);
        if (!a || !b) return null;
        return (
          <line
            key={`${e.source}-${e.target}-${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--vigil-snap)"
            strokeOpacity={0.45}
            strokeWidth={2}
          />
        );
      })}
      {nodes.map((node) => {
        const p = layout.get(node.id);
        if (!p) return null;
        const label =
          node.title.length > 22
            ? `${node.title.slice(0, 20)}…`
            : node.title;
        return (
          <g key={node.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r={28}
              fill="var(--vigil-btn-bg)"
              stroke="var(--vigil-border)"
              strokeWidth={2}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                e.stopPropagation();
                const svg = svgRef.current;
                if (!svg) return;
                const { x, y } = clientToSvgCoords(svg, e.clientX, e.clientY);
                const cur = layout.get(node.id);
                if (!cur) return;
                dragRef.current = {
                  id: node.id,
                  ox: x - cur.x,
                  oy: y - cur.y,
                };
                movedRef.current = false;
                (e.currentTarget as SVGCircleElement).setPointerCapture(
                  e.pointerId,
                );
              }}
              onPointerMove={(e) => {
                if (!dragRef.current) return;
                const svg = svgRef.current;
                if (!svg) return;
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
                      e.pointerId,
                    );
                  } catch {
                    /* already released */
                  }
                }
                const didMove = movedRef.current;
                dragRef.current = null;
                if (didMove) {
                  setLayout((prev) =>
                    computeForceLayout(nodes, edges, 1000, 1000, prev),
                  );
                }
              }}
              onClick={(e) => {
                if (movedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  movedRef.current = false;
                  return;
                }
                onPick(node.id);
              }}
            />
            <text
              x={p.x}
              y={p.y + 48}
              textAnchor="middle"
              fill="var(--vigil-muted)"
              fontSize={18}
              className="pointer-events-none select-none"
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
  const [graphRevision, setGraphRevision] = useState<string | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(GRAPH_LAYOUT_CACHE_LAYOUT_VERSION);
  const [layoutPositions, setLayoutPositions] = useState<GraphLayoutPositions | null>(null);
  const [layoutCacheHit, setLayoutCacheHit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/spaces/${spaceId}/graph`)
      .then((res) => res.json())
      .then((data: SpaceGraphResponse) => {
          if (cancelled) return;
          if (!data.ok || !data.nodes) {
            setErr(data.error ?? "Could not load graph");
            setNodes([]);
            setEdges([]);
            setGraphRevision(null);
            setLayoutPositions(null);
            setLayoutCacheHit(false);
          } else {
            setErr(null);
            setNodes(data.nodes);
            setEdges(data.edges ?? []);
            setGraphRevision(typeof data.graphRevision === "string" ? data.graphRevision : null);
            setLayoutVersion(
              typeof data.layoutVersion === "string" && data.layoutVersion
                ? data.layoutVersion
                : GRAPH_LAYOUT_CACHE_LAYOUT_VERSION,
            );
            setLayoutPositions(data.layoutPositions ?? null);
            setLayoutCacheHit(data.layoutCacheHit === true);
          }
          setDone(true);
        })
      .catch(() => {
        if (cancelled) return;
        setErr("Could not load graph");
        setNodes([]);
        setEdges([]);
        setGraphRevision(null);
        setLayoutPositions(null);
        setLayoutCacheHit(false);
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
    [onClose, onSelectItem],
  );

  return (
    <div
      className={`flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden ${HEARTGARDEN_GLASS_PANEL}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vigil-border)]/80 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--vigil-label)]">
          <Graph
            className="size-4 shrink-0 text-[var(--vigil-muted)] opacity-90"
            weight="bold"
            aria-hidden
          />
          Link graph
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="md"
            variant="default"
            tone="glass"
            onClick={() => {
              setLayoutPositions(null);
              setLayoutCacheHit(false);
              setLayoutRevision((n) => n + 1);
            }}
          >
            <ArrowCounterClockwise className={HEARTGARDEN_CHROME_ICON} weight="bold" aria-hidden />
            Reset layout
          </Button>
          <Button size="md" variant="default" tone="glass" onClick={onClose}>
            <X className={HEARTGARDEN_CHROME_ICON} weight="bold" aria-hidden />
            Close
          </Button>
        </div>
      </div>
      <div className="min-h-[min(70vh,520px)] flex-1 bg-[var(--vigil-canvas)]">
        {loading ? (
          <p className="p-4 text-sm text-[var(--vigil-muted)]">Loading…</p>
        ) : err ? (
          <p className="p-4 text-sm text-red-600 dark:text-red-400">{err}</p>
        ) : nodes.length === 0 ? (
          <p className="p-4 text-sm text-[var(--vigil-muted)]">
            No items in this space yet.
          </p>
        ) : (
          <LinkGraphInteractiveSvg
            key={layoutRevision}
            spaceId={spaceId}
            graphRevision={graphRevision}
            layoutVersion={layoutVersion}
            initialPositions={layoutPositions}
            nodes={nodes}
            edges={edges}
            onPick={onPick}
          />
        )}
      </div>
      <p className="border-t border-[var(--vigil-border)] px-4 py-2.5 text-[10px] leading-relaxed text-[var(--vigil-muted)]">
        Layout: <strong>d3-force</strong> (charge + links + collision). Circles
        are items; lines are <code className="text-[9px]">item_links</code>.
        {" "}
        Cache: <strong>{layoutCacheHit ? "warm" : "cold"}</strong>.
        <strong> Reset layout</strong> starts fresh; <strong>drag</strong> a node
        to reposition; release to re-run layout from that pose. Click (without
        dragging) to jump to the item.
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
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px] dark:bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Link graph"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {spaceId ? (
        <LinkGraphInner
          key={spaceId}
          spaceId={spaceId}
          onClose={onClose}
          onSelectItem={onSelectItem}
        />
      ) : (
        <div
          className={`max-w-md p-4 text-sm text-[var(--vigil-muted)] ${HEARTGARDEN_GLASS_PANEL}`}
        >
          Select a cloud space to view the graph.
        </div>
      )}
    </div>
  );
}
