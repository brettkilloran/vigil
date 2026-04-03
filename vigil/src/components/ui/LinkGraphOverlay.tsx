"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { computeForceLayout } from "@/src/lib/graph-layout";

type GraphNode = {
  id: string;
  title: string;
  itemType: string;
  entityType: string | null;
};

type GraphEdge = { source: string; target: string };

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

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/spaces/${spaceId}/graph`)
      .then((res) => res.json())
      .then(
        (data: {
          ok?: boolean;
          nodes?: GraphNode[];
          edges?: GraphEdge[];
          error?: string;
        }) => {
          if (cancelled) return;
          if (!data.ok || !data.nodes) {
            setErr(data.error ?? "Could not load graph");
            setNodes([]);
            setEdges([]);
          } else {
            setErr(null);
            setNodes(data.nodes);
            setEdges(data.edges ?? []);
          }
          setDone(true);
        },
      )
      .catch(() => {
        if (cancelled) return;
        setErr("Could not load graph");
        setNodes([]);
        setEdges([]);
        setDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const layout = useMemo(
    () => computeForceLayout(nodes, edges, 1000, 1000),
    [nodes, edges],
  );

  const onPick = useCallback(
    (id: string) => {
      onSelectItem(id);
      onClose();
    },
    [onClose, onSelectItem],
  );

  const loading = !done;

  return (
    <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] shadow-xl">
      <div className="flex items-center justify-between border-b border-[var(--vigil-border)] px-3 py-2">
        <span className="text-sm font-medium text-[var(--vigil-label)]">
          Link graph
        </span>
        <button
          type="button"
          className="rounded px-2 py-1 text-xs text-[var(--vigil-muted)] hover:bg-black/5 dark:hover:bg-white/10"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="min-h-[min(70vh,520px)] flex-1 bg-neutral-100 dark:bg-neutral-900">
        {loading ? (
          <p className="p-4 text-sm text-[var(--vigil-muted)]">Loading…</p>
        ) : err ? (
          <p className="p-4 text-sm text-red-600 dark:text-red-400">{err}</p>
        ) : nodes.length === 0 ? (
          <p className="p-4 text-sm text-[var(--vigil-muted)]">
            No items in this space yet.
          </p>
        ) : (
          <svg
            className="h-full w-full"
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
                    className="cursor-pointer"
                    onClick={() => onPick(node.id)}
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
        )}
      </div>
      <p className="border-t border-[var(--vigil-border)] px-3 py-2 text-[10px] text-[var(--vigil-muted)]">
        Layout: <strong>d3-force</strong> (charge + links + collision). Circles
        are items; lines are <code className="text-[9px]">item_links</code>.
        Click a circle to jump.
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
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4"
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
        <div className="rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] p-4 text-sm text-[var(--vigil-muted)]">
          Select a cloud space to view the graph.
        </div>
      )}
    </div>
  );
}
