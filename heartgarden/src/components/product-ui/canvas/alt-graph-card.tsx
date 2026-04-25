"use client";

import { type RefObject, useMemo } from "react";

import { Button } from "@/src/components/ui/button";
import type {
  AltMentionRow as MentionRow,
  AltSearchRow as SearchRow,
} from "@/src/lib/entity-mention-row-types";
import { computeForceLayout } from "@/src/lib/graph-layout";

interface MiniNode {
  ghost: boolean;
  id: string;
  label: string;
}

export interface AltGraphCardProps {
  loadingMentions: boolean;
  loadingSearch: boolean;
  mentions: MentionRow[];
  onClose: () => void;
  onShowItem: (itemId: string) => void;
  open: boolean;
  searchItems: SearchRow[];
  term: string;
  /**
   * Initial x/y in viewport coordinates. After mount the parent typically
   * updates the card's position imperatively via the forwarded ref's
   * `style.transform` to avoid per-frame React re-renders during pointer move.
   * (See REVIEW_2026-04-25_1835.md M8.)
   */
  x: number;
  y: number;
}

export const AltGraphCard = function AltGraphCard({
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
  ref,
}: AltGraphCardProps & { ref?: RefObject<HTMLDivElement | null> }) {
  const miniGraph = useMemo(() => {
    const seed: MiniNode[] = [];
    const byId = new Map<string, MiniNode>();
    for (const row of mentions.slice(0, 6)) {
      byId.set(row.itemId, {
        ghost: false,
        id: row.itemId,
        label: row.title || "Untitled",
      });
    }
    for (const row of searchItems.slice(0, 8)) {
      const id = row.id;
      if (!id || id === "__term__") {
        continue;
      }
      if (byId.has(id)) {
        continue;
      }
      byId.set(id, {
        ghost: true,
        id,
        label: row.title?.trim() || "Untitled",
      });
    }
    seed.push(...byId.values());
    const nodes = [
      { ghost: false, id: "__term__", label: term || "term" },
      ...seed,
    ];
    const edges = seed.map((n) => ({ source: "__term__", target: n.id }));
    const layout = computeForceLayout(
      nodes.map((n) => ({
        entityType: null,
        id: n.id,
        itemType: "note",
        title: n.label,
      })),
      edges,
      960,
      500
    );
    return { edges, layout, nodes };
  }, [mentions, searchItems, term]);

  if (!open) {
    return null;
  }
  return (
    <div
      className="fixed z-[2100] w-[380px] rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-surface)] p-2 shadow-2xl"
      ref={ref}
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${x}px, ${y}px, 0)`,
        willChange: "transform",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[var(--vigil-label)] text-xs uppercase tracking-[0.16em]">
          Alt graph
        </div>
        <Button onClick={onClose} size="sm" tone="menu" variant="ghost">
          Close
        </Button>
      </div>
      <div className="mb-2 font-semibold text-sm">{term}</div>
      <div className="mb-2 rounded border border-[var(--vigil-border)] bg-[var(--vigil-canvas)]/70 p-1">
        <svg
          aria-hidden="true"
          className="h-[150px] w-full"
          viewBox="0 0 960 500"
        >
          {miniGraph.edges.map((edge, idx) => {
            const a = miniGraph.layout.get(edge.source);
            const b = miniGraph.layout.get(edge.target);
            if (!(a && b)) {
              return null;
            }
            return (
              <line
                // biome-ignore lint/suspicious/noArrayIndexKey: graph edges may share the same source-target pair (parallel edges); index disambiguates duplicates
                key={`${edge.source}-${edge.target}-${idx}`}
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
          {miniGraph.nodes.map((node) => {
            const p = miniGraph.layout.get(node.id);
            if (!p) {
              return null;
            }
            const isCenter = node.id === "__term__";
            return (
              <g key={node.id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  fill={
                    isCenter ? "var(--vigil-btn-bg)" : "var(--vigil-surface)"
                  }
                  r={isCenter ? 26 : 16}
                  stroke="var(--vigil-border)"
                  strokeDasharray={node.ghost && !isCenter ? "6 4" : undefined}
                  strokeOpacity={node.ghost ? 0.65 : 1}
                  strokeWidth={isCenter ? 2.5 : 2}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mb-1 flex items-center justify-between text-[var(--vigil-muted)] text-xs">
        <span>
          {loadingMentions
            ? "Loading mentions..."
            : `${mentions.length} mentions`}
        </span>
        <span>
          {loadingSearch ? "Searching..." : `${searchItems.length} search hits`}
        </span>
      </div>
      <ul className="max-h-[180px] space-y-1 overflow-auto">
        {mentions.slice(0, 4).map((row) => (
          <li
            className="rounded border border-[var(--vigil-border)] p-2"
            key={`m-${row.itemId}`}
          >
            <Button
              className="w-full justify-start truncate"
              onClick={() => onShowItem(row.itemId)}
              size="sm"
              tone="menu"
              variant="subtle"
            >
              {row.title}
              <span className="ml-1 text-[var(--vigil-muted)]">
                ({row.mentionCount})
              </span>
            </Button>
            {row.snippet ? (
              <div className="mt-1 line-clamp-2 text-[var(--vigil-muted)] text-xs">
                {row.snippet}
              </div>
            ) : null}
          </li>
        ))}
        {searchItems
          .filter((row) => !mentions.some((m) => m.itemId === row.id))
          .slice(0, 4)
          .map((row) => (
            <li
              className="rounded border border-[var(--vigil-border)]/70 border-dashed p-2"
              key={`s-${row.id}`}
            >
              <Button
                className="w-full justify-start truncate opacity-90"
                onClick={() => onShowItem(row.id)}
                size="sm"
                tone="menu"
                variant="subtle"
              >
                {row.title?.trim() || "Untitled"}
                <span className="ml-1 text-[var(--vigil-muted)]">(search)</span>
              </Button>
            </li>
          ))}
      </ul>
    </div>
  );
};
