"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { EntityGraphThreeCanvas } from "@/src/components/product-ui/canvas/EntityGraphThreeCanvas";
import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";
import { Button } from "@/src/components/design-system/primitives/Button";
import { ArchitecturalToolRail } from "@/src/components/foundation/ArchitecturalToolRail";
import type { CameraAction, LayoutMap } from "@/src/lib/graph-canvas-types";
import { solveStableLayoutStreamingInWorker } from "@/src/lib/entity-graph-layout-client";
import { buildEntityGraphModel } from "@/src/lib/entity-graph-model";
import { buildSyntheticScenario } from "@/src/lib/entity-graph-synthetic";
import type { GraphNode } from "@/src/lib/graph-types";

const PANEL_SCENARIO = buildSyntheticScenario("panel-main", "Main", 220, 360, 1);
const MAX_CAMERA_ZOOM = 2.2;

function computeWorldSize(nodeCount: number): { width: number; height: number } {
  const floor = 1800;
  const spread = Math.ceil(Math.sqrt(Math.max(1, nodeCount)) * 220);
  const side = Math.min(26000, Math.max(floor, spread));
  return { width: side, height: side };
}

function nextAction(key: number, type: CameraAction): { key: number; type: CameraAction } {
  return { key: key + 1, type };
}

function formatEntityLabel(node: GraphNode): string {
  if (node.entityType) return node.entityType.replaceAll("_", " ");
  return node.itemType.replaceAll(".", " ");
}

export function EntityGraphPanelLab() {
  const [layout, setLayout] = useState<LayoutMap>(new Map());
  const [layoutLoading, setLayoutLoading] = useState(false);
  const initialNodeId = PANEL_SCENARIO.nodes[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialNodeId);
  // Always holds the most recent non-null selection so recenter has a target
  // even after the user dismisses the bottom sheet.
  const lastSelectedIdRef = useRef<string | null>(initialNodeId);
  const [cameraAction, setCameraAction] = useState<{ key: number; type: CameraAction }>({
    key: 0,
    type: "frame-selection",
  });
  const [cameraZoom, setCameraZoom] = useState<number | null>(null);
  const [bottomSheetHeight, setBottomSheetHeight] = useState(0);
  const bottomSheetRef = useRef<HTMLDivElement | null>(null);
  const graphNodes = useMemo(() => PANEL_SCENARIO.nodes, []);
  const graphEdges = useMemo(() => PANEL_SCENARIO.edges, []);
  const world = useMemo(() => computeWorldSize(graphNodes.length), [graphNodes.length]);
  const graphNodeIdSet = useMemo(() => new Set(graphNodes.map((node) => node.id)), [graphNodes]);
  const model = useMemo(() => buildEntityGraphModel(graphNodes, graphEdges), [graphEdges, graphNodes]);
  const neighborIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return model.neighborIdsByNode.get(selectedId) ?? new Set<string>();
  }, [model, selectedId]);
  const activeEdgeIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return model.edgeIdsByNode.get(selectedId) ?? new Set<string>();
  }, [model, selectedId]);
  const selectedNode = useMemo(
    () => (selectedId ? graphNodes.find((node) => node.id === selectedId) ?? null : null),
    [graphNodes, selectedId],
  );
  const zoomInDisabled = cameraZoom === null || cameraZoom >= MAX_CAMERA_ZOOM - 0.01;
  const bottomPanelOcclusionPx = selectedNode ? Math.ceil(bottomSheetHeight + 14) : 0;
  const neighborPreview = useMemo(() => {
    if (!selectedNode) return [];
    return Array.from(neighborIds)
      .map((id) => graphNodes.find((node) => node.id === id) ?? null)
      .filter((node): node is GraphNode => node !== null)
      .slice(0, 4);
  }, [graphNodes, neighborIds, selectedNode]);

  // Panel crossfade — keeps the displayed content stable while fading out,
  // then swaps to the new node and fades back in.
  const [panelDisplayId, setPanelDisplayId] = useState<string | null>(selectedId);
  const [panelFading, setPanelFading] = useState(false);
  const [hoveredChipId, setHoveredChipId] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (selectedId === panelDisplayId) return;
    setPanelFading(true);
    const t = setTimeout(() => {
      setPanelDisplayId(selectedId);
      setPanelFading(false);
    }, 95);
    return () => clearTimeout(t);
  }, [selectedId, panelDisplayId]);

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

  useEffect(() => {
    if (selectedId) lastSelectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const node = bottomSheetRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setBottomSheetHeight(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <main
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background: "oklch(0.10 0 0)",
        backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 40%, oklch(0.18 0 0) 0%, oklch(0.10 0 0) 100%)",
      }}
    >
      <section
        className="relative flex h-[86vh] max-h-[920px] min-h-[560px] w-full max-w-[760px] overflow-hidden rounded-2xl"
        style={{
          minWidth: 320,
          background: "oklch(0.145 0 0)",
          border: "1px solid oklch(1 0 0 / 0.09)",
          boxShadow: "0 0 0 1px oklch(0 0 0 / 0.4), 0 24px 64px oklch(0 0 0 / 0.7), 0 8px 24px oklch(0 0 0 / 0.5)",
        }}
      >
        <div className="relative min-h-0 flex-1" data-graph-panel style={{ background: "oklch(0.145 0 0)" }}>
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
              bottomPanelOcclusionPx={bottomPanelOcclusionPx}
              onCameraZoomChange={setCameraZoom}
              onSelect={(id) => setSelectedId(id)}
              onLayoutChange={(next) => setLayout(new Map(next))}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center">
              <div className="h-1 w-24 overflow-hidden rounded-full" style={{ background: "oklch(1 0 0 / 0.08)" }}>
                {layoutLoading && (
                  <div className="h-full w-1/2 animate-pulse rounded-full" style={{ background: "var(--sys-color-accent-500)" }} />
                )}
              </div>
              <span className="text-xs" style={{ color: "oklch(0.50 0 0)" }}>
                {layoutLoading ? "Computing graph layout…" : "Graph data is unavailable."}
              </span>
            </div>
          )}

          {/* Camera controls — canonical ArchitecturalToolRail, view-only */}
          <ArchitecturalToolRail
            activeTool="select"
            onSetTool={() => {}}
            showSelectPan={false}
            showConnectionModes={false}
            showZoom
            showRecenter
            onZoomIn={() => setCameraAction((c) => nextAction(c.key, "zoom-in"))}
            onZoomOut={() => setCameraAction((c) => nextAction(c.key, "zoom-out"))}
            onRecenter={() => {
              const target = selectedId ?? lastSelectedIdRef.current;
              if (target) {
                if (!selectedId) setSelectedId(target);
                setCameraAction((c) => nextAction(c.key, "frame-selection"));
              } else {
                setCameraAction((c) => nextAction(c.key, "frame-all"));
              }
            }}
          />

          {/* Details panel — matches .threeOverlayCard vocabulary */}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20">
            <div
              ref={bottomSheetRef}
              className={`pointer-events-auto transition-transform duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] ${
                selectedNode ? "translate-y-0" : "translate-y-[calc(100%+12px)]"
              }`}
              style={{
                borderRadius: "var(--chrome-panel-radius)",
                border: "1px solid var(--ui-glass-border)",
                background: "var(--ui-glass-bg)",
                backdropFilter: "var(--chrome-glass-filter)",
                WebkitBackdropFilter: "var(--chrome-glass-filter)",
                boxShadow: "var(--chrome-glass-shadow)",
              }}
            >
              {/* Header row — all spacing via inline style to beat the * { margin:0; padding:0 } reset */}
              <div
                className="flex items-center justify-between"
                style={{
                  padding: "12px 16px 10px",
                  borderBottom: "1px solid var(--ui-glass-border)",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: "var(--sem-text-secondary)",
                  }}
                >
                  {selectedNode ? "Node Details" : "Details"}
                </span>
                {selectedNode && (
                  <ArchitecturalButton
                    size="menu"
                    tone="glass"
                    onClick={() => setSelectedId(null)}
                  >
                    Close
                  </ArchitecturalButton>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: "14px 16px 14px" }}>
                <div
                  style={{
                    opacity: panelFading ? 0 : 1,
                    transition: panelFading
                      ? "opacity 95ms ease-out"
                      : "opacity 160ms ease-in",
                  }}
                >
                {panelDisplayId && graphNodes.find((n) => n.id === panelDisplayId) ? (() => {
                  const displayNode = graphNodes.find((n) => n.id === panelDisplayId)!;
                  const displayNeighbors = Array.from(
                    model.neighborIdsByNode.get(panelDisplayId) ?? new Set<string>()
                  )
                    .map((id) => graphNodes.find((n) => n.id === id) ?? null)
                    .filter((n): n is GraphNode => n !== null)
                    .slice(0, 4);
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {/* Title + meta */}
                      <div>
                        <div
                          className="truncate"
                          style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: "var(--sem-text-primary)" }}
                        >
                          {displayNode.title}
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--sem-text-secondary)", marginTop: 6 }}>
                          {formatEntityLabel(displayNode)}
                        </div>
                      </div>

                      {/* Neighbor chips */}
                      {displayNeighbors.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {displayNeighbors.map((node) => (
                            <Button
                              key={node.id}
                              size="xs"
                              variant="subtle"
                              tone="glass"
                              title={node.title}
                              onClick={() => setSelectedId(node.id)}
                              onMouseEnter={() => setHoveredChipId(node.id)}
                              onMouseLeave={() => setHoveredChipId(null)}
                              style={{
                                maxWidth: 160,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                transform: hoveredChipId === node.id ? "translateY(-1px)" : "translateY(0)",
                                transition: "transform 100ms ease-out",
                              }}
                            >
                              {node.title}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <p style={{ fontSize: 12, lineHeight: 1.45, color: "var(--sem-text-secondary)" }}>
                    Select any node in the canvas to open contextual details.
                  </p>
                )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
