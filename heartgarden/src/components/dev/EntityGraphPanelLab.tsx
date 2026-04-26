"use client";

import { useEffect, useMemo, useState } from "react";

import { EntityGraphThreeCanvas } from "@/src/components/product-ui/canvas/EntityGraphThreeCanvas";
import { Button } from "@/src/components/ui/Button";
import type { CameraAction, LayoutMap } from "@/src/lib/graph-canvas-types";
import { solveStableLayoutStreamingInWorker } from "@/src/lib/entity-graph-layout-client";
import { buildEntityGraphModel } from "@/src/lib/entity-graph-model";
import { buildSyntheticScenario } from "@/src/lib/entity-graph-synthetic";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

type Scenario = {
  key: string;
  label: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const SMALL_SCENARIO: Scenario = {
  key: "small",
  label: "Small",
  nodes: [
    { id: "a", title: "Ari Voss", itemType: "lore.character", entityType: "character" },
    { id: "b", title: "Glass Meridian", itemType: "lore.faction", entityType: "faction" },
    { id: "c", title: "Kestrel Free City", itemType: "lore.location", entityType: "location" },
    { id: "d", title: "Treaty Fragments", itemType: "note", entityType: null },
    { id: "e", title: "Archive Clerk Notes", itemType: "note", entityType: null },
    { id: "f", title: "Dock Manifest", itemType: "note", entityType: null },
  ],
  edges: [
    { id: "e1", source: "a", target: "b", color: null, sourcePin: null, targetPin: null, linkType: "member_of" },
    { id: "e2", source: "b", target: "c", color: null, sourcePin: null, targetPin: null, linkType: "operates_in" },
    { id: "e3", source: "a", target: "d", color: null, sourcePin: null, targetPin: null, linkType: "mentioned_in" },
    { id: "e4", source: "b", target: "e", color: null, sourcePin: null, targetPin: null, linkType: "mentioned_in" },
    { id: "e5", source: "c", target: "f", color: null, sourcePin: null, targetPin: null, linkType: "referenced_by" },
  ],
};

const MEDIUM_SCENARIO = buildSyntheticScenario("panel-medium", "Medium", 220, 360, 1);
const LARGE_SCENARIO = buildSyntheticScenario("panel-large", "Large", 900, 1400, 2);
const SCENARIOS: Scenario[] = [SMALL_SCENARIO, MEDIUM_SCENARIO, LARGE_SCENARIO];

function computeWorldSize(nodeCount: number): { width: number; height: number } {
  const floor = 1800;
  const spread = Math.ceil(Math.sqrt(Math.max(1, nodeCount)) * 220);
  const side = Math.min(26000, Math.max(floor, spread));
  return { width: side, height: side };
}

function nextAction(key: number, type: CameraAction): { key: number; type: CameraAction } {
  return { key: key + 1, type };
}

export function EntityGraphPanelLab() {
  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0]?.key ?? "small");
  const [panelWidth, setPanelWidth] = useState(560);
  const [layout, setLayout] = useState<LayoutMap>(new Map());
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [cameraAction, setCameraAction] = useState<{ key: number; type: CameraAction }>({
    key: 0,
    type: "reset",
  });

  const scenario = useMemo(
    () => SCENARIOS.find((item) => item.key === scenarioId) ?? SCENARIOS[0] ?? SMALL_SCENARIO,
    [scenarioId],
  );
  const world = useMemo(() => computeWorldSize(scenario.nodes.length), [scenario.nodes.length]);

  const filteredNodeIds = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return new Set(scenario.nodes.map((node) => node.id));
    return new Set(
      scenario.nodes
        .filter(
          (node) =>
            node.title.toLowerCase().includes(q) ||
            node.itemType.toLowerCase().includes(q) ||
            (node.entityType?.toLowerCase().includes(q) ?? false),
        )
        .map((node) => node.id),
    );
  }, [filter, scenario.nodes]);

  const graphNodes = useMemo(
    () => scenario.nodes.filter((node) => filteredNodeIds.has(node.id)),
    [filteredNodeIds, scenario.nodes],
  );
  const graphNodeIdSet = useMemo(() => new Set(graphNodes.map((node) => node.id)), [graphNodes]);
  const graphEdges = useMemo(
    () =>
      scenario.edges.filter((edge) => graphNodeIdSet.has(edge.source) && graphNodeIdSet.has(edge.target)),
    [graphNodeIdSet, scenario.edges],
  );
  const model = useMemo(() => buildEntityGraphModel(graphNodes, graphEdges), [graphEdges, graphNodes]);
  const neighborIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return model.neighborIdsByNode.get(selectedId) ?? new Set<string>();
  }, [model, selectedId]);
  const activeEdgeIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return model.edgeIdsByNode.get(selectedId) ?? new Set<string>();
  }, [model, selectedId]);

  useEffect(() => {
    if (graphNodes.length === 0) {
      setLayout(new Map());
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
      .finally(() => {
        if (!cancelled) setLayoutLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [graphEdges, graphNodes, world.height, world.width]);

  useEffect(() => {
    if (!selectedId) return;
    if (graphNodeIdSet.has(selectedId)) return;
    setSelectedId(null);
  }, [graphNodeIdSet, selectedId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--vigil-canvas)] p-6">
      <section
        className="flex h-[86vh] max-h-[920px] min-h-[560px] flex-col overflow-hidden rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-bg)] shadow-xl"
        style={{ width: panelWidth, minWidth: 320, maxWidth: 760 }}
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-[var(--vigil-border)] px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--vigil-label)]">
            Entity Graph Panel UI Lab
          </span>
          <div className="ml-auto flex items-center gap-1">
            {SCENARIOS.map((item) => (
              <Button
                key={item.key}
                size="sm"
                variant={item.key === scenario.key ? "subtle" : "ghost"}
                tone="menu"
                onClick={() => {
                  setScenarioId(item.key);
                  setSelectedId(null);
                  setCameraAction((current) => nextAction(current.key, "reset"));
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </header>

        <div className="flex items-center gap-2 border-b border-[var(--vigil-border)] px-3 py-2 text-xs text-[var(--vigil-label)]">
          <span>Width</span>
          <input
            type="range"
            min={320}
            max={760}
            value={panelWidth}
            onChange={(event) => setPanelWidth(Number(event.target.value))}
          />
          <span className="tabular-nums text-[var(--vigil-muted)]">{panelWidth}px</span>
          <input
            className="ml-auto w-[180px] rounded-md border border-[var(--vigil-border)] bg-transparent px-2 py-1 text-xs"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter nodes"
          />
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
            disabled={!selectedId}
            onClick={() => setCameraAction((current) => nextAction(current.key, "frame-selection"))}
          >
            Frame selected
          </Button>
        </div>

        <div className="h-[360px] border-b border-[var(--vigil-border)]">
          {layout.size > 0 ? (
            <EntityGraphThreeCanvas
              nodes={graphNodes}
              edges={graphEdges}
              layout={layout}
              worldWidth={world.width}
              worldHeight={world.height}
              blurEffectsEnabled
              selectedId={selectedId}
              neighborIds={neighborIds}
              activeEdgeIds={activeEdgeIds}
              degreeByNode={model.degreeByNode}
              cameraActionKey={cameraAction.key}
              cameraActionType={cameraAction.type}
              onSelect={(id) => setSelectedId(id)}
              onLayoutChange={(next) => setLayout(new Map(next))}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[var(--vigil-muted)]">
              {layoutLoading ? "Solving layout..." : "No data for current filter."}
            </div>
          )}
        </div>

        <div className="px-3 py-2 text-xs text-[var(--vigil-label)]">
          {graphNodes.length.toLocaleString()} nodes · {graphEdges.length.toLocaleString()} edges
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
          <ul className="space-y-1">
            {graphNodes.slice(0, 220).map((node) => (
              <li key={node.id}>
                <Button
                  size="sm"
                  variant={selectedId === node.id ? "subtle" : "ghost"}
                  tone="menu"
                  className="w-full justify-start truncate"
                  onClick={() => {
                    setSelectedId(node.id);
                    setCameraAction((current) => nextAction(current.key, "frame-selection"));
                  }}
                >
                  {node.title}
                  <span className="ml-1 text-[var(--vigil-muted)]">({node.itemType})</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
