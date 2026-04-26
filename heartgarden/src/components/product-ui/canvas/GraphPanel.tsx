"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { EntityGraphThreeCanvas } from "@/src/components/product-ui/canvas/EntityGraphThreeCanvas";
import type { CameraAction, LayoutMap } from "@/src/lib/graph-canvas-types";
import { solveStableLayoutStreamingInWorker } from "@/src/lib/entity-graph-layout-client";
import { buildEntityGraphModel } from "@/src/lib/entity-graph-model";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

type BraneGraphNode = {
  id: string;
  title: string;
  itemType: string;
  entityType: string | null;
  spaceId: string;
  depth: number;
};

type BraneGraphEdge = {
  id: string;
  source: string;
  target: string;
  edgeKind: "explicit" | "implicit";
  matchedTerm?: string | null;
  linkType?: string | null;
};

type GraphResponse = {
  ok?: boolean;
  mode?: "full" | "neighborhood";
  seedItemId?: string | null;
  maxDepth?: number;
  nodes?: BraneGraphNode[];
  edges?: BraneGraphEdge[];
  truncated?: boolean;
  frontierTruncated?: boolean;
  totals?: { nodes: number; edges: number };
  limit?: number;
};

type SeedSearchHit = {
  id: string;
  title: string | null;
  itemType: string | null;
};

const NEIGHBORHOOD_LIMIT = 250;
const FULL_MODE_LIMIT = 250;

function computeWorldSize(nodeCount: number): { width: number; height: number } {
  const floor = 1800;
  const spread = Math.ceil(Math.sqrt(Math.max(1, nodeCount)) * 220);
  const side = Math.min(22000, Math.max(floor, spread));
  return { width: side, height: side };
}

function nextAction(
  key: number,
  type: CameraAction,
): {
  key: number;
  type: CameraAction;
} {
  return { key: key + 1, type };
}

/**
 * REVIEW_2026-04-25_1730 H4: GraphPanel was previously a one-shot
 * "load every node and edge in the brane" pull. At thousands of items and
 * tens of thousands of mentions that does not scale, so the panel is now
 * neighborhood-first:
 *
 * 1. The user searches for and picks a SEED item.
 * 2. We BFS up to `maxDepth` (1 or 2) hops from the seed via the new
 *    `/api/graph/brane?seedItemId=...&maxDepth=...&limit=...` route.
 * 3. We surface a `truncated` banner whenever the cap fires and offer an
 *    explicit "Load whole brane (capped)" escape hatch for power users on
 *    small workspaces.
 *
 * Per-brane ETag from the route lets the panel re-poll cheaply.
 */
export function GraphPanel({
  open,
  braneId,
  width,
  onResizeWidth,
  onClose,
  onSelectItem,
}: {
  open: boolean;
  braneId: string | null;
  width: number;
  onResizeWidth: (next: number) => void;
  onClose: () => void;
  onSelectItem: (itemId: string) => void;
}) {
  const [seedItemId, setSeedItemId] = useState<string | null>(null);
  const [seedTitle, setSeedTitle] = useState<string | null>(null);
  const [maxDepth, setMaxDepth] = useState<1 | 2>(1);
  const [mode, setMode] = useState<"neighborhood" | "full">("neighborhood");

  const [seedSearchQuery, setSeedSearchQuery] = useState("");
  const [seedSearchResults, setSeedSearchResults] = useState<SeedSearchHit[]>([]);
  const [seedSearchLoading, setSeedSearchLoading] = useState(false);

  const [nodes, setNodes] = useState<BraneGraphNode[]>([]);
  const [edges, setEdges] = useState<BraneGraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [frontierTruncated, setFrontierTruncated] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutMap>(new Map());
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cameraAction, setCameraAction] = useState<{ key: number; type: CameraAction }>({
    key: 0,
    type: "reset",
  });

  const etagRef = useRef<string | null>(null);
  const graphViewportRef = useRef<HTMLDivElement | null>(null);

  const graphNodes = useMemo<GraphNode[]>(
    () =>
      nodes.map((node) => ({
        id: node.id,
        title: node.title,
        itemType: node.itemType,
        entityType: node.entityType,
      })),
    [nodes],
  );
  const graphEdges = useMemo<GraphEdge[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        color: null,
        sourcePin: null,
        targetPin: null,
        linkType: edge.linkType ?? (edge.edgeKind === "implicit" ? edge.matchedTerm ?? "mention" : edge.edgeKind),
      })),
    [edges],
  );
  const world = useMemo(() => computeWorldSize(graphNodes.length), [graphNodes.length]);
  const model = useMemo(() => buildEntityGraphModel(graphNodes, graphEdges), [graphEdges, graphNodes]);
  const selectedNeighborIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return model.neighborIdsByNode.get(selectedId) ?? new Set<string>();
  }, [model, selectedId]);
  const selectedActiveEdgeIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return model.edgeIdsByNode.get(selectedId) ?? new Set<string>();
  }, [model, selectedId]);

  // Reset seed and graph state when the brane changes.
  useEffect(() => {
    setSeedItemId(null);
    setSeedTitle(null);
    setNodes([]);
    setEdges([]);
    setLayout(new Map());
    setSelectedId(null);
    setMode("neighborhood");
    setMaxDepth(1);
    setCameraAction({ key: 0, type: "reset" });
    etagRef.current = null;
  }, [braneId]);

  // Debounced seed search.
  useEffect(() => {
    if (!open || !braneId) return;
    const q = seedSearchQuery.trim();
    if (q.length < 2) {
      setSeedSearchResults([]);
      setSeedSearchLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setSeedSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&mode=lexical`,
          { signal: ctrl.signal },
        );
        const data = (await res.json()) as { ok?: boolean; items?: Array<{ id?: string; title?: string | null; itemType?: string | null }> };
        if (!data.ok) {
          setSeedSearchResults([]);
          return;
        }
        const hits: SeedSearchHit[] = (data.items ?? [])
          .filter((row): row is { id: string; title?: string | null; itemType?: string | null } =>
            typeof row?.id === "string",
          )
          .slice(0, 12)
          .map((row) => ({ id: row.id, title: row.title ?? null, itemType: row.itemType ?? null }));
        setSeedSearchResults(hits);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setSeedSearchResults([]);
        }
      } finally {
        setSeedSearchLoading(false);
      }
    }, 200);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, braneId, seedSearchQuery]);

  // Load the graph for the current (mode, seed, depth, brane) combination.
  useEffect(() => {
    if (!open || !braneId) return;
    if (mode === "neighborhood" && !seedItemId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const params = new URLSearchParams({ braneId });
        if (mode === "full") {
          params.set("mode", "full");
          params.set("limit", String(FULL_MODE_LIMIT));
        } else if (seedItemId) {
          params.set("seedItemId", seedItemId);
          params.set("maxDepth", String(maxDepth));
          params.set("limit", String(NEIGHBORHOOD_LIMIT));
        }
        const headers: HeadersInit = {};
        if (etagRef.current) {
          headers["If-None-Match"] = etagRef.current;
        }
        const res = await fetch(`/api/graph/brane?${params.toString()}`, { headers });
        if (cancelled) return;
        if (res.status === 304) {
          // Cached graph still matches; nothing to do.
          return;
        }
        const incomingEtag = res.headers.get("ETag");
        if (incomingEtag) etagRef.current = incomingEtag;
        const data = (await res.json()) as GraphResponse;
        if (cancelled) return;
        if (!data.ok) {
          setError("Failed to load graph.");
          setNodes([]);
          setEdges([]);
          setTruncated(false);
          setFrontierTruncated(false);
          return;
        }
        setNodes(data.nodes ?? []);
        setEdges(data.edges ?? []);
        setTruncated(Boolean(data.truncated));
        setFrontierTruncated(Boolean(data.frontierTruncated));
      } catch {
        if (!cancelled) {
          setError("Failed to load graph.");
          setNodes([]);
          setEdges([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, braneId, mode, seedItemId, maxDepth]);

  useEffect(() => {
    if (!open) return;
    if (graphNodes.length === 0) {
      setLayout(new Map());
      setSelectedId(null);
      return;
    }
    let cancelled = false;
    setLayoutLoading(true);
    void solveStableLayoutStreamingInWorker(
      graphNodes,
      graphEdges,
      { width: world.width, height: world.height },
      (progress) => {
        if (cancelled) return;
        setLayout(new Map(progress));
      },
    )
      .then((resolved) => {
        if (cancelled) return;
        setLayout(new Map(resolved));
      })
      .catch(() => {
        if (cancelled) return;
        setLayout(new Map());
      })
      .finally(() => {
        if (!cancelled) setLayoutLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [graphEdges, graphNodes, open, world.height, world.width]);

  const filteredNodes = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => n.title.toLowerCase().includes(q));
  }, [nodes, filterQuery]);

  const handlePickSeed = (hit: SeedSearchHit) => {
    setSeedItemId(hit.id);
    setSeedTitle(hit.title ?? "(untitled)");
    setMode("neighborhood");
    setSelectedId(null);
    setCameraAction((current) => nextAction(current.key, "reset"));
    setSeedSearchQuery("");
    setSeedSearchResults([]);
    etagRef.current = null;
  };

  const handleClearSeed = () => {
    setSeedItemId(null);
    setSeedTitle(null);
    setNodes([]);
    setEdges([]);
    setLayout(new Map());
    setSelectedId(null);
    setMode("neighborhood");
    setMaxDepth(1);
    setCameraAction((current) => nextAction(current.key, "reset"));
    etagRef.current = null;
  };

  const handleEnterFullMode = () => {
    setMode("full");
    setSeedItemId(null);
    setSeedTitle(null);
    setSelectedId(null);
    setCameraAction((current) => nextAction(current.key, "reset"));
    etagRef.current = null;
  };

  if (!open) return null;

  const showingSeedPicker = mode === "neighborhood" && !seedItemId;

  return (
    <aside
      className="relative border-l border-[var(--vigil-border)] bg-[var(--vigil-bg)]"
      style={{ width, minWidth: 320, maxWidth: 760 }}
    >
      <div
        className="absolute bottom-0 left-0 top-0 z-10 w-1 cursor-col-resize bg-transparent hover:bg-[var(--vigil-border)]/70"
        onPointerDown={(event) => {
          event.preventDefault();
          const startX = event.clientX;
          const startWidth = width;
          const onMove = (e: PointerEvent) => {
            const delta = startX - e.clientX;
            onResizeWidth(Math.max(320, Math.min(760, Math.round(startWidth + delta))));
          };
          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
      />
      <div className="flex items-center justify-between border-b border-[var(--vigil-border)] px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--vigil-label)]">
          Graph panel
        </div>
        <Button size="sm" variant="ghost" tone="menu" onClick={onClose}>
          Close
        </Button>
      </div>

      {showingSeedPicker ? (
        <div className="p-3">
          <div className="mb-2 text-xs text-[var(--vigil-label)]">
            Pick a seed item to explore its 1–2 hop neighborhood.
          </div>
          <input
            className="w-full rounded-md border border-[var(--vigil-border)] bg-transparent px-2 py-1 text-sm"
            placeholder="Search items..."
            value={seedSearchQuery}
            onChange={(e) => setSeedSearchQuery(e.target.value)}
            autoFocus
          />
          <div className="mt-2 max-h-[55vh] overflow-auto">
            {seedSearchLoading && (
              <div className="px-1 py-2 text-xs text-[var(--vigil-muted)]">Searching…</div>
            )}
            {!seedSearchLoading && seedSearchQuery.trim().length >= 2 && seedSearchResults.length === 0 && (
              <div className="px-1 py-2 text-xs text-[var(--vigil-muted)]">No matches.</div>
            )}
            <ul className="space-y-1">
              {seedSearchResults.map((hit) => (
                <li key={hit.id}>
                  <Button
                    size="sm"
                    variant="subtle"
                    tone="menu"
                    className="w-full justify-start truncate"
                    onClick={() => handlePickSeed(hit)}
                  >
                    {hit.title ?? "(untitled)"}
                    {hit.itemType ? (
                      <span className="ml-1 text-[var(--vigil-muted)]">({hit.itemType})</span>
                    ) : null}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 border-t border-[var(--vigil-border)] pt-2">
            <Button size="sm" variant="ghost" tone="menu" onClick={handleEnterFullMode}>
              Load whole brane (capped to {FULL_MODE_LIMIT})
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--vigil-border)] px-3 py-2 text-xs">
            {mode === "neighborhood" ? (
              <>
                <span className="text-[var(--vigil-label)]">Seed:</span>
                <span className="truncate font-medium">{seedTitle ?? "(untitled)"}</span>
                <span className="ml-2 text-[var(--vigil-muted)]">depth</span>
                <Button
                  size="sm"
                  variant={maxDepth === 1 ? "subtle" : "ghost"}
                  tone="menu"
                  onClick={() => setMaxDepth(1)}
                >
                  1
                </Button>
                <Button
                  size="sm"
                  variant={maxDepth === 2 ? "subtle" : "ghost"}
                  tone="menu"
                  onClick={() => setMaxDepth(2)}
                >
                  2
                </Button>
                <Button size="sm" variant="ghost" tone="menu" onClick={handleClearSeed}>
                  Switch seed
                </Button>
              </>
            ) : (
              <>
                <span className="text-[var(--vigil-label)]">Full brane (capped)</span>
                <Button size="sm" variant="ghost" tone="menu" onClick={handleClearSeed}>
                  Pick seed
                </Button>
              </>
            )}
          </div>

          <div className="p-3">
            <input
              className="w-full rounded-md border border-[var(--vigil-border)] bg-transparent px-2 py-1 text-sm"
              placeholder="Filter loaded nodes..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between px-3 pb-2 text-xs text-[var(--vigil-label)]">
            <span>{loading ? "Loading graph..." : `${nodes.length} nodes · ${edges.length} edges`}</span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                tone="menu"
                onClick={() => setCameraAction((current) => nextAction(current.key, "frame-all"))}
              >
                Frame all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                tone="menu"
                onClick={() => setCameraAction((current) => nextAction(current.key, "frame-selection"))}
                disabled={!selectedId}
              >
                Frame selected
              </Button>
            </div>
          </div>

          {(truncated || frontierTruncated) && !loading && (
            <div className="mx-3 mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
              Result was capped. Switch seed, lower depth, or refine to see more.
            </div>
          )}
          {error && !loading && (
            <div className="mx-3 mb-2 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300">
              {error}
            </div>
          )}

          <div ref={graphViewportRef} className="mx-3 h-[300px] overflow-hidden rounded-md border border-[var(--vigil-border)]">
            {graphNodes.length > 0 && layout.size > 0 ? (
              <EntityGraphThreeCanvas
                nodes={graphNodes}
                edges={graphEdges}
                layout={layout}
                worldWidth={world.width}
                worldHeight={world.height}
                blurEffectsEnabled
                selectedId={selectedId}
                neighborIds={selectedNeighborIds}
                activeEdgeIds={selectedActiveEdgeIds}
                degreeByNode={model.degreeByNode}
                cameraActionKey={cameraAction.key}
                cameraActionType={cameraAction.type}
                showStatsFooter={false}
                enableNodeOverlayCard={false}
                onSelect={(id) => {
                  setSelectedId(id);
                  if (id) onSelectItem(id);
                }}
                onLayoutChange={(next) => setLayout(new Map(next))}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--vigil-muted)]">
                {layoutLoading ? "Solving layout..." : "No graph to render."}
              </div>
            )}
          </div>

          <div className="max-h-[28vh] overflow-auto px-3 pb-3 pt-2">
            <ul className="space-y-1">
              {filteredNodes.slice(0, 200).map((node) => (
                <li key={node.id}>
                  <Button
                    size="sm"
                    variant="subtle"
                    tone="menu"
                    className="w-full justify-start truncate"
                    isActive={selectedId === node.id}
                    onClick={() => {
                      setSelectedId(node.id);
                      onSelectItem(node.id);
                      setCameraAction((current) => nextAction(current.key, "frame-selection"));
                    }}
                  >
                    {node.title}
                    <span className="ml-1 text-[var(--vigil-muted)]">({node.itemType})</span>
                    {mode === "neighborhood" && node.depth > 0 ? (
                      <span className="ml-1 text-[var(--vigil-muted)]">·hop {node.depth}</span>
                    ) : null}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </aside>
  );
}
