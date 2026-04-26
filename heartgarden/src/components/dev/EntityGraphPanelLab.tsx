"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Crosshair, Minus, Plus } from "@phosphor-icons/react";

import { EntityGraphThreeCanvas } from "@/src/components/product-ui/canvas/EntityGraphThreeCanvas";
import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
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
  const [selectedId, setSelectedId] = useState<string | null>(PANEL_SCENARIO.nodes[0]?.id ?? null);
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
  const selectedDegree = selectedNode ? model.degreeByNode.get(selectedNode.id) ?? 0 : 0;
  const selectionConnectionCount = activeEdgeIds.size;
  const zoomInDisabled = cameraZoom === null || cameraZoom >= MAX_CAMERA_ZOOM - 0.01;
  const bottomPanelOcclusionPx = selectedNode ? Math.ceil(bottomSheetHeight + 14) : 0;
  const neighborPreview = useMemo(() => {
    if (!selectedNode) return [];
    return Array.from(neighborIds)
      .map((id) => graphNodes.find((node) => node.id === id) ?? null)
      .filter((node): node is GraphNode => node !== null)
      .slice(0, 4);
  }, [graphNodes, neighborIds, selectedNode]);

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
        <div className="relative min-h-0 flex-1" style={{ background: "oklch(0.145 0 0)" }}>
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

          {/* Camera controls — exact .sideToolsMainPanel recipe */}
          <div
            className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-center"
            style={{
              gap: 2,
              padding: "4px 2px",
              width: "var(--chrome-tool-rail-strip-width)",
              borderRadius: "var(--chrome-panel-radius)",
              border: "1px solid var(--ui-glass-border)",
              background: "var(--ui-glass-bg)",
              backdropFilter: "var(--chrome-glass-filter)",
              WebkitBackdropFilter: "var(--chrome-glass-filter)",
              boxShadow: "var(--chrome-glass-shadow)",
            }}
          >
            <ArchitecturalTooltip content="Zoom in" side="left" delayMs={420}>
              <ArchitecturalButton
                size="icon"
                tone="glass"
                disabled={zoomInDisabled}
                aria-label="Zoom in"
                className="pointer-events-auto"
                onClick={() => setCameraAction((c) => nextAction(c.key, "zoom-in"))}
              >
                <Plus size={18} />
              </ArchitecturalButton>
            </ArchitecturalTooltip>

            <ArchitecturalTooltip content="Zoom out" side="left" delayMs={420}>
              <ArchitecturalButton
                size="icon"
                tone="glass"
                aria-label="Zoom out"
                className="pointer-events-auto"
                onClick={() => setCameraAction((c) => nextAction(c.key, "zoom-out"))}
              >
                <Minus size={18} />
              </ArchitecturalButton>
            </ArchitecturalTooltip>

            <div style={{ width: "100%", height: 1, background: "color-mix(in srgb, white 10%, transparent)" }} />

            <ArchitecturalTooltip content="Recenter on selection" side="left" delayMs={420}>
              <ArchitecturalButton
                size="icon"
                tone="glass"
                disabled={!selectedId}
                aria-label="Recenter"
                className="pointer-events-auto"
                onClick={() => setCameraAction((c) => nextAction(c.key, "frame-selection"))}
              >
                <Crosshair size={18} />
              </ArchitecturalButton>
            </ArchitecturalTooltip>
          </div>

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
                  <button
                    style={{
                      borderRadius: 999,
                      border: "1px solid var(--sem-border-subtle)",
                      background: "color-mix(in srgb, white 8%, transparent)",
                      color: "var(--sem-text-primary)",
                      fontSize: 10,
                      fontWeight: 500,
                      padding: "3px 10px",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedId(null)}
                  >
                    Close
                  </button>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: "14px 16px 14px" }}>
                {selectedNode ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Title + meta */}
                    <div>
                      <div
                        className="truncate"
                        style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: "var(--sem-text-primary)" }}
                      >
                        {selectedNode.title}
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--sem-text-secondary)", marginTop: 6 }}>
                        {formatEntityLabel(selectedNode)}
                        <span style={{ color: "var(--sem-text-muted)" }}> · degree {selectedDegree} · {selectionConnectionCount} edges</span>
                      </div>
                    </div>

                    {/* Neighbor chips — pill node vocabulary */}
                    {neighborPreview.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {neighborPreview.map((node) => (
                          <button
                            key={node.id}
                            className="truncate"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              maxWidth: 180,
                              borderRadius: 999,
                              padding: "5px 10px",
                              fontSize: 10,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.07em",
                              border: "0.5px solid color-mix(in srgb, white 28%, var(--sem-border-subtle) 72%)",
                              background: "color-mix(in srgb, white 18%, transparent)",
                              color: "var(--sem-text-primary)",
                              backdropFilter: "blur(8px)",
                              WebkitBackdropFilter: "blur(8px)",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 10px rgba(0,0,0,0.18)",
                              cursor: "pointer",
                            }}
                            title={node.title}
                            onClick={() => setSelectedId(node.id)}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                width: 6,
                                height: 6,
                                flexShrink: 0,
                                borderRadius: 999,
                                background: "var(--vigil-snap)",
                              }}
                            />
                            <span className="truncate">{node.title}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Frame action */}
                    <div style={{ borderTop: "1px solid var(--ui-glass-border)", paddingTop: 10 }}>
                      <ArchitecturalTooltip content="Frame this node in the canvas" side="top" delayMs={420}>
                        <ArchitecturalButton
                          size="menu"
                          tone="glass"
                          aria-label="Frame selection"
                          onClick={() => setCameraAction((c) => nextAction(c.key, "frame-selection"))}
                        >
                          <Crosshair size={14} />
                          Frame
                        </ArchitecturalButton>
                      </ArchitecturalTooltip>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, lineHeight: 1.45, color: "var(--sem-text-secondary)" }}>
                    Select any node in the canvas to open contextual details.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
