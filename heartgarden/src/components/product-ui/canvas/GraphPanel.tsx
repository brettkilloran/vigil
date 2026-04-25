"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/src/components/ui/Button";

type BraneGraphNode = {
  id: string;
  title: string;
  itemType: string;
  entityType: string | null;
};

type BraneGraphEdge = {
  id: string;
  source: string;
  target: string;
  edgeKind: "explicit" | "implicit";
  matchedTerm?: string | null;
  linkType?: string | null;
};

export function GraphPanel({
  open,
  braneId,
  width,
  onClose,
  onSelectItem,
}: {
  open: boolean;
  braneId: string | null;
  width: number;
  onClose: () => void;
  onSelectItem: (itemId: string) => void;
}) {
  const [nodes, setNodes] = useState<BraneGraphNode[]>([]);
  const [edges, setEdges] = useState<BraneGraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open || !braneId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/graph/brane?braneId=${encodeURIComponent(braneId)}`);
        const data = (await res.json()) as {
          ok?: boolean;
          nodes?: BraneGraphNode[];
          edges?: BraneGraphEdge[];
        };
        if (cancelled || !data.ok) return;
        setNodes(data.nodes ?? []);
        setEdges(data.edges ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, braneId]);

  const filteredNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => n.title.toLowerCase().includes(q));
  }, [nodes, query]);

  if (!open) return null;

  return (
    <aside
      className="border-l border-[var(--vigil-border)] bg-[var(--vigil-bg)]"
      style={{ width, minWidth: 320, maxWidth: 760 }}
    >
      <div className="flex items-center justify-between border-b border-[var(--vigil-border)] px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--vigil-label)]">
          Graph panel
        </div>
        <Button size="sm" variant="ghost" tone="menu" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="p-3">
        <input
          className="w-full rounded-md border border-[var(--vigil-border)] bg-transparent px-2 py-1 text-sm"
          placeholder="Filter nodes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="px-3 pb-2 text-xs text-[var(--vigil-label)]">
        {loading ? "Loading graph..." : `${nodes.length} nodes · ${edges.length} edges`}
      </div>
      <div className="max-h-[55vh] overflow-auto px-3 pb-3">
        <ul className="space-y-1">
          {filteredNodes.slice(0, 200).map((node) => (
            <li key={node.id}>
              <Button
                size="sm"
                variant="subtle"
                tone="menu"
                className="w-full justify-start truncate"
                onClick={() => onSelectItem(node.id)}
              >
                {node.title}
                <span className="ml-1 text-[var(--vigil-muted)]">({node.itemType})</span>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
