"use client";

import { useMemo, useState } from "react";

import { EntityGraphCanvas } from "@/src/components/product-ui/canvas/EntityGraphCanvas";
import { Button } from "@/src/components/ui/Button";
import type { GraphEdge, GraphNode } from "@/src/lib/graph-types";

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
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const scenario = useMemo(
    () => SCENARIOS.find((candidate) => candidate.key === scenarioKey) ?? SCENARIOS[0],
    [scenarioKey],
  );

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

  const selectedNode = useMemo(
    () => visibleNodes.find((node) => node.id === selectedId) ?? null,
    [visibleNodes, selectedId],
  );

  const selectedNeighbors = useMemo(() => {
    if (!selectedNode) return [];
    const connectedIds = new Set<string>();
    for (const edge of visibleEdges) {
      if (edge.source === selectedNode.id) connectedIds.add(edge.target);
      if (edge.target === selectedNode.id) connectedIds.add(edge.source);
    }
    return visibleNodes.filter((node) => connectedIds.has(node.id)).sort(byTitle);
  }, [selectedNode, visibleEdges, visibleNodes]);

  if (!scenario) return null;

  return (
    <main className="min-h-screen bg-[var(--vigil-canvas)] p-6 text-[var(--vigil-label)]">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
        <header className="rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-surface)] p-4">
          <h1 className="text-lg font-semibold">Entity graph lab</h1>
          <p className="mt-1 text-sm text-[var(--vigil-muted)]">
            Isolated sandbox with deterministic dummy data so UX/UI can be tuned without API noise.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-xs uppercase tracking-[0.12em] text-[var(--vigil-muted)]" htmlFor="entity-graph-scenario">
              Scenario
            </label>
            <select
              id="entity-graph-scenario"
              className="rounded-md border border-[var(--vigil-border)] bg-transparent px-2 py-1 text-sm"
              value={scenario.key}
              onChange={(event) => {
                setScenarioKey(event.target.value);
                setSelectedId(null);
                setLayoutRevision(0);
              }}
            >
              {SCENARIOS.map((item) => (
                <option key={item.key} value={item.key} className="bg-[var(--vigil-bg)]">
                  {item.label}
                </option>
              ))}
            </select>
            <input
              className="min-w-[240px] flex-1 rounded-md border border-[var(--vigil-border)] bg-transparent px-2 py-1 text-sm"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter by title or type"
            />
            <Button
              size="sm"
              variant="default"
              tone="glass"
              onClick={() => setLayoutRevision((prev) => prev + 1)}
            >
              Reset layout
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-surface)]">
            <div className="border-b border-[var(--vigil-border)] px-4 py-2 text-xs text-[var(--vigil-muted)]">
              {scenario.summary} · {visibleNodes.length} nodes · {visibleEdges.length} edges
            </div>
            <div className="h-[72vh] min-h-[540px]">
              {visibleNodes.length === 0 ? (
                <div className="p-4 text-sm text-[var(--vigil-muted)]">No nodes match this filter.</div>
              ) : (
                <EntityGraphCanvas
                  key={`${scenario.key}:${layoutRevision}:${filter}`}
                  nodes={visibleNodes}
                  edges={visibleEdges}
                  onPick={setSelectedId}
                />
              )}
            </div>
          </section>

          <aside className="rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-surface)]">
            <div className="border-b border-[var(--vigil-border)] px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em]">Selection details</h2>
            </div>
            <div className="space-y-4 p-4 text-sm">
              {selectedNode ? (
                <>
                  <div>
                    <div className="text-xs uppercase tracking-[0.1em] text-[var(--vigil-muted)]">Node</div>
                    <p className="mt-1 font-semibold">{selectedNode.title}</p>
                    <p className="mt-1 text-xs text-[var(--vigil-muted)]">
                      {selectedNode.itemType}
                      {selectedNode.entityType ? ` · ${selectedNode.entityType}` : ""}
                    </p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.1em] text-[var(--vigil-muted)]">Connected nodes</div>
                    {selectedNeighbors.length === 0 ? (
                      <p className="mt-1 text-[var(--vigil-muted)]">No visible neighbors.</p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {selectedNeighbors.map((node) => (
                          <li key={node.id}>
                            <Button
                              size="sm"
                              variant="subtle"
                              tone="menu"
                              className="w-full justify-start truncate"
                              onClick={() => setSelectedId(node.id)}
                            >
                              {node.title}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[var(--vigil-muted)]">Click a node in the graph to inspect it.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
