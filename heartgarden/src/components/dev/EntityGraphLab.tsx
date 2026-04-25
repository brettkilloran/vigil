"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { EntityGraphPillCanvas } from "@/src/components/dev/EntityGraphPillCanvas";
import styles from "@/src/components/dev/entity-graph-lab.module.css";
import { Button } from "@/src/components/ui/Button";
import { computeStableLayout } from "@/src/lib/entity-graph-stable-layout";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";
import {
  HEARTGARDEN_GLASS_PANEL,
  HEARTGARDEN_METADATA_LABEL,
} from "@/src/lib/vigil-ui-classes";
import { cx } from "@/src/lib/cx";

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

export function EntityGraphLab() {
  const [scenarioKey, setScenarioKey] = useState(SCENARIOS[0]?.key ?? "");
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layout, setLayout] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [cameraResetKey, setCameraResetKey] = useState(0);

  const layoutByScenarioRef = useRef<Map<string, Map<string, { x: number; y: number }>>>(new Map());
  const pinnedByScenarioRef = useRef<Map<string, Map<string, { x: number; y: number }>>>(new Map());

  const scenario = useMemo(
    () => SCENARIOS.find((candidate) => candidate.key === scenarioKey) ?? SCENARIOS[0],
    [scenarioKey],
  );

  useEffect(() => {
    if (!scenario) return;
    const cached = layoutByScenarioRef.current.get(scenario.key);
    if (cached) {
      setLayout(new Map(cached));
      return;
    }
    const pins = pinnedByScenarioRef.current.get(scenario.key);
    const next = computeStableLayout(scenario.nodes, scenario.edges, {
      width: 1000,
      height: 1000,
      pinned: pins,
    });
    layoutByScenarioRef.current.set(scenario.key, new Map(next));
    setLayout(next);
  }, [scenario]);

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

  useEffect(() => {
    if (!selectedId) return;
    if (!visibleNodeIds.has(selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, visibleNodeIds]);

  const selectedNode = useMemo(
    () => scenario?.nodes.find((node) => node.id === selectedId) ?? null,
    [scenario, selectedId],
  );

  const neighborIds = useMemo(() => {
    if (!selectedNode) return [];
    const connectedIds = new Set<string>();
    for (const edge of visibleEdges) {
      if (edge.source === selectedNode.id) connectedIds.add(edge.target);
      if (edge.target === selectedNode.id) connectedIds.add(edge.source);
    }
    return Array.from(connectedIds);
  }, [selectedNode, visibleEdges]);

  const neighborIdSet = useMemo(() => new Set(neighborIds), [neighborIds]);

  const selectedNeighbors = useMemo(() => {
    if (!selectedNode) return [];
    return visibleNodes.filter((node) => neighborIdSet.has(node.id)).sort(byTitle);
  }, [selectedNode, visibleNodes, neighborIdSet]);

  const activeEdgeIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const ids = new Set<string>();
    for (const edge of visibleEdges) {
      if (edge.source === selectedNode.id || edge.target === selectedNode.id) {
        ids.add(edge.id);
      }
    }
    return ids;
  }, [selectedNode, visibleEdges]);

  const applyLayoutForScenario = (nextLayout: Map<string, { x: number; y: number }>) => {
    if (!scenario) return;
    layoutByScenarioRef.current.set(scenario.key, new Map(nextLayout));
    setLayout(new Map(nextLayout));
  };

  const handleReSolve = () => {
    if (!scenario) return;
    const pins = pinnedByScenarioRef.current.get(scenario.key);
    const next = computeStableLayout(scenario.nodes, scenario.edges, {
      width: 1000,
      height: 1000,
      pinned: pins,
    });
    applyLayoutForScenario(next);
  };

  const handlePinNode = (id: string, position: { x: number; y: number }) => {
    if (!scenario) return;
    const perScenario = pinnedByScenarioRef.current.get(scenario.key) ?? new Map();
    perScenario.set(id, position);
    pinnedByScenarioRef.current.set(scenario.key, perScenario);
  };

  const visibleLayout = useMemo(() => {
    const next = new Map<string, { x: number; y: number }>();
    for (const node of visibleNodes) {
      const point = layout.get(node.id);
      if (point) next.set(node.id, point);
    }
    return next;
  }, [layout, visibleNodes]);

  if (!scenario) return null;

  const selectedVisible = selectedId ? visibleNodeIds.has(selectedId) : false;
  const selectedCount = selectedNeighbors.length;
  const selectedType = selectedNode?.entityType ?? selectedNode?.itemType ?? "node";
  const selectedLabel = selectedNode?.title ?? "No selection";
  const selectedDescription = selectedNode
    ? `${selectedNode.itemType}${selectedNode.entityType ? ` · ${selectedNode.entityType}` : ""}`
    : "Select a node to inspect connected context.";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.canvasCard}>
          <div className={styles.canvasViewport}>
            {visibleNodes.length === 0 ? (
              <div className="p-4 text-sm text-[var(--vigil-muted)]">No nodes match this filter.</div>
            ) : (
              <EntityGraphPillCanvas
                nodes={visibleNodes}
                edges={visibleEdges}
                layout={visibleLayout}
                selectedId={selectedVisible ? selectedId : null}
                neighborIds={selectedVisible ? neighborIdSet : new Set<string>()}
                activeEdgeIds={selectedVisible ? activeEdgeIds : new Set<string>()}
                onSelect={setSelectedId}
                onLayoutChange={applyLayoutForScenario}
                onNodePin={handlePinNode}
                cameraResetKey={cameraResetKey}
              />
            )}
          </div>
        </section>

        <header className={cx(HEARTGARDEN_GLASS_PANEL, styles.topChrome)}>
          <div className={styles.headerRow}>
            <span className={HEARTGARDEN_METADATA_LABEL}>Entity graph lab</span>
            <div className={styles.controls}>
              <div
                className={styles.scenarioButtons}
                role="toolbar"
                aria-label="Graph scenario selector"
              >
                {SCENARIOS.map((item) => (
                  <Button
                    key={item.key}
                    size="sm"
                    variant="subtle"
                    tone="menu"
                    isActive={item.key === scenario.key}
                    onClick={() => {
                      setScenarioKey(item.key);
                      setSelectedId(null);
                      setCameraResetKey((current) => current + 1);
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
                onClick={() => setCameraResetKey((current) => current + 1)}
                aria-label="Reset camera position and zoom"
              >
                Reset camera
              </Button>
            </div>
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
                <div className={styles.neighbors}>
                  {selectedNeighbors.length === 0 ? (
                    <p className={styles.panelHint}>No visible neighbors in current filter.</p>
                  ) : (
                    selectedNeighbors.map((node) => (
                      <Button
                        key={node.id}
                        size="sm"
                        variant="subtle"
                        tone="menu"
                        className="w-full justify-start truncate"
                        onClick={() => setSelectedId(node.id)}
                        aria-label={`Focus neighbor ${node.title}`}
                      >
                        {node.title}
                      </Button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className={styles.panelHint}>
                Select a node to enter focus mode. Escape or click empty canvas resets focus.
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
