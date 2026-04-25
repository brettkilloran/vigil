"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/src/components/ui/Button";

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
  const [seedSearchResults, setSeedSearchResults] = useState<SeedSearchHit[]>(
    []
  );
  const [seedSearchLoading, setSeedSearchLoading] = useState(false);

  const [nodes, setNodes] = useState<BraneGraphNode[]>([]);
  const [edges, setEdges] = useState<BraneGraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [frontierTruncated, setFrontierTruncated] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const etagRef = useRef<string | null>(null);

  // Reset seed and graph state when the brane changes.
  useEffect(() => {
    setSeedItemId(null);
    setSeedTitle(null);
    setNodes([]);
    setEdges([]);
    setMode("neighborhood");
    setMaxDepth(1);
    etagRef.current = null;
  }, [braneId]);

  // Debounced seed search.
  useEffect(() => {
    if (!(open && braneId)) {
      return;
    }
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
          { signal: ctrl.signal }
        );
        const data = (await res.json()) as {
          ok?: boolean;
          items?: Array<{
            id?: string;
            title?: string | null;
            itemType?: string | null;
          }>;
        };
        if (!data.ok) {
          setSeedSearchResults([]);
          return;
        }
        const hits: SeedSearchHit[] = (data.items ?? [])
          .filter(
            (
              row
            ): row is {
              id: string;
              title?: string | null;
              itemType?: string | null;
            } => typeof row?.id === "string"
          )
          .slice(0, 12)
          .map((row) => ({
            id: row.id,
            title: row.title ?? null,
            itemType: row.itemType ?? null,
          }));
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
    if (!(open && braneId)) {
      return;
    }
    if (mode === "neighborhood" && !seedItemId) {
      return;
    }
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
        const res = await fetch(`/api/graph/brane?${params.toString()}`, {
          headers,
        });
        if (cancelled) {
          return;
        }
        if (res.status === 304) {
          // Cached graph still matches; nothing to do.
          return;
        }
        const incomingEtag = res.headers.get("ETag");
        if (incomingEtag) {
          etagRef.current = incomingEtag;
        }
        const data = (await res.json()) as GraphResponse;
        if (cancelled) {
          return;
        }
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
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, braneId, mode, seedItemId, maxDepth]);

  const filteredNodes = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) {
      return nodes;
    }
    return nodes.filter((n) => n.title.toLowerCase().includes(q));
  }, [nodes, filterQuery]);

  const handlePickSeed = (hit: SeedSearchHit) => {
    setSeedItemId(hit.id);
    setSeedTitle(hit.title ?? "(untitled)");
    setMode("neighborhood");
    setSeedSearchQuery("");
    setSeedSearchResults([]);
    etagRef.current = null;
  };

  const handleClearSeed = () => {
    setSeedItemId(null);
    setSeedTitle(null);
    setNodes([]);
    setEdges([]);
    setMode("neighborhood");
    setMaxDepth(1);
    etagRef.current = null;
  };

  const handleEnterFullMode = () => {
    setMode("full");
    setSeedItemId(null);
    setSeedTitle(null);
    etagRef.current = null;
  };

  if (!open) {
    return null;
  }

  const showingSeedPicker = mode === "neighborhood" && !seedItemId;

  return (
    <aside
      className="relative border-[var(--vigil-border)] border-l bg-[var(--vigil-bg)]"
      style={{ width, minWidth: 320, maxWidth: 760 }}
    >
      <div
        className="absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize bg-transparent hover:bg-[var(--vigil-border)]/70"
        onPointerDown={(event) => {
          event.preventDefault();
          const startX = event.clientX;
          const startWidth = width;
          const onMove = (e: PointerEvent) => {
            const delta = startX - e.clientX;
            onResizeWidth(
              Math.max(320, Math.min(760, Math.round(startWidth + delta)))
            );
          };
          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
      />
      <div className="flex items-center justify-between border-[var(--vigil-border)] border-b px-3 py-2">
        <div className="font-semibold text-[var(--vigil-label)] text-xs uppercase tracking-[0.16em]">
          Graph panel
        </div>
        <Button onClick={onClose} size="sm" tone="menu" variant="ghost">
          Close
        </Button>
      </div>

      {showingSeedPicker ? (
        <div className="p-3">
          <div className="mb-2 text-[var(--vigil-label)] text-xs">
            Pick a seed item to explore its 1–2 hop neighborhood.
          </div>
          <input
            autoFocus
            className="w-full rounded-md border border-[var(--vigil-border)] bg-transparent px-2 py-1 text-sm"
            onChange={(e) => setSeedSearchQuery(e.target.value)}
            placeholder="Search items..."
            value={seedSearchQuery}
          />
          <div className="mt-2 max-h-[55vh] overflow-auto">
            {seedSearchLoading && (
              <div className="px-1 py-2 text-[var(--vigil-muted)] text-xs">
                Searching…
              </div>
            )}
            {!seedSearchLoading &&
              seedSearchQuery.trim().length >= 2 &&
              seedSearchResults.length === 0 && (
                <div className="px-1 py-2 text-[var(--vigil-muted)] text-xs">
                  No matches.
                </div>
              )}
            <ul className="space-y-1">
              {seedSearchResults.map((hit) => (
                <li key={hit.id}>
                  <Button
                    className="w-full justify-start truncate"
                    onClick={() => handlePickSeed(hit)}
                    size="sm"
                    tone="menu"
                    variant="subtle"
                  >
                    {hit.title ?? "(untitled)"}
                    {hit.itemType ? (
                      <span className="ml-1 text-[var(--vigil-muted)]">
                        ({hit.itemType})
                      </span>
                    ) : null}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 border-[var(--vigil-border)] border-t pt-2">
            <Button
              onClick={handleEnterFullMode}
              size="sm"
              tone="menu"
              variant="ghost"
            >
              Load whole brane (capped to {FULL_MODE_LIMIT})
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-[var(--vigil-border)] border-b px-3 py-2 text-xs">
            {mode === "neighborhood" ? (
              <>
                <span className="text-[var(--vigil-label)]">Seed:</span>
                <span className="truncate font-medium">
                  {seedTitle ?? "(untitled)"}
                </span>
                <span className="ml-2 text-[var(--vigil-muted)]">depth</span>
                <Button
                  onClick={() => setMaxDepth(1)}
                  size="sm"
                  tone="menu"
                  variant={maxDepth === 1 ? "subtle" : "ghost"}
                >
                  1
                </Button>
                <Button
                  onClick={() => setMaxDepth(2)}
                  size="sm"
                  tone="menu"
                  variant={maxDepth === 2 ? "subtle" : "ghost"}
                >
                  2
                </Button>
                <Button
                  onClick={handleClearSeed}
                  size="sm"
                  tone="menu"
                  variant="ghost"
                >
                  Switch seed
                </Button>
              </>
            ) : (
              <>
                <span className="text-[var(--vigil-label)]">
                  Full brane (capped)
                </span>
                <Button
                  onClick={handleClearSeed}
                  size="sm"
                  tone="menu"
                  variant="ghost"
                >
                  Pick seed
                </Button>
              </>
            )}
          </div>

          <div className="p-3">
            <input
              className="w-full rounded-md border border-[var(--vigil-border)] bg-transparent px-2 py-1 text-sm"
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter loaded nodes..."
              value={filterQuery}
            />
          </div>

          <div className="px-3 pb-2 text-[var(--vigil-label)] text-xs">
            {loading
              ? "Loading graph..."
              : `${nodes.length} nodes · ${edges.length} edges`}
          </div>

          {(truncated || frontierTruncated) && !loading && (
            <div className="mx-3 mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-300 text-xs">
              Result was capped. Switch seed, lower depth, or refine to see
              more.
            </div>
          )}
          {error && !loading && (
            <div className="mx-3 mb-2 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="max-h-[55vh] overflow-auto px-3 pb-3">
            <ul className="space-y-1">
              {filteredNodes.slice(0, 200).map((node) => (
                <li key={node.id}>
                  <Button
                    className="w-full justify-start truncate"
                    onClick={() => onSelectItem(node.id)}
                    size="sm"
                    tone="menu"
                    variant="subtle"
                  >
                    {node.title}
                    <span className="ml-1 text-[var(--vigil-muted)]">
                      ({node.itemType})
                    </span>
                    {mode === "neighborhood" && node.depth > 0 ? (
                      <span className="ml-1 text-[var(--vigil-muted)]">
                        ·hop {node.depth}
                      </span>
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
