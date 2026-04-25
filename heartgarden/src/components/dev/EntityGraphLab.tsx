"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { EntityGraphPillCanvas } from "@/src/components/dev/EntityGraphPillCanvas";
import styles from "@/src/components/dev/entity-graph-lab.module.css";
import { Button } from "@/src/components/ui/Button";
import { cx } from "@/src/lib/cx";
import { computeStableLayout } from "@/src/lib/entity-graph-stable-layout";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";
import {
  HEARTGARDEN_GLASS_PANEL,
  HEARTGARDEN_METADATA_LABEL,
} from "@/src/lib/vigil-ui-classes";

interface GraphScenario {
  edges: GraphEdge[];
  key: string;
  label: string;
  nodes: GraphNode[];
  summary: string;
}

const SCENARIOS: GraphScenario[] = [
  {
    edges: [
      {
        color: null,
        id: "e-1",
        linkType: "member_of",
        source: "n-char-1",
        sourcePin: null,
        target: "n-fac-1",
        targetPin: null,
      },
      {
        color: null,
        id: "e-2",
        linkType: "member_of",
        source: "n-char-2",
        sourcePin: null,
        target: "n-fac-1",
        targetPin: null,
      },
      {
        color: null,
        id: "e-3",
        linkType: "member_of",
        source: "n-char-3",
        sourcePin: null,
        target: "n-fac-2",
        targetPin: null,
      },
      {
        color: null,
        id: "e-4",
        linkType: "operates_in",
        source: "n-fac-1",
        sourcePin: null,
        target: "n-loc-1",
        targetPin: null,
      },
      {
        color: null,
        id: "e-5",
        linkType: "operates_in",
        source: "n-fac-2",
        sourcePin: null,
        target: "n-loc-2",
        targetPin: null,
      },
      {
        color: null,
        id: "e-6",
        linkType: "trade_route",
        source: "n-loc-1",
        sourcePin: null,
        target: "n-loc-2",
        targetPin: null,
      },
      {
        color: null,
        id: "e-7",
        linkType: "mentioned_in",
        source: "n-char-1",
        sourcePin: null,
        target: "n-note-1",
        targetPin: null,
      },
      {
        color: null,
        id: "e-8",
        linkType: "mentioned_in",
        source: "n-char-2",
        sourcePin: null,
        target: "n-note-2",
        targetPin: null,
      },
      {
        color: null,
        id: "e-9",
        linkType: "referenced_by",
        source: "n-fac-1",
        sourcePin: null,
        target: "n-note-2",
        targetPin: null,
      },
    ],
    key: "founders-circle",
    label: "Founders circle",
    nodes: [
      {
        entityType: "character",
        id: "n-char-1",
        itemType: "lore.character",
        title: "Ari Voss",
      },
      {
        entityType: "character",
        id: "n-char-2",
        itemType: "lore.character",
        title: "Mira Kest",
      },
      {
        entityType: "character",
        id: "n-char-3",
        itemType: "lore.character",
        title: "Talon Reed",
      },
      {
        entityType: "faction",
        id: "n-fac-1",
        itemType: "lore.faction",
        title: "Glass Meridian",
      },
      {
        entityType: "faction",
        id: "n-fac-2",
        itemType: "lore.faction",
        title: "Archive of Salt",
      },
      {
        entityType: "location",
        id: "n-loc-1",
        itemType: "lore.location",
        title: "Kestrel Free City",
      },
      {
        entityType: "location",
        id: "n-loc-2",
        itemType: "lore.location",
        title: "Old Harbor Kiln No. 4",
      },
      {
        entityType: null,
        id: "n-note-1",
        itemType: "note",
        title: "Treaty Fragments",
      },
      {
        entityType: null,
        id: "n-note-2",
        itemType: "note",
        title: "Signal Ladder Ledger",
      },
    ],
    summary: "Balanced cluster around one location and two factions.",
  },
  {
    edges: [
      {
        color: null,
        id: "de-1",
        linkType: "member_of",
        source: "d-char-1",
        sourcePin: null,
        target: "d-fac-1",
        targetPin: null,
      },
      {
        color: null,
        id: "de-2",
        linkType: "rival_of",
        source: "d-char-2",
        sourcePin: null,
        target: "d-fac-1",
        targetPin: null,
      },
      {
        color: null,
        id: "de-3",
        linkType: "operates_in",
        source: "d-fac-1",
        sourcePin: null,
        target: "d-loc-1",
        targetPin: null,
      },
      {
        color: null,
        id: "de-4",
        linkType: "mentioned_in",
        source: "d-char-1",
        sourcePin: null,
        target: "d-note-1",
        targetPin: null,
      },
      {
        color: null,
        id: "de-5",
        linkType: "mentioned_in",
        source: "d-char-1",
        sourcePin: null,
        target: "d-note-2",
        targetPin: null,
      },
      {
        color: null,
        id: "de-6",
        linkType: "mentioned_in",
        source: "d-char-2",
        sourcePin: null,
        target: "d-note-2",
        targetPin: null,
      },
      {
        color: null,
        id: "de-7",
        linkType: "mentioned_in",
        source: "d-char-2",
        sourcePin: null,
        target: "d-note-3",
        targetPin: null,
      },
      {
        color: null,
        id: "de-8",
        linkType: "mentioned_in",
        source: "d-fac-1",
        sourcePin: null,
        target: "d-note-4",
        targetPin: null,
      },
      {
        color: null,
        id: "de-9",
        linkType: "mentioned_in",
        source: "d-fac-1",
        sourcePin: null,
        target: "d-note-5",
        targetPin: null,
      },
      {
        color: null,
        id: "de-10",
        linkType: "mentioned_in",
        source: "d-loc-1",
        sourcePin: null,
        target: "d-note-6",
        targetPin: null,
      },
      {
        color: null,
        id: "de-11",
        linkType: "cross_ref",
        source: "d-note-2",
        sourcePin: null,
        target: "d-note-4",
        targetPin: null,
      },
    ],
    key: "dense-mentions",
    label: "Dense mentions",
    nodes: [
      {
        entityType: "character",
        id: "d-char-1",
        itemType: "lore.character",
        title: "Iris Moor",
      },
      {
        entityType: "character",
        id: "d-char-2",
        itemType: "lore.character",
        title: "Cass Ember",
      },
      {
        entityType: "faction",
        id: "d-fac-1",
        itemType: "lore.faction",
        title: "Aster Cartel",
      },
      {
        entityType: "location",
        id: "d-loc-1",
        itemType: "lore.location",
        title: "Nine Lantern Court",
      },
      {
        entityType: null,
        id: "d-note-1",
        itemType: "note",
        title: "Operation Bellglass",
      },
      {
        entityType: null,
        id: "d-note-2",
        itemType: "note",
        title: "Witness Rollup",
      },
      {
        entityType: null,
        id: "d-note-3",
        itemType: "note",
        title: "Customs Dispute Log",
      },
      {
        entityType: null,
        id: "d-note-4",
        itemType: "note",
        title: "Night Watch Brief",
      },
      {
        entityType: null,
        id: "d-note-5",
        itemType: "note",
        title: "Aftermarket Price Sheet",
      },
      {
        entityType: null,
        id: "d-note-6",
        itemType: "note",
        title: "Crossdock Diagram",
      },
    ],
    summary: "Stress test with many note links into a small lore core.",
  },
];

function byTitle(a: GraphNode, b: GraphNode): number {
  return a.title.localeCompare(b.title);
}

export function EntityGraphLab() {
  const [scenarioKey, setScenarioKey] = useState(SCENARIOS[0]?.key ?? "");
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layout, setLayout] = useState<Map<string, { x: number; y: number }>>(
    new Map()
  );
  const [cameraResetKey, setCameraResetKey] = useState(0);

  const layoutByScenarioRef = useRef<
    Map<string, Map<string, { x: number; y: number }>>
  >(new Map());
  const pinnedByScenarioRef = useRef<
    Map<string, Map<string, { x: number; y: number }>>
  >(new Map());

  const scenario = useMemo(
    () =>
      SCENARIOS.find((candidate) => candidate.key === scenarioKey) ??
      SCENARIOS[0],
    [scenarioKey]
  );

  useEffect(() => {
    if (!scenario) {
      return;
    }
    const cached = layoutByScenarioRef.current.get(scenario.key);
    if (cached) {
      setLayout(new Map(cached));
      return;
    }
    const pins = pinnedByScenarioRef.current.get(scenario.key);
    const next = computeStableLayout(scenario.nodes, scenario.edges, {
      height: 1000,
      pinned: pins,
      width: 1000,
    });
    layoutByScenarioRef.current.set(scenario.key, new Map(next));
    setLayout(next);
  }, [scenario]);

  const visibleNodes = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!scenario || q.length === 0) {
      return scenario?.nodes ?? [];
    }
    return scenario.nodes.filter((node) => {
      const titleHit = node.title.toLowerCase().includes(q);
      const typeHit = node.entityType?.toLowerCase().includes(q) ?? false;
      const itemTypeHit = node.itemType.toLowerCase().includes(q);
      return titleHit || typeHit || itemTypeHit;
    });
  }, [filter, scenario]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes]
  );

  const visibleEdges = useMemo(
    () =>
      (scenario?.edges ?? []).filter(
        (edge) =>
          visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
      ),
    [scenario, visibleNodeIds]
  );

  const visibleEdgeIds = useMemo(
    () => new Set(visibleEdges.map((edge) => edge.id)),
    [visibleEdges]
  );

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    if (!visibleNodeIds.has(selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, visibleNodeIds]);

  const selectedNode = useMemo(
    () => scenario?.nodes.find((node) => node.id === selectedId) ?? null,
    [scenario, selectedId]
  );

  const neighborIds = useMemo(() => {
    if (!selectedNode) {
      return [];
    }
    const connectedIds = new Set<string>();
    for (const edge of visibleEdges) {
      if (edge.source === selectedNode.id) {
        connectedIds.add(edge.target);
      }
      if (edge.target === selectedNode.id) {
        connectedIds.add(edge.source);
      }
    }
    return Array.from(connectedIds);
  }, [selectedNode, visibleEdges]);

  const neighborIdSet = useMemo(() => new Set(neighborIds), [neighborIds]);

  const selectedNeighbors = useMemo(() => {
    if (!selectedNode) {
      return [];
    }
    return visibleNodes
      .filter((node) => neighborIdSet.has(node.id))
      .sort(byTitle);
  }, [selectedNode, visibleNodes, neighborIdSet]);

  const activeEdgeIds = useMemo(() => {
    if (!selectedNode) {
      return new Set<string>();
    }
    const ids = new Set<string>();
    for (const edge of visibleEdges) {
      if (edge.source === selectedNode.id || edge.target === selectedNode.id) {
        ids.add(edge.id);
      }
    }
    return ids;
  }, [selectedNode, visibleEdges]);

  const applyLayoutForScenario = (
    nextLayout: Map<string, { x: number; y: number }>
  ) => {
    if (!scenario) {
      return;
    }
    layoutByScenarioRef.current.set(scenario.key, new Map(nextLayout));
    setLayout(new Map(nextLayout));
  };

  const handleReSolve = () => {
    if (!scenario) {
      return;
    }
    const pins = pinnedByScenarioRef.current.get(scenario.key);
    const next = computeStableLayout(scenario.nodes, scenario.edges, {
      height: 1000,
      pinned: pins,
      width: 1000,
    });
    applyLayoutForScenario(next);
  };

  const handlePinNode = (id: string, position: { x: number; y: number }) => {
    if (!scenario) {
      return;
    }
    const perScenario =
      pinnedByScenarioRef.current.get(scenario.key) ?? new Map();
    perScenario.set(id, position);
    pinnedByScenarioRef.current.set(scenario.key, perScenario);
  };

  const visibleLayout = useMemo(() => {
    const next = new Map<string, { x: number; y: number }>();
    for (const node of visibleNodes) {
      const point = layout.get(node.id);
      if (point) {
        next.set(node.id, point);
      }
    }
    return next;
  }, [layout, visibleNodes]);

  if (!scenario) {
    return null;
  }

  const selectedVisible = selectedId ? visibleNodeIds.has(selectedId) : false;
  const selectedCount = selectedNeighbors.length;
  const selectedType =
    selectedNode?.entityType ?? selectedNode?.itemType ?? "node";
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
              <div className="p-4 text-[var(--vigil-muted)] text-sm">
                No nodes match this filter.
              </div>
            ) : (
              <EntityGraphPillCanvas
                activeEdgeIds={
                  selectedVisible ? activeEdgeIds : new Set<string>()
                }
                cameraResetKey={cameraResetKey}
                edges={visibleEdges}
                layout={visibleLayout}
                neighborIds={
                  selectedVisible ? neighborIdSet : new Set<string>()
                }
                nodes={visibleNodes}
                onLayoutChange={applyLayoutForScenario}
                onNodePin={handlePinNode}
                onSelect={setSelectedId}
                selectedId={selectedVisible ? selectedId : null}
              />
            )}
          </div>
        </section>

        <header className={cx(HEARTGARDEN_GLASS_PANEL, styles.topChrome)}>
          <div className={styles.headerRow}>
            <span className={HEARTGARDEN_METADATA_LABEL}>Entity graph lab</span>
            <div className={styles.controls}>
              <div
                aria-label="Graph scenario selector"
                className={styles.scenarioButtons}
                role="toolbar"
              >
                {SCENARIOS.map((item) => (
                  <Button
                    aria-label={`Switch to ${item.label} scenario`}
                    isActive={item.key === scenario.key}
                    key={item.key}
                    onClick={() => {
                      setScenarioKey(item.key);
                      setSelectedId(null);
                      setCameraResetKey((current) => current + 1);
                    }}
                    size="sm"
                    tone="menu"
                    variant="subtle"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <input
                aria-label="Filter graph nodes"
                className={styles.searchInput}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter by label, type, or item kind"
                value={filter}
              />
              <span className={styles.counts}>
                {visibleLayout.size} nodes · {visibleEdgeIds.size} edges
              </span>
              <Button
                aria-label="Recompute graph layout"
                onClick={handleReSolve}
                size="sm"
                tone="glass"
                variant="default"
              >
                Re-solve layout
              </Button>
              <Button
                aria-label="Reset camera position and zoom"
                onClick={() => setCameraResetKey((current) => current + 1)}
                size="sm"
                tone="glass"
                variant="default"
              >
                Reset camera
              </Button>
            </div>
          </div>
        </header>

        <aside
          className={cx(
            HEARTGARDEN_GLASS_PANEL,
            styles.panel,
            selectedNode && styles.panelVisible
          )}
        >
          <div className={styles.panelInner}>
            {selectedNode ? (
              <>
                <span className={HEARTGARDEN_METADATA_LABEL}>
                  {selectedType}
                </span>
                <h2 className={styles.nodeTitle}>{selectedLabel}</h2>
                <p className={styles.panelHint}>{selectedDescription}</p>
                <div className={styles.metaRow}>
                  <span className={HEARTGARDEN_METADATA_LABEL}>
                    Connections
                  </span>
                  <strong>{selectedCount}</strong>
                </div>
                <div className={styles.neighbors}>
                  {selectedNeighbors.length === 0 ? (
                    <p className={styles.panelHint}>
                      No visible neighbors in current filter.
                    </p>
                  ) : (
                    selectedNeighbors.map((node) => (
                      <Button
                        aria-label={`Focus neighbor ${node.title}`}
                        className="w-full justify-start truncate"
                        key={node.id}
                        onClick={() => setSelectedId(node.id)}
                        size="sm"
                        tone="menu"
                        variant="subtle"
                      >
                        {node.title}
                      </Button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className={styles.panelHint}>
                Select a node to enter focus mode. Escape or click empty canvas
                resets focus.
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
