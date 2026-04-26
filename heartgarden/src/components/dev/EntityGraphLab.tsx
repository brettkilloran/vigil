"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  CameraAction,
  GraphCanvasSharedProps,
  GraphEdgeHover,
  LayoutMap,
} from "@/src/components/dev/entity-graph-renderer-types";
import styles from "@/src/components/dev/entity-graph-lab.module.css";
import { Button } from "@/src/components/ui/Button";
import {
  solveStableLayoutIncrementalInWorker,
  solveStableLayoutStreamingInWorker,
} from "@/src/lib/entity-graph-layout-client";
import { buildEntityGraphModel } from "@/src/lib/entity-graph-model";
import { getRelationStyle } from "@/src/lib/entity-graph-relation-style";
import { buildSyntheticScenario } from "@/src/lib/entity-graph-synthetic";
import {
  clearEntityGraphLayoutCache,
  computeSyntheticGraphRevision,
  readEntityGraphLayoutCache,
  writeEntityGraphLayoutCache,
} from "@/src/lib/entity-graph-layout-cache";
import { GRAPH_LAYOUT_CACHE_LAYOUT_VERSION } from "@/src/lib/graph-layout-cache-contract";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";
import {
  HEARTGARDEN_GLASS_PANEL,
  HEARTGARDEN_METADATA_LABEL,
} from "@/src/lib/vigil-ui-classes";
import { cx } from "@/src/lib/cx";

const EntityGraphThreeCanvas = dynamic<GraphCanvasSharedProps>(
  () => import("@/src/components/dev/EntityGraphThreeCanvas").then((mod) => mod.EntityGraphThreeCanvas),
  { ssr: false },
);

type GraphScenario = {
  key: string;
  label: string;
  summary: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const SCENARIOS: GraphScenario[] = [
  {
    key: "founders-circle",
    label: "Founders circle",
    summary: "Balanced cluster around one location and two factions.",
    nodes: [
      { id: "n-char-1", title: "Ari Voss", itemType: "lore.character", entityType: "character" },
      { id: "n-char-2", title: "Mira Kest", itemType: "lore.character", entityType: "character" },
      { id: "n-char-3", title: "Talon Reed", itemType: "lore.character", entityType: "character" },
      { id: "n-fac-1", title: "Glass Meridian", itemType: "lore.faction", entityType: "faction" },
      { id: "n-fac-2", title: "Archive of Salt", itemType: "lore.faction", entityType: "faction" },
      { id: "n-loc-1", title: "Kestrel Free City", itemType: "lore.location", entityType: "location" },
      { id: "n-loc-2", title: "Old Harbor Kiln No. 4", itemType: "lore.location", entityType: "location" },
      { id: "n-note-1", title: "Treaty Fragments", itemType: "note", entityType: null },
      { id: "n-note-2", title: "Signal Ladder Ledger", itemType: "note", entityType: null },
    ],
    edges: [
      { id: "e-1", source: "n-char-1", target: "n-fac-1", color: null, sourcePin: null, targetPin: null, linkType: "member_of" },
      { id: "e-2", source: "n-char-2", target: "n-fac-1", color: null, sourcePin: null, targetPin: null, linkType: "member_of" },
      { id: "e-3", source: "n-char-3", target: "n-fac-2", color: null, sourcePin: null, targetPin: null, linkType: "member_of" },
      { id: "e-4", source: "n-fac-1", target: "n-loc-1", color: null, sourcePin: null, targetPin: null, linkType: "operates_in" },
      { id: "e-5", source: "n-fac-2", target: "n-loc-2", color: null, sourcePin: null, targetPin: null, linkType: "operates_in" },
      { id: "e-6", source: "n-loc-1", target: "n-loc-2", color: null, sourcePin: null, targetPin: null, linkType: "trade_route" },
      { id: "e-7", source: "n-char-1", target: "n-note-1", color: null, sourcePin: null, targetPin: null, linkType: "mentioned_in" },
      { id: "e-8", source: "n-char-2", target: "n-note-2", color: null, sourcePin: null, targetPin: null, linkType: "mentioned_in" },
      { id: "e-9", source: "n-fac-1", target: "n-note-2", color: null, sourcePin: null, targetPin: null, linkType: "referenced_by" },
    ],
  },
  {
    key: "dense-mentions",
    label: "Dense mentions",
    summary: "Stress test with many note links into a small lore core.",
    nodes: [
      { id: "d-char-1", title: "Iris Moor", itemType: "lore.character", entityType: "character" },
      { id: "d-char-2", title: "Cass Ember", itemType: "lore.character", entityType: "character" },
      { id: "d-fac-1", title: "Aster Cartel", itemType: "lore.faction", entityType: "faction" },
      { id: "d-loc-1", title: "Nine Lantern Court", itemType: "lore.location", entityType: "location" },
      { id: "d-note-1", title: "Operation Bellglass", itemType: "note", entityType: null },
      { id: "d-note-2", title: "Witness Rollup", itemType: "note", entityType: null },
      { id: "d-note-3", title: "Customs Dispute Log", itemType: "note", entityType: null },
      { id: "d-note-4", title: "Night Watch Brief", itemType: "note", entityType: null },
      { id: "d-note-5", title: "Aftermarket Price Sheet", itemType: "note", entityType: null },
      { id: "d-note-6", title: "Crossdock Diagram", itemType: "note", entityType: null },
    ],
    edges: [
      { id: "de-1", source: "d-char-1", target: "d-fac-1", color: null, sourcePin: null, targetPin: null, linkType: "member_of" },
      { id: "de-2", source: "d-char-2", target: "d-fac-1", color: null, sourcePin: null, targetPin: null, linkType: "rival_of" },
      { id: "de-3", source: "d-fac-1", target: "d-loc-1", color: null, sourcePin: null, targetPin: null, linkType: "operates_in" },
      { id: "de-4", source: "d-char-1", target: "d-note-1", color: null, sourcePin: null, targetPin: null, linkType: "mentioned_in" },
      { id: "de-5", source: "d-char-1", target: "d-note-2", color: null, sourcePin: null, targetPin: null, linkType: "mentioned_in" },
      { id: "de-6", source: "d-char-2", target: "d-note-2", color: null, sourcePin: null, targetPin: null, linkType: "mentioned_in" },
      { id: "de-7", source: "d-char-2", target: "d-note-3", color: null, sourcePin: null, targetPin: null, linkType: "mentioned_in" },
      { id: "de-8", source: "d-fac-1", target: "d-note-4", color: null, sourcePin: null, targetPin: null, linkType: "mentioned_in" },
      { id: "de-9", source: "d-fac-1", target: "d-note-5", color: null, sourcePin: null, targetPin: null, linkType: "mentioned_in" },
      { id: "de-10", source: "d-loc-1", target: "d-note-6", color: null, sourcePin: null, targetPin: null, linkType: "mentioned_in" },
      { id: "de-11", source: "d-note-2", target: "d-note-4", color: null, sourcePin: null, targetPin: null, linkType: "cross_ref" },
    ],
  },
];

function byTitle(a: GraphNode, b: GraphNode): number {
  return a.title.localeCompare(b.title);
}

function computeWorldSize(nodeCount: number): { width: number; height: number } {
  const floor = 2200;
  const spread = Math.ceil(Math.sqrt(Math.max(1, nodeCount)) * 230);
  const side = Math.min(42000, Math.max(floor, spread));
  return { width: side, height: side };
}

const STRESS_1K = buildSyntheticScenario("stress-1k", "Stress 1k", 1000, 1800, 1);
const STRESS_10K = buildSyntheticScenario("stress-10k", "Stress 10k", 10000, 12000, 2);

const ALL_SCENARIOS: GraphScenario[] = [...SCENARIOS, STRESS_1K, STRESS_10K];

function nextAction(
  key: number,
  type: CameraAction,
): {
  key: number;
  type: CameraAction;
} {
  return { key: key + 1, type };
}

function normalizeScenarioKey(candidate: string | null | undefined): string {
  if (!candidate) return SCENARIOS[0]?.key ?? "";
  return ALL_SCENARIOS.some((scenario) => scenario.key === candidate) ? candidate : (SCENARIOS[0]?.key ?? "");
}

export function EntityGraphLab({
  initialScenarioKey,
  initialFilter = "",
}: {
  initialScenarioKey?: string | null;
  initialFilter?: string;
}) {
  const storageKey = "heartgarden:entity-graph-lab:v1";
  const router = useRouter();
  const pathname = usePathname();
  const [scenarioKey, setScenarioKey] = useState(() => normalizeScenarioKey(initialScenarioKey));
  const [filter, setFilter] = useState(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdgeHover | null>(null);
  const [layout, setLayout] = useState<LayoutMap>(new Map());
  const [cameraAction, setCameraAction] = useState<{ key: number; type: CameraAction }>({
    key: 0,
    type: "reset",
  });
  const [showHint, setShowHint] = useState(true);
  const [fps, setFps] = useState(0);
  const [layoutMs, setLayoutMs] = useState(0);
  const [neighborFocusIndex, setNeighborFocusIndex] = useState(0);
  const [hoveredNeighborId, setHoveredNeighborId] = useState<string | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const undoRef = useRef<Array<{ selectedId: string | null; selectedEdgeId: string | null }>>([]);
  const redoRef = useRef<Array<{ selectedId: string | null; selectedEdgeId: string | null }>>([]);

  const layoutByScenarioRef = useRef<Map<string, LayoutMap>>(new Map());
  const pinnedByScenarioRef = useRef<Map<string, LayoutMap>>(new Map());
  const lastSyncedQueryRef = useRef<string>("");

  useEffect(() => {
    setScenarioKey(normalizeScenarioKey(initialScenarioKey));
  }, [initialScenarioKey]);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("renderer", "three");
    params.set("scenario", scenarioKey);
    if (filter.length > 0) params.set("filter", filter);
    const next = `${pathname}?${params.toString()}`;
    if (lastSyncedQueryRef.current === next) return;
    lastSyncedQueryRef.current = next;
    router.replace(next, { scroll: false });
  }, [filter, pathname, router, scenarioKey]);

  const scenario = useMemo(
    () => ALL_SCENARIOS.find((candidate) => candidate.key === scenarioKey) ?? ALL_SCENARIOS[0],
    [scenarioKey],
  );
  const scenarioGraphRevision = useMemo(
    () => computeSyntheticGraphRevision(scenario?.nodes ?? [], scenario?.edges ?? []),
    [scenario?.edges, scenario?.nodes],
  );
  const world = useMemo(
    () => computeWorldSize(scenario?.nodes.length ?? 1),
    [scenario?.key, scenario?.nodes.length],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        scenarioKey?: string;
        pinnedByScenario?: Record<string, Array<[string, { x: number; y: number }]>>;
      };
      if (!initialScenarioKey && parsed.scenarioKey) setScenarioKey(parsed.scenarioKey);
      if (parsed.pinnedByScenario) {
        const restored = new Map<string, LayoutMap>();
        for (const [key, entries] of Object.entries(parsed.pinnedByScenario)) {
          restored.set(key, new Map(entries));
        }
        pinnedByScenarioRef.current = restored;
      }
    } catch {
      // Ignore malformed local storage payloads.
    }
  }, [initialScenarioKey, storageKey]);

  useEffect(() => {
    if (!scenario) return;
    let cancelled = false;
    const cached = layoutByScenarioRef.current.get(scenario.key);
    if (cached) {
      setLayout(new Map(cached));
      return;
    }
    const persistentCacheKey = `scenario:${scenario.key}`;
    const persistent = readEntityGraphLayoutCache(
      persistentCacheKey,
      scenarioGraphRevision,
      GRAPH_LAYOUT_CACHE_LAYOUT_VERSION,
    );
    if (persistent) {
      layoutByScenarioRef.current.set(scenario.key, new Map(persistent));
      setLayout(new Map(persistent));
      return;
    }
    const started = performance.now();
    const pins = pinnedByScenarioRef.current.get(scenario.key) ?? new Map();
    void solveStableLayoutIncrementalInWorker(scenario.nodes, scenario.edges, {
      width: world.width,
      height: world.height,
      pinned: pins,
    }).then((next) => {
      if (cancelled) return;
      layoutByScenarioRef.current.set(scenario.key, new Map(next));
      setLayout(next);
      setLayoutMs(Math.round(performance.now() - started));
    });
    return () => {
      cancelled = true;
    };
  }, [scenario, scenarioGraphRevision, world.height, world.width]);

  useEffect(() => {
    if (!scenario) return;
    if (layout.size === 0) return;
    const persistentCacheKey = `scenario:${scenario.key}`;
    const timer = window.setTimeout(() => {
      writeEntityGraphLayoutCache(
        persistentCacheKey,
        scenarioGraphRevision,
        layout,
        GRAPH_LAYOUT_CACHE_LAYOUT_VERSION,
      );
    }, 900);
    return () => window.clearTimeout(timer);
  }, [layout, scenario, scenarioGraphRevision]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    const loop = (now: number) => {
      frames += 1;
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const visibleNodes = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!scenario || q.length === 0) return scenario?.nodes ?? [];
    return scenario.nodes.filter((node) => {
      const titleHit = node.title.toLowerCase().includes(q);
      const typeHit = node.entityType?.toLowerCase().includes(q) ?? false;
      const itemTypeHit = node.itemType.toLowerCase().includes(q);
      return titleHit || typeHit || itemTypeHit;
    });
  }, [filter, scenario]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () =>
      (scenario?.edges ?? []).filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      ),
    [scenario, visibleNodeIds],
  );

  const visibleEdgeIds = useMemo(() => new Set(visibleEdges.map((edge) => edge.id)), [visibleEdges]);
  const model = useMemo(() => buildEntityGraphModel(visibleNodes, visibleEdges), [visibleNodes, visibleEdges]);

  const selectedNode = useMemo(
    () => scenario?.nodes.find((node) => node.id === selectedId) ?? null,
    [scenario, selectedId],
  );

  const neighborIds = useMemo(() => {
    if (!selectedNode) return [];
    return Array.from(model.neighborIdsByNode.get(selectedNode.id) ?? []);
  }, [model.neighborIdsByNode, selectedNode]);

  const neighborIdSet = useMemo(() => new Set(neighborIds), [neighborIds]);

  const selectedNeighbors = useMemo(() => {
    if (!selectedNode) return [];
    return visibleNodes.filter((node) => neighborIdSet.has(node.id)).sort(byTitle);
  }, [selectedNode, visibleNodes, neighborIdSet]);

  useEffect(() => {
    setNeighborFocusIndex(0);
  }, [filter, scenarioKey, selectedId]);

  const activeEdgeIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    return new Set(model.edgeIdsByNode.get(selectedNode.id) ?? []);
  }, [model.edgeIdsByNode, selectedNode]);

  const applyLayoutForScenario = useCallback(
    (nextLayout: LayoutMap) => {
      if (!scenario) return;
      layoutByScenarioRef.current.set(scenario.key, new Map(nextLayout));
      setLayout(new Map(nextLayout));
    },
    [scenario],
  );

  const handleReSolve = async () => {
    if (!scenario) return;
    const started = performance.now();
    const pins = pinnedByScenarioRef.current.get(scenario.key) ?? new Map();
    const next = await solveStableLayoutStreamingInWorker(
      scenario.nodes,
      scenario.edges,
      {
      width: world.width,
      height: world.height,
      pinned: pins,
      },
      (progress) => {
        applyLayoutForScenario(progress);
      },
    );
    applyLayoutForScenario(next);
    setLayoutMs(Math.round(performance.now() - started));
  };

  const handlePinNode = (id: string, position: { x: number; y: number }) => {
    if (!scenario) return;
    const perScenario = pinnedByScenarioRef.current.get(scenario.key) ?? new Map();
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      perScenario.delete(id);
      pinnedByScenarioRef.current.set(scenario.key, perScenario);
      return;
    }
    perScenario.set(id, position);
    pinnedByScenarioRef.current.set(scenario.key, perScenario);
  };

  useEffect(() => {
    const serializable: Record<string, Array<[string, { x: number; y: number }]>> = {};
    for (const [key, pins] of pinnedByScenarioRef.current.entries()) {
      serializable[key] = Array.from(pins.entries());
    }
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        scenarioKey,
        pinnedByScenario: serializable,
      }),
    );
  }, [layout, scenarioKey, storageKey]);

  const visibleLayout = useMemo(() => {
    const next = new Map<string, { x: number; y: number }>();
    for (const node of visibleNodes) {
      const point = layout.get(node.id);
      if (point) next.set(node.id, point);
    }
    return next;
  }, [layout, visibleNodes]);

  const selectedVisible = selectedId ? visibleNodeIds.has(selectedId) : false;
  const selectedCount = selectedNeighbors.length;
  const selectedType = selectedNode?.entityType ?? selectedNode?.itemType ?? "node";
  const selectedLabel = selectedNode?.title ?? "No selection";
  const selectedDescription = selectedNode
    ? `${selectedNode.itemType}${selectedNode.entityType ? ` · ${selectedNode.entityType}` : ""}`
    : "Select a node to inspect connected context.";
  const edgeById = useMemo(() => new Map(visibleEdges.map((edge) => [edge.id, edge])), [visibleEdges]);
  const selectedEdge = selectedEdgeId ? edgeById.get(selectedEdgeId) ?? null : null;
  const applyFocus = (nextSelectedId: string | null, nextEdgeId: string | null) => {
    undoRef.current.push({ selectedId, selectedEdgeId });
    redoRef.current = [];
    setSelectedId(nextSelectedId);
    setSelectedEdgeId(nextEdgeId);
  };

  const relationGroups = useMemo(() => {
    const groups = new Map<string, GraphNode[]>();
    if (!selectedNode) return groups;
    for (const neighbor of selectedNeighbors) {
      const edge = visibleEdges.find(
        (candidate) =>
          (candidate.source === selectedNode.id && candidate.target === neighbor.id) ||
          (candidate.source === neighbor.id && candidate.target === selectedNode.id),
      );
      const key = edge?.linkType ?? "related_to";
      const list = groups.get(key) ?? [];
      list.push(neighbor);
      groups.set(key, list);
    }
    for (const list of groups.values()) {
      list.sort(byTitle);
    }
    return groups;
  }, [selectedNeighbors, selectedNode, visibleEdges]);

  const shortestPathHops = useMemo(() => {
    if (!selectedNode || !hoveredNeighborId) return null;
    if (hoveredNeighborId === selectedNode.id) return 0;
    const queue: Array<{ id: string; depth: number }> = [{ id: selectedNode.id, depth: 0 }];
    const seen = new Set<string>([selectedNode.id]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = model.neighborIdsByNode.get(current.id) ?? new Set<string>();
      for (const neighbor of neighbors) {
        if (seen.has(neighbor)) continue;
        if (neighbor === hoveredNeighborId) return current.depth + 1;
        seen.add(neighbor);
        queue.push({ id: neighbor, depth: current.depth + 1 });
      }
    }
    return null;
  }, [hoveredNeighborId, model.neighborIdsByNode, selectedNode]);

  const mutualNeighborCount = useMemo(() => {
    if (!selectedNode || !hoveredNeighborId) return 0;
    const a = model.neighborIdsByNode.get(selectedNode.id) ?? new Set<string>();
    const b = model.neighborIdsByNode.get(hoveredNeighborId) ?? new Set<string>();
    let count = 0;
    for (const id of a) {
      if (b.has(id)) count += 1;
    }
    return count;
  }, [hoveredNeighborId, model.neighborIdsByNode, selectedNode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          const next = redoRef.current.pop();
          if (!next) return;
          undoRef.current.push({ selectedId, selectedEdgeId });
          setSelectedId(next.selectedId);
          setSelectedEdgeId(next.selectedEdgeId);
          return;
        }
        const prev = undoRef.current.pop();
        if (!prev) return;
        redoRef.current.push({ selectedId, selectedEdgeId });
        setSelectedId(prev.selectedId);
        setSelectedEdgeId(prev.selectedEdgeId);
        return;
      }
      if (!selectedNode || selectedNeighbors.length === 0) return;
      if (event.key === "j" || event.key === "J") {
        event.preventDefault();
        setNeighborFocusIndex((idx) => (idx + 1) % selectedNeighbors.length);
      } else if (event.key === "k" || event.key === "K") {
        event.preventDefault();
        setNeighborFocusIndex((idx) => (idx - 1 + selectedNeighbors.length) % selectedNeighbors.length);
      } else if (event.key === "Enter") {
        const next = selectedNeighbors[neighborFocusIndex];
        if (next) {
          event.preventDefault();
          applyFocus(next.id, null);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [neighborFocusIndex, selectedEdgeId, selectedId, selectedNeighbors, selectedNode]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.canvasCard}>
          <div className={styles.canvasViewport}>
            {visibleNodes.length === 0 ? (
              <div className="p-4 text-sm text-[var(--vigil-muted)]">No nodes match this filter.</div>
            ) : (
              <EntityGraphThreeCanvas
                nodes={visibleNodes}
                edges={visibleEdges}
                layout={visibleLayout}
                worldWidth={world.width}
                worldHeight={world.height}
                blurEffectsEnabled
                selectedId={selectedVisible ? selectedId : null}
                neighborIds={selectedVisible ? neighborIdSet : new Set<string>()}
                activeEdgeIds={selectedVisible ? activeEdgeIds : new Set<string>()}
                degreeByNode={model.degreeByNode}
                onSelect={(id) => applyFocus(id, selectedEdgeId)}
                onLayoutChange={applyLayoutForScenario}
                onNodePin={handlePinNode}
                cameraActionKey={cameraAction.key}
                cameraActionType={cameraAction.type}
                onEdgeHover={setHoveredEdge}
                onEdgeSelect={(id) => applyFocus(selectedId, id)}
              />
            )}
          </div>
        </section>

        <header className={cx(HEARTGARDEN_GLASS_PANEL, styles.topChrome)}>
          <div className={styles.headerRow}>
            <span className={HEARTGARDEN_METADATA_LABEL}>Entity graph lab</span>
            <span className={styles.summary}>{scenario.summary}</span>
            <div className={styles.controls}>
              <div
                className={styles.scenarioButtons}
                role="toolbar"
                aria-label="Graph scenario selector"
              >
                {ALL_SCENARIOS.map((item) => (
                  <Button
                    key={item.key}
                    size="sm"
                    variant="subtle"
                    tone="menu"
                    isActive={item.key === scenario.key}
                    onClick={() => {
                      setScenarioKey(item.key);
                      applyFocus(null, null);
                      setCameraAction((current) => nextAction(current.key, "reset"));
                    }}
                    aria-label={`Switch to ${item.label} scenario`}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <input
                className={styles.searchInput}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter by label, type, or item kind"
                aria-label="Filter graph nodes"
              />
              <span className={styles.counts}>
                {visibleLayout.size} nodes · {visibleEdgeIds.size} edges
              </span>
              <span className={styles.counts}>Renderer: THREE</span>
              <Button
                size="sm"
                variant="default"
                tone="glass"
                onClick={handleReSolve}
                aria-label="Recompute graph layout"
              >
                Re-solve layout
              </Button>
              <Button
                size="sm"
                variant="default"
                tone="glass"
                onClick={() => setCameraAction((current) => nextAction(current.key, "reset"))}
                aria-label="Reset camera position and zoom"
              >
                Reset camera
              </Button>
              <Button
                size="sm"
                variant="default"
                tone="glass"
                onClick={() => setCameraAction((current) => nextAction(current.key, "frame-all"))}
                aria-label="Frame all visible nodes"
              >
                Frame all
              </Button>
              <Button
                size="sm"
                variant="default"
                tone="glass"
                onClick={() => setCameraAction((current) => nextAction(current.key, "frame-selection"))}
                aria-label="Frame selected node and neighbors"
                disabled={!selectedNode}
              >
                Frame selection
              </Button>
              {filter.trim().length > 0 ? (
                <Button
                  size="sm"
                  variant="subtle"
                  tone="menu"
                  onClick={() => setFilter("")}
                  aria-label="Clear current graph filter"
                >
                  Clear filter
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="subtle"
                tone="menu"
                onClick={() => {
                  pinnedByScenarioRef.current.clear();
                  layoutByScenarioRef.current.clear();
                  window.localStorage.removeItem(storageKey);
                  clearEntityGraphLayoutCache();
                  void handleReSolve();
                }}
                aria-label="Reset persisted graph pins and cached layouts"
              >
                Reset lab
              </Button>
            </div>
            {showHint ? (
              <button
                type="button"
                className={styles.hintStrip}
                onClick={() => setShowHint(false)}
                aria-label="Hide graph interaction hint"
              >
                drag canvas · wheel zoom · alt-click selected node to unpin · esc clears focus
              </button>
            ) : (
              <Button
                size="sm"
                variant="subtle"
                tone="menu"
                onClick={() => setShowHint(true)}
                aria-label="Show graph interaction hints"
              >
                ?
              </Button>
            )}
          </div>
        </header>

        <aside className={cx(HEARTGARDEN_GLASS_PANEL, styles.panel, selectedNode && styles.panelVisible)}>
          <div className={styles.panelInner}>
            {selectedNode ? (
              <>
                <span className={HEARTGARDEN_METADATA_LABEL}>{selectedType}</span>
                <h2 className={styles.nodeTitle}>{selectedLabel}</h2>
                <p className={styles.panelHint}>{selectedDescription}</p>
                <div className={styles.metaRow}>
                  <span className={HEARTGARDEN_METADATA_LABEL}>Connections</span>
                  <strong>{selectedCount}</strong>
                </div>
                <div className={styles.relationGroups}>
                  {Array.from(relationGroups.entries()).map(([relation, nodesForRelation]) => (
                    <div key={relation} className={styles.relationGroup}>
                      <span className={HEARTGARDEN_METADATA_LABEL}>{getRelationStyle(relation).label}</span>
                      <div className={styles.neighbors}>
                        {nodesForRelation.map((node) => {
                          const flatIndex = selectedNeighbors.findIndex((candidate) => candidate.id === node.id);
                          return (
                            <Button
                              key={node.id}
                              size="sm"
                              variant="subtle"
                              tone="menu"
                              isActive={flatIndex === neighborFocusIndex}
                              className="w-full justify-start truncate"
                              onClick={(event) => {
                                if (event.shiftKey || event.metaKey || event.ctrlKey) {
                                  setMultiSelectedIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(node.id)) next.delete(node.id);
                                    else next.add(node.id);
                                    return next;
                                  });
                                  return;
                                }
                                applyFocus(node.id, null);
                              }}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                if (event.shiftKey || event.metaKey || event.ctrlKey) {
                                  setMultiSelectedIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(node.id)) next.delete(node.id);
                                    else next.add(node.id);
                                    return next;
                                  });
                                  return;
                                }
                                applyFocus(node.id, null);
                              }}
                              onMouseEnter={() => setHoveredNeighborId(node.id)}
                              onMouseLeave={() =>
                                setHoveredNeighborId((current) => (current === node.id ? null : current))
                              }
                              aria-label={`Focus neighbor ${node.title}`}
                            >
                              {node.title}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {selectedNeighbors.length === 0 ? (
                    <p className={styles.panelHint}>No visible neighbors in current filter.</p>
                  ) : null}
                </div>
              </>
            ) : (
              <p className={styles.panelHint}>
                Select a node to enter focus mode. Escape or click empty canvas resets focus.
              </p>
            )}
            {selectedEdge ? (
              <div className={styles.metaRow}>
                <span className={HEARTGARDEN_METADATA_LABEL}>Edge</span>
                <strong>{getRelationStyle(selectedEdge.linkType).label}</strong>
              </div>
            ) : null}
            {hoveredNeighborId ? (
              <div className={styles.metaRow}>
                <span className={HEARTGARDEN_METADATA_LABEL}>Hovered path</span>
                <strong>
                  {shortestPathHops === null ? "unreachable" : `${shortestPathHops} hops`} · {mutualNeighborCount} mutual
                </strong>
              </div>
            ) : null}
            {multiSelectedIds.size > 0 ? (
              <div className={styles.metaRow}>
                <span className={HEARTGARDEN_METADATA_LABEL}>Multi-select</span>
                <strong>{multiSelectedIds.size}</strong>
              </div>
            ) : null}
          </div>
        </aside>

        {hoveredEdge ? (
          <div className={styles.edgeTooltip}>{getRelationStyle(hoveredEdge.linkType).label}</div>
        ) : null}
        <div className={cx(HEARTGARDEN_GLASS_PANEL, styles.perfHud)}>
          fps {fps} · layout {layoutMs}ms · nodes {visibleNodes.length.toLocaleString()}
        </div>
      </div>
    </main>
  );
}
