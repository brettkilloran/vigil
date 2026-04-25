"use client";

import { useMemo } from "react";

import { Button } from "@/src/components/ui/Button";
import { computeForceLayout } from "@/src/lib/graph-layout";

type MentionRow = {
  itemId: string;
  title: string;
  mentionCount: number;
  snippet?: string | null;
};

type SearchRow = {
  id: string;
  title?: string | null;
  itemType?: string | null;
};

type MiniNode = {
  id: string;
  label: string;
  ghost: boolean;
};

export function AltGraphCard({
  open,
  term,
  x,
  y,
  mentions,
  searchItems,
  loadingMentions,
  loadingSearch,
  onClose,
  onShowItem,
}: {
  open: boolean;
  term: string;
  x: number;
  y: number;
  mentions: MentionRow[];
  searchItems: SearchRow[];
  loadingMentions: boolean;
  loadingSearch: boolean;
  onClose: () => void;
  onShowItem: (itemId: string) => void;
}) {
  const miniGraph = useMemo(() => {
    const seed: MiniNode[] = [];
    const byId = new Map<string, MiniNode>();
    for (const row of mentions.slice(0, 6)) {
      byId.set(row.itemId, { id: row.itemId, label: row.title || "Untitled", ghost: false });
    }
    for (const row of searchItems.slice(0, 8)) {
      const id = row.id;
      if (!id || id === "__term__") continue;
      if (byId.has(id)) continue;
      byId.set(id, { id, label: row.title?.trim() || "Untitled", ghost: true });
    }
    seed.push(...byId.values());
    const nodes = [{ id: "__term__", label: term || "term", ghost: false }, ...seed];
    const edges = seed.map((n) => ({ source: "__term__", target: n.id }));
    const layout = computeForceLayout(
      nodes.map((n) => ({ id: n.id, title: n.label, itemType: "note", entityType: null })),
      edges,
      960,
      500,
    );
    return { nodes, edges, layout };
  }, [mentions, searchItems, term]);

  if (!open) return null;
  return (
    <div
      className="fixed z-[2100] w-[380px] rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-surface)] p-2 shadow-2xl"
      style={{ left: x, top: y }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.16em] text-[var(--vigil-label)]">Alt graph</div>
        <Button size="sm" variant="ghost" tone="menu" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="mb-2 text-sm font-semibold">{term}</div>
      <div className="mb-2 rounded border border-[var(--vigil-border)] bg-[var(--vigil-canvas)]/70 p-1">
        <svg viewBox="0 0 960 500" className="h-[150px] w-full">
          {miniGraph.edges.map((edge, idx) => {
            const a = miniGraph.layout.get(edge.source);
            const b = miniGraph.layout.get(edge.target);
            if (!a || !b) return null;
            return (
              <line
                key={`${edge.source}-${edge.target}-${idx}`}
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
          {miniGraph.nodes.map((node) => {
            const p = miniGraph.layout.get(node.id);
            if (!p) return null;
            const isCenter = node.id === "__term__";
            return (
              <g key={node.id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isCenter ? 26 : 16}
                  fill={isCenter ? "var(--vigil-btn-bg)" : "var(--vigil-surface)"}
                  stroke="var(--vigil-border)"
                  strokeOpacity={node.ghost ? 0.65 : 1}
                  strokeDasharray={node.ghost && !isCenter ? "6 4" : undefined}
                  strokeWidth={isCenter ? 2.5 : 2}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mb-1 flex items-center justify-between text-xs text-[var(--vigil-muted)]">
        <span>{loadingMentions ? "Loading mentions..." : `${mentions.length} mentions`}</span>
        <span>{loadingSearch ? "Searching..." : `${searchItems.length} search hits`}</span>
      </div>
      <ul className="max-h-[180px] space-y-1 overflow-auto">
        {mentions.slice(0, 4).map((row) => (
          <li key={`m-${row.itemId}`} className="rounded border border-[var(--vigil-border)] p-2">
            <Button
              size="sm"
              variant="subtle"
              tone="menu"
              className="w-full justify-start truncate"
              onClick={() => onShowItem(row.itemId)}
            >
              {row.title}
              <span className="ml-1 text-[var(--vigil-muted)]">({row.mentionCount})</span>
            </Button>
            {row.snippet ? (
              <div className="mt-1 line-clamp-2 text-xs text-[var(--vigil-muted)]">{row.snippet}</div>
            ) : null}
          </li>
        ))}
        {searchItems
          .filter((row) => !mentions.some((m) => m.itemId === row.id))
          .slice(0, 4)
          .map((row) => (
            <li
              key={`s-${row.id}`}
              className="rounded border border-dashed border-[var(--vigil-border)]/70 p-2"
            >
              <Button
                size="sm"
                variant="subtle"
                tone="menu"
                className="w-full justify-start truncate opacity-90"
                onClick={() => onShowItem(row.id)}
              >
                {row.title?.trim() || "Untitled"}
                <span className="ml-1 text-[var(--vigil-muted)]">(search)</span>
              </Button>
            </li>
          ))}
      </ul>
    </div>
  );
}
