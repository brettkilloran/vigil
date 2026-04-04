"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";

import styles from "./ArchitecturalCanvasApp.module.css";
import { BufferedContentEditable } from "@/src/components/editing/BufferedContentEditable";
import { BufferedTextInput } from "@/src/components/editing/BufferedTextInput";
import { ArchitecturalBottomDock } from "@/src/components/foundation/ArchitecturalBottomDock";
import { ArchitecturalFocusCloseButton } from "@/src/components/foundation/ArchitecturalFocusCloseButton";
import { ArchitecturalFolderCard } from "@/src/components/foundation/ArchitecturalFolderCard";
import { ArchitecturalNodeCard } from "@/src/components/foundation/ArchitecturalNodeCard";
import { ArchitecturalStatusBar } from "@/src/components/foundation/ArchitecturalStatusBar";
import { ArchitecturalToolRail } from "@/src/components/foundation/ArchitecturalToolRail";
import { buildArchitecturalSeedGraph } from "@/src/components/foundation/architectural-seed";
import type {
  ContentTheme,
  CanvasEntity,
  CanvasGraph,
  CanvasSpace,
  CanvasTool,
  NodeTheme,
  TapeVariant,
} from "@/src/components/foundation/architectural-types";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_BUTTON_STEP = 0.2;
const WHEEL_ZOOM_SENSITIVITY = 0.0012;
const UNIFIED_NODE_WIDTH = 340;
const LAYOUT_COLUMNS = 4;
const LAYOUT_COL_GAP = 380;
const LAYOUT_ROW_GAP = 280;
const STACK_MODAL_MAX_ITEMS = 10;
const STACK_MODAL_CARD_W = 340;
const STACK_MODAL_CARD_H_ESTIMATE = 420;
const STACK_MODAL_GAP = 24;
const STACK_MODAL_PADDING = 28;
const STACK_MODAL_EJECT_MARGIN = 24;
const STACK_CLICK_SUPPRESS_DRAG_PX = 6;

type ArchitecturalCanvasScenario = "default" | "nested" | "corrupt";

const ROOT_SPACE_ID = "root";

function tapeVariantForTheme(theme: ContentTheme): TapeVariant {
  if (theme === "code") return "dark";
  return "clear";
}

function shallowCloneGraph(graph: CanvasGraph): CanvasGraph {
  return {
    ...graph,
    spaces: { ...graph.spaces },
    entities: { ...graph.entities },
  };
}

function isDescendantSpace(
  candidateId: string,
  ancestorId: string,
  spaces: Record<string, CanvasSpace>,
): boolean {
  let currentId: string | null = candidateId;
  while (currentId) {
    if (currentId === ancestorId) return true;
    currentId = spaces[currentId]?.parentSpaceId ?? null;
  }
  return false;
}

function buildPathToSpace(
  spaceId: string,
  spaces: Record<string, CanvasSpace>,
  rootSpaceId: string,
): string[] {
  if (!spaces[spaceId]) return [rootSpaceId];
  const path: string[] = [];
  let currentId: string | null = spaceId;
  while (currentId && spaces[currentId]) {
    path.unshift(currentId);
    currentId = spaces[currentId].parentSpaceId;
  }
  if (path[0] !== rootSpaceId) {
    path.unshift(rootSpaceId);
  }
  return path;
}

function isEditableTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable ||
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT"
  );
}

function buildStackModalLayout(
  itemIds: string[],
  viewport: { width: number; height: number },
  measuredHeights: Record<string, number>,
): Record<string, { x: number; y: number; scale: number }> {
  if (itemIds.length === 0) return {};
  const maxCols = Math.max(
    1,
    Math.min(4, Math.floor((viewport.width - STACK_MODAL_PADDING * 2 + STACK_MODAL_GAP) / (STACK_MODAL_CARD_W + STACK_MODAL_GAP))),
  );
  const candidates = Array.from({ length: maxCols }, (_, i) => i + 1);

  let best: {
    cols: number;
    rowHeights: number[];
    rowSizes: number[];
    totalW: number;
    totalH: number;
    scale: number;
  } | null = null;

  candidates.forEach((cols) => {
    const rowHeights: number[] = [];
    const rowSizes: number[] = [];
    for (let i = 0; i < itemIds.length; i += cols) {
      const row = itemIds.slice(i, i + cols);
      rowSizes.push(row.length);
      const h = Math.max(
        ...row.map((id) => measuredHeights[id] ?? STACK_MODAL_CARD_H_ESTIMATE),
      );
      rowHeights.push(h);
    }
    const totalW = Math.max(...rowSizes.map((size) => size * STACK_MODAL_CARD_W + (size - 1) * STACK_MODAL_GAP));
    const totalH = rowHeights.reduce((sum, h) => sum + h, 0) + STACK_MODAL_GAP * (rowHeights.length - 1);
    const scale = Math.min(
      1,
      (viewport.width - STACK_MODAL_PADDING * 2) / totalW,
      (viewport.height - STACK_MODAL_PADDING * 2) / totalH,
    );
    if (!best || scale > best.scale) {
      best = { cols, rowHeights, rowSizes, totalW, totalH, scale };
    }
  });

  if (!best) return {};
  const layout: Record<string, { x: number; y: number; scale: number }> = {};
  const scaledTotalW = best.totalW * best.scale;
  const scaledTotalH = best.totalH * best.scale;
  const offsetX = Math.max(STACK_MODAL_PADDING, (viewport.width - scaledTotalW) / 2);
  const offsetY = Math.max(STACK_MODAL_PADDING, (viewport.height - scaledTotalH) / 2);

  let rowTop = 0;
  let index = 0;
  best.rowSizes.forEach((rowSize, rowIndex) => {
    const rowWidth = rowSize * STACK_MODAL_CARD_W + (rowSize - 1) * STACK_MODAL_GAP;
    const rowLeft = (best!.totalW - rowWidth) / 2;
    for (let col = 0; col < rowSize; col += 1) {
      const id = itemIds[index++];
      if (!id) continue;
      const x = offsetX + (rowLeft + col * (STACK_MODAL_CARD_W + STACK_MODAL_GAP)) * best.scale;
      const y = offsetY + rowTop * best.scale;
      layout[id] = { x, y, scale: best.scale };
    }
    rowTop += best.rowHeights[rowIndex]! + STACK_MODAL_GAP;
  });
  return layout;
}

export function ArchitecturalCanvasApp({
  scenario = "default",
}: {
  scenario?: ArchitecturalCanvasScenario;
}) {
  const [graph, setGraph] = useState<CanvasGraph>(() =>
    buildArchitecturalSeedGraph(
      {
        taskItem: styles.taskItem,
        done: styles.done,
        taskCheckbox: styles.taskCheckbox,
        taskText: styles.taskText,
        mediaPlaceholder: styles.mediaPlaceholder,
      },
      scenario,
    ),
  );
  const [activeSpaceId, setActiveSpaceId] = useState(ROOT_SPACE_ID);
  const [navigationPath, setNavigationPath] = useState<string[]>([ROOT_SPACE_ID]);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [maxZIndex, setMaxZIndex] = useState(100);
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNodeIds, setDraggedNodeIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [spacePanning, setSpacePanning] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [lassoRectScreen, setLassoRectScreen] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const [focusOpen, setFocusOpen] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [focusTitle, setFocusTitle] = useState("");
  const [focusBody, setFocusBody] = useState("");
  const [focusCodeTheme, setFocusCodeTheme] = useState(false);
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [hoveredStackTargetId, setHoveredStackTargetId] = useState<string | null>(null);
  const [parentDropHovered, setParentDropHovered] = useState(false);
  const [stackModal, setStackModal] = useState<{
    stackId: string;
    orderedIds: string[];
    originX: number;
    originY: number;
  } | null>(null);
  const [stackModalExpanded, setStackModalExpanded] = useState(false);
  const [stackDrag, setStackDrag] = useState<{
    entityId: string;
    stackId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    pointerOffsetX: number;
    pointerOffsetY: number;
    intent: "pending" | "reorder";
  } | null>(null);
  const [stackFocusBoundsById, setStackFocusBoundsById] = useState<
    Record<string, { left: number; top: number; width: number; height: number }>
  >({});
  const [stackHoverBoundsById, setStackHoverBoundsById] = useState<
    Record<string, { left: number; top: number; width: number; height: number }>
  >({});
  const [stackModalEjectPreview, setStackModalEjectPreview] = useState(false);
  const [stackModalEjectCount, setStackModalEjectCount] = useState(0);
  const [stackModalCardHeights, setStackModalCardHeights] = useState<Record<string, number>>({});

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const parentDropRef = useRef<HTMLButtonElement | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeIdsRef = useRef<string[]>([]);
  const dragOffsetsRef = useRef<Record<string, { x: number; y: number }>>({});
  const viewRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const lassoStartRef = useRef<{ x: number; y: number } | null>(null);
  const spacePanRef = useRef(false);
  const idCounterRef = useRef(2000);
  const commitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const stackPointerDragRef = useRef<{
    stackId: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const suppressStackOpenRef = useRef<{ stackId: string; expiresAt: number } | null>(null);

  const closeStackModal = useCallback(() => {
    setStackDrag(null);
    setStackModalExpanded(false);
    setStackModal(null);
    setStackModalEjectPreview(false);
    setStackModalEjectCount(0);
    setSelectedNodeIds([]);
  }, []);

  const queueGraphCommit = useCallback(
    (key: string, applyCommit: () => void, delayMs: number) => {
      const existing = commitTimersRef.current.get(key);
      if (existing) clearTimeout(existing);
      if (delayMs <= 0) {
        commitTimersRef.current.delete(key);
        applyCommit();
        return;
      }
      const timer = setTimeout(() => {
        commitTimersRef.current.delete(key);
        applyCommit();
      }, delayMs);
      commitTimersRef.current.set(key, timer);
    },
    [],
  );

  useEffect(() => {
    return () => {
      commitTimersRef.current.forEach((timer) => clearTimeout(timer));
      commitTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!stackModal) {
      setStackModalExpanded(false);
      setStackModalCardHeights({});
      setStackModalEjectPreview(false);
      setStackModalEjectCount(0);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setStackModalExpanded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [stackModal]);

  const activeSpace = graph.spaces[activeSpaceId] ?? graph.spaces[graph.rootSpaceId];
  const visibleEntityIds = activeSpace?.entityIds ?? [];
  const visibleEntities = useMemo(
    () =>
      visibleEntityIds
        .map((id) => graph.entities[id])
        .filter((entity): entity is CanvasEntity => !!entity),
    [graph.entities, visibleEntityIds],
  );

  const parentSpaceId = activeSpace?.parentSpaceId ?? null;
  const nodeZ = useMemo(() => {
    const zMap = new Map<string, number>();
    visibleEntities.forEach((entity, index) => zMap.set(entity.id, index + 1));
    return zMap;
  }, [visibleEntities]);
  const stackGroups = useMemo(() => {
    const groups = new Map<string, CanvasEntity[]>();
    visibleEntities.forEach((entity) => {
      if (!entity.stackId) return;
      const arr = groups.get(entity.stackId) ?? [];
      arr.push(entity);
      groups.set(entity.stackId, arr);
    });
    groups.forEach((arr, key) => {
      groups.set(
        key,
        [...arr].sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0)),
      );
    });
    return groups;
  }, [visibleEntities]);
  const stackedEntityIds = useMemo(() => {
    const ids = new Set<string>();
    stackGroups.forEach((arr) => {
      if (arr.length <= 1) return;
      arr.forEach((entity) => ids.add(entity.id));
    });
    return ids;
  }, [stackGroups]);
  const standaloneEntities = useMemo(
    () =>
      visibleEntities.filter((entity) => {
        if (!entity.stackId) return true;
        const group = stackGroups.get(entity.stackId);
        return !group || group.length <= 1;
      }),
    [stackGroups, visibleEntities],
  );
  const collapsedStacks = useMemo(
    () =>
      Array.from(stackGroups.entries())
        .filter(([, arr]) => arr.length > 1)
        .map(([stackId, arr]) => ({ stackId, entities: arr, top: arr[arr.length - 1]! })),
    [stackGroups],
  );

  useEffect(() => {
    if (collapsedStacks.length === 0) {
      setStackFocusBoundsById({});
      return;
    }
    const next: Record<string, { left: number; top: number; width: number; height: number }> = {};
    collapsedStacks.forEach(({ stackId, entities }) => {
      const selected = entities.some((entity) => selectedNodeIds.includes(entity.id));
      if (!selected) return;
      const container = document.querySelector<HTMLElement>(
        `[data-stack-container='true'][data-stack-id='${stackId}']`,
      );
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const layers = Array.from(
        container.querySelectorAll<HTMLElement>("[data-stack-layer='true']"),
      );
      if (layers.length === 0) return;
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      layers.forEach((layer) => {
        const rect = layer.getBoundingClientRect();
        minX = Math.min(minX, rect.left);
        minY = Math.min(minY, rect.top);
        maxX = Math.max(maxX, rect.right);
        maxY = Math.max(maxY, rect.bottom);
      });
      const pad = 10;
      next[stackId] = {
        left: minX - containerRect.left - pad,
        top: minY - containerRect.top - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
      };
    });
    setStackFocusBoundsById(next);
  }, [collapsedStacks, graph.entities, selectedNodeIds, stackModal]);

  useEffect(() => {
    if (collapsedStacks.length === 0) {
      setStackHoverBoundsById({});
      return;
    }
    const next: Record<string, { left: number; top: number; width: number; height: number }> = {};
    collapsedStacks.forEach(({ stackId }) => {
      const container = document.querySelector<HTMLElement>(
        `[data-stack-container='true'][data-stack-id='${stackId}']`,
      );
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const layers = Array.from(
        container.querySelectorAll<HTMLElement>("[data-stack-layer='true']"),
      );
      if (layers.length === 0) return;
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      layers.forEach((layer) => {
        const rect = layer.getBoundingClientRect();
        minX = Math.min(minX, rect.left);
        minY = Math.min(minY, rect.top);
        maxX = Math.max(maxX, rect.right);
        maxY = Math.max(maxY, rect.bottom);
      });
      const pad = 10;
      next[stackId] = {
        left: minX - containerRect.left - pad,
        top: minY - containerRect.top - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
      };
    });
    setStackHoverBoundsById(next);
  }, [collapsedStacks, graph.entities, stackModal]);
  const updateNodeBody = useCallback(
    (id: string, html: string, options?: { immediate?: boolean }) => {
      queueGraphCommit(
        `content-body:${id}`,
        () => {
          setGraph((prev) => {
            const entity = prev.entities[id];
            if (!entity || entity.kind !== "content") return prev;
            if (entity.bodyHtml === html) return prev;
            return {
              ...prev,
              entities: {
                ...prev.entities,
                [id]: { ...entity, bodyHtml: html },
              },
            };
          });
        },
        options?.immediate ? 0 : 120,
      );
    },
    [queueGraphCommit],
  );

  const openFocusMode = useCallback((id: string) => {
    const entity = graph.entities[id];
    if (!entity || entity.kind !== "content") return;
    setActiveNodeId(id);
    setFocusTitle(entity.title);
    setFocusBody(entity.bodyHtml);
    setFocusCodeTheme(entity.theme === "code");
    setFocusOpen(true);
  }, [graph.entities]);

  const closeFocusMode = useCallback(() => {
    if (activeNodeId) {
      setGraph((prev) => {
        const entity = prev.entities[activeNodeId];
        if (!entity || entity.kind !== "content") return prev;
        return {
          ...prev,
          entities: {
            ...prev.entities,
            [activeNodeId]: {
              ...entity,
              title: focusTitle.trim() || "Untitled",
              bodyHtml: focusBody,
            },
          },
        };
      });
    }
    setFocusOpen(false);
    setActiveNodeId(null);
  }, [activeNodeId, focusBody, focusTitle]);

  const updateTransformFromMouse = useCallback(
    (nextScale: number, mouseX: number, mouseY: number) => {
      const cur = viewRef.current;
      const canvasX = (mouseX - cur.tx) / cur.scale;
      const canvasY = (mouseY - cur.ty) / cur.scale;
      const nextTranslateX = mouseX - canvasX * nextScale;
      const nextTranslateY = mouseY - canvasY * nextScale;
      setScale(nextScale);
      setTranslateX(nextTranslateX);
      setTranslateY(nextTranslateY);
    },
    [],
  );

  const zoomBy = useCallback(
    (delta: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const nextScale = Math.min(
        Math.max(MIN_ZOOM, viewRef.current.scale + delta),
        MAX_ZOOM,
      );
      updateTransformFromMouse(nextScale, centerX, centerY);
    },
    [updateTransformFromMouse],
  );

  const recenterToOrigin = useCallback(() => {
    setTranslateX(window.innerWidth / 2);
    setTranslateY(window.innerHeight / 2);
    setScale(1);
  }, []);

  const normalizeWheelDelta = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    // deltaMode: 0=pixel, 1=line, 2=page. Normalize to pixels for stable zoom.
    if (event.deltaMode === 1) return event.deltaY * 16;
    if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
    return event.deltaY;
  }, []);

  useEffect(() => {
    viewRef.current = { scale, tx: translateX, ty: translateY };
  }, [scale, translateX, translateY]);

  useEffect(() => {
    const freshGraph = buildArchitecturalSeedGraph(
      {
        taskItem: styles.taskItem,
        done: styles.done,
        taskCheckbox: styles.taskCheckbox,
        taskText: styles.taskText,
        mediaPlaceholder: styles.mediaPlaceholder,
      },
      scenario,
    );
    setGraph(freshGraph);
    setActiveSpaceId(freshGraph.rootSpaceId);
    setNavigationPath([freshGraph.rootSpaceId]);
    setSelectedNodeIds([]);
    setFocusOpen(false);
    setActiveNodeId(null);
  }, [scenario]);

  useEffect(() => {
    // Keep the first client render identical to server output, then center on origin.
    setTranslateX(window.innerWidth / 2);
    setTranslateY(window.innerHeight / 2);
    setViewportSize({ width: window.innerWidth, height: window.innerHeight });

    const onResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const centerCoords = useCallback(() => {
    return {
      x: (window.innerWidth / 2 - translateX) / scale,
      y: (window.innerHeight / 2 - translateY) / scale,
    };
  }, [scale, translateX, translateY]);

  const createId = useCallback((prefix: string) => {
    idCounterRef.current += 1;
    return `${prefix}-${Date.now()}-${idCounterRef.current}`;
  }, []);

  const normalizeStack = useCallback((stackId: string, snapshot: CanvasGraph): CanvasGraph => {
    if (!snapshot?.entities) return snapshot;
    const entities = Object.values(snapshot.entities)
      .filter((entity) => entity.stackId === stackId)
      .sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0));
    if (entities.length === 0) return snapshot;
    const next = shallowCloneGraph(snapshot);
    entities.forEach((entity, index) => {
      next.entities[entity.id] = {
        ...next.entities[entity.id],
        stackOrder: index,
      };
    });
    return next;
  }, []);

  const stackSelectedContent = useCallback(() => {
    const ids = selectedNodeIds.filter((id) => {
      const entity = graph.entities[id];
      return !!entity && entity.kind === "content" && visibleEntityIds.includes(id);
    });
    if (ids.length < 2) return;
    const stackId = createId("stack");
    setGraph((prev) => {
      const next = shallowCloneGraph(prev);
      ids.forEach((id, index) => {
        const entity = next.entities[id];
        if (!entity || entity.kind !== "content") return;
        next.entities[id] = {
          ...entity,
          stackId,
          stackOrder: index,
        };
      });
      return next;
    });
    setSelectedNodeIds(ids);
  }, [createId, graph.entities, selectedNodeIds, visibleEntityIds]);

  const unstackGroup = useCallback((stackId: string) => {
    setGraph((prev) => {
      let changed = false;
      const next = shallowCloneGraph(prev);
      Object.values(next.entities).forEach((entity) => {
        if (entity.stackId !== stackId) return;
        changed = true;
        next.entities[entity.id] = {
          ...entity,
          stackId: null,
          stackOrder: null,
        };
      });
      return changed ? next : prev;
    });
  }, []);

  const ensureFolderChildSpace = useCallback(
    (folderId: string): string | null => {
      let resolved: string | null = null;
      setGraph((prev) => {
        const folder = prev.entities[folderId];
        if (!folder || folder.kind !== "folder") return prev;
        if (prev.spaces[folder.childSpaceId]) {
          resolved = folder.childSpaceId;
          return prev;
        }

        const next = shallowCloneGraph(prev);
        const newSpaceId = createId("space");
        const parentSpaceId =
          next.spaces[activeSpaceId]?.id ?? next.rootSpaceId;
        next.spaces[newSpaceId] = {
          id: newSpaceId,
          name: folder.title || "Untitled Folder",
          parentSpaceId,
          entityIds: [],
        };
        next.entities[folderId] = { ...folder, childSpaceId: newSpaceId };
        resolved = newSpaceId;
        return next;
      });
      return resolved;
    },
    [activeSpaceId, createId],
  );

  const canMoveEntityToSpace = useCallback(
    (entityId: string, destinationSpaceId: string, snapshot: CanvasGraph = graph) => {
      const entity = snapshot.entities[entityId];
      const destinationSpace = snapshot.spaces[destinationSpaceId];
      if (!entity || !destinationSpace) return false;
      if (entity.kind === "folder") {
        // A folder cannot be moved into itself or any of its descendants.
        if (isDescendantSpace(destinationSpaceId, entity.childSpaceId, snapshot.spaces)) {
          return false;
        }
      }
      return true;
    },
    [graph],
  );

  const moveEntitiesToSpace = useCallback(
    (
      entityIds: string[],
      destinationSpaceId: string,
      options?: { anchor?: { x: number; y: number }; forceLayout?: boolean },
    ) => {
      setGraph((prev) => {
        const targetSpace = prev.spaces[destinationSpaceId];
        if (!targetSpace) return prev;

        const idsToMove = entityIds.filter(
          (id, index) =>
            entityIds.indexOf(id) === index &&
            !!prev.entities[id] &&
            canMoveEntityToSpace(id, destinationSpaceId, prev),
        );
        if (idsToMove.length === 0) return prev;

        const next = shallowCloneGraph(prev);
        const movedSet = new Set(idsToMove);

        Object.values(next.spaces).forEach((space) => {
          if (space.entityIds.some((id) => movedSet.has(id))) {
            next.spaces[space.id] = {
              ...space,
              entityIds: space.entityIds.filter((id) => !movedSet.has(id)),
            };
          }
        });

        const remainingDestinationIds = next.spaces[destinationSpaceId].entityIds;
        next.spaces[destinationSpaceId] = {
          ...next.spaces[destinationSpaceId],
          entityIds: [...remainingDestinationIds, ...idsToMove],
        };

        const anchor = options?.anchor ?? { x: 0, y: 0 };
        const shouldForceLayout = options?.forceLayout ?? false;
        const occupied = new Set<string>();

        remainingDestinationIds.forEach((id) => {
          const entity = next.entities[id];
          const slot = entity?.slots[destinationSpaceId];
          if (!slot) return;
          const col = Math.round((slot.x - anchor.x) / LAYOUT_COL_GAP);
          const row = Math.round((slot.y - anchor.y) / LAYOUT_ROW_GAP);
          occupied.add(`${col}:${row}`);
        });

        const findNextSlot = (index: number) => {
          let attempt = index;
          while (attempt < index + 5000) {
            const col = attempt % LAYOUT_COLUMNS;
            const row = Math.floor(attempt / LAYOUT_COLUMNS);
            const key = `${col}:${row}`;
            if (!occupied.has(key)) {
              occupied.add(key);
              return {
                x: anchor.x + col * LAYOUT_COL_GAP,
                y: anchor.y + row * LAYOUT_ROW_GAP,
              };
            }
            attempt += 1;
          }
          return {
            x: anchor.x + index * 28,
            y: anchor.y + index * 20,
          };
        };

        idsToMove.forEach((entityId, index) => {
          const entity = next.entities[entityId];
          if (!entity) return;
          const existingSlot = entity.slots[destinationSpaceId];
          const destinationSlot =
            shouldForceLayout || !existingSlot ? findNextSlot(index) : existingSlot;
          next.entities[entityId] = {
            ...entity,
            slots: {
              ...entity.slots,
              [destinationSpaceId]: destinationSlot,
            },
          };
        });

        return next;
      });
    },
    [canMoveEntityToSpace],
  );

  const enterSpace = useCallback(
    (spaceId: string) => {
      if (!graph.spaces[spaceId] || spaceId === activeSpaceId) return;
      setActiveSpaceId(spaceId);
      setNavigationPath(buildPathToSpace(spaceId, graph.spaces, graph.rootSpaceId));
      setSelectedNodeIds([]);
      recenterToOrigin();
    },
    [activeSpaceId, graph.rootSpaceId, graph.spaces, recenterToOrigin],
  );

  const openFolder = useCallback(
    (folderId: string) => {
      const folder = graph.entities[folderId];
      if (!folder || folder.kind !== "folder") return;
      const childSpaceId = graph.spaces[folder.childSpaceId]
        ? folder.childSpaceId
        : ensureFolderChildSpace(folderId);
      if (!childSpaceId) return;
      enterSpace(childSpaceId);
    },
    [enterSpace, ensureFolderChildSpace, graph.entities, graph.spaces],
  );

  const goBack = useCallback(() => {
    if (!parentSpaceId) return;
    enterSpace(parentSpaceId);
  }, [enterSpace, parentSpaceId]);

  const getParentFolderExitSlot = useCallback(
    (offsetIndex = 0) => {
      if (!parentSpaceId) return null;
      const parentSpace = graph.spaces[parentSpaceId];
      if (!parentSpace) return null;
      const ownerFolderId = parentSpace.entityIds.find((entityId) => {
        const entity = graph.entities[entityId];
        return entity?.kind === "folder" && entity.childSpaceId === activeSpaceId;
      });
      if (!ownerFolderId) return null;
      const ownerFolder = graph.entities[ownerFolderId];
      if (!ownerFolder || ownerFolder.kind !== "folder") return null;
      const ownerSlot = ownerFolder.slots[parentSpaceId];
      if (!ownerSlot) return null;
      return {
        x: ownerSlot.x + offsetIndex * 28,
        y: ownerSlot.y + 260 + offsetIndex * 18,
      };
    },
    [activeSpaceId, graph.entities, graph.spaces, parentSpaceId],
  );

  const renameFolder = useCallback(
    (entityId: string, title: string) => {
      queueGraphCommit(
        `folder-title:${entityId}`,
        () => {
          setGraph((prev) => {
            const entity = prev.entities[entityId];
            if (!entity || entity.kind !== "folder") return prev;
            const next = shallowCloneGraph(prev);
            const nextTitle = title.trim() || "Untitled Folder";
            if (entity.title === nextTitle) return prev;
            next.entities[entityId] = {
              ...entity,
              title: nextTitle,
            };
            if (next.spaces[entity.childSpaceId]) {
              next.spaces[entity.childSpaceId] = {
                ...next.spaces[entity.childSpaceId],
                name: nextTitle,
              };
            }
            return next;
          });
        },
        120,
      );
    },
    [queueGraphCommit],
  );

  const createNewNode = useCallback((type: NodeTheme) => {
    const center = centerCoords();
    const x = center.x - 170 + (Math.random() * 60 - 30);
    const y = center.y - 100 + (Math.random() * 60 - 30);
    const rotation = (Math.random() - 0.5) * 4;
    const tapeRotation = (Math.random() - 0.5) * 6;
    setMaxZIndex((prev) => prev + 1);

    if (type === "folder") {
      const entityId = createId("folder");
      const childSpaceId = createId("space");
      setGraph((prev) => {
        const next = shallowCloneGraph(prev);
        next.spaces[childSpaceId] = {
          id: childSpaceId,
          name: "New Folder",
          parentSpaceId: activeSpaceId,
          entityIds: [],
        };
        next.entities[entityId] = {
          id: entityId,
          title: "New Folder",
          kind: "folder",
          theme: "folder",
          childSpaceId,
          rotation,
          width: UNIFIED_NODE_WIDTH,
          tapeRotation: 0,
          stackId: null,
          stackOrder: null,
          slots: {
            [activeSpaceId]: { x, y },
          },
        };
        const activeSpace = next.spaces[activeSpaceId];
        if (activeSpace) {
          next.spaces[activeSpaceId] = {
            ...activeSpace,
            entityIds: [...activeSpace.entityIds, entityId],
          };
        }
        return next;
      });
      return;
    }

    const id = createId("node");
    let title = "New Note";
    let width = UNIFIED_NODE_WIDTH;
    let bodyHtml = `<div contenteditable="true">Start typing...</div>`;

    if (type === "task") {
      title = "Checklist";
      bodyHtml = `
        <div class="${styles.taskItem}">
          <div class="${styles.taskCheckbox}"></div>
          <div class="${styles.taskText}" contenteditable="true">New task</div>
        </div>
      `;
    } else if (type === "code") {
      title = "Snippet";
      bodyHtml = `// write code here`;
    } else if (type === "media") {
      title = "Asset";
      bodyHtml = `
        <div class="${styles.mediaPlaceholder}">
          <span>Image Placeholder</span>
        </div>
        <div contenteditable="true" style="font-size: 13px; color: var(--sys-color-neutral-700);">Caption...</div>
      `;
    }

    const nextNode = {
      id,
      title,
      kind: "content" as const,
      rotation,
      width,
      theme: type,
      tapeVariant: tapeVariantForTheme(type),
      tapeRotation,
      bodyHtml,
      stackId: null,
      stackOrder: null,
      slots: {
        [activeSpaceId]: { x, y },
      },
    };
    setGraph((prev) => {
      const next = shallowCloneGraph(prev);
      next.entities[id] = nextNode;
      const space = next.spaces[activeSpaceId];
      if (space) {
        next.spaces[activeSpaceId] = {
          ...space,
          entityIds: [...space.entityIds, id],
        };
      }
      return next;
    });
  }, [activeSpaceId, centerCoords, createId]);

  const updateDropTargets = useCallback(
    (draggedEntityId: string) => {
      const draggedGroup =
        draggedNodeIdsRef.current.length > 0 ? draggedNodeIdsRef.current : [draggedEntityId];
      const draggedEntity = graph.entities[draggedEntityId];
      const sharedStackId =
        draggedEntity?.stackId &&
        draggedGroup.every((id) => graph.entities[id]?.stackId === draggedEntity.stackId)
          ? draggedEntity.stackId
          : null;
      const draggedEl = sharedStackId
        ? document.querySelector<HTMLElement>(`[data-stack-container='true'][data-stack-id='${sharedStackId}']`)
        : document.querySelector<HTMLElement>(`[data-node-id="${draggedEntityId}"]`);
      let dragRect: DOMRect | null = draggedEl?.getBoundingClientRect() ?? null;
      if (!dragRect) {
        const rects = draggedGroup
          .map((id) => document.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.getBoundingClientRect())
          .filter((rect): rect is DOMRect => !!rect);
        if (rects.length > 0) {
          const left = Math.min(...rects.map((r) => r.left));
          const top = Math.min(...rects.map((r) => r.top));
          const right = Math.max(...rects.map((r) => r.right));
          const bottom = Math.max(...rects.map((r) => r.bottom));
          dragRect = {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top,
            x: left,
            y: top,
            toJSON: () => ({}),
          } as DOMRect;
        }
      }
      if (!dragRect) return;
      const centerX = dragRect.left + dragRect.width / 2;
      const centerY = dragRect.top + dragRect.height / 2;

      let nextFolderId: string | null = null;
      Array.from(document.querySelectorAll<HTMLElement>("[data-folder-drop='true']")).forEach(
        (folderEl) => {
          const folderId = folderEl.dataset.folderId;
          if (!folderId || folderId === draggedEntityId) return;
          const folderEntity = graph.entities[folderId];
          if (!folderEntity || folderEntity.kind !== "folder") return;
          const rect = folderEl.getBoundingClientRect();
          const inside =
            centerX > rect.left &&
            centerX < rect.right &&
            centerY > rect.top &&
            centerY < rect.bottom;
          if (!inside) return;
          const destinationId = graph.spaces[folderEntity.childSpaceId]
            ? folderEntity.childSpaceId
            : folderEntity.childSpaceId;
          if (!draggedGroup.every((id) => canMoveEntityToSpace(id, destinationId))) return;
          nextFolderId = folderId;
        },
      );
      setHoveredFolderId(nextFolderId);

      let nextStackTargetId: string | null = null;
      const canDragGroupStack = draggedGroup.every((id) => graph.entities[id]?.kind === "content");
      if (!nextFolderId && canDragGroupStack) {
        Array.from(document.querySelectorAll<HTMLElement>("[data-stack-target]")).forEach(
          (targetEl) => {
            const targetId = targetEl.dataset.nodeId ?? targetEl.dataset.stackTopId;
            if (!targetId || draggedGroup.includes(targetId)) return;
            const targetEntity = graph.entities[targetId];
            if (!targetEntity || targetEntity.kind !== "content") return;
            let rect = targetEl.getBoundingClientRect();
            if (targetEl.dataset.stackTopId) {
              // Use the visual stack layer hull instead of container box to keep
              // stack-hit testing aligned with what users see.
              const layers = Array.from(
                targetEl.querySelectorAll<HTMLElement>("[data-stack-layer='true']"),
              );
              if (layers.length > 0) {
                let minX = Number.POSITIVE_INFINITY;
                let minY = Number.POSITIVE_INFINITY;
                let maxX = Number.NEGATIVE_INFINITY;
                let maxY = Number.NEGATIVE_INFINITY;
                layers.forEach((layer) => {
                  const layerRect = layer.getBoundingClientRect();
                  minX = Math.min(minX, layerRect.left);
                  minY = Math.min(minY, layerRect.top);
                  maxX = Math.max(maxX, layerRect.right);
                  maxY = Math.max(maxY, layerRect.bottom);
                });
                if (
                  Number.isFinite(minX) &&
                  Number.isFinite(minY) &&
                  Number.isFinite(maxX) &&
                  Number.isFinite(maxY)
                ) {
                  const pad = 10;
                  rect = {
                    left: minX - pad,
                    top: minY - pad,
                    right: maxX + pad,
                    bottom: maxY + pad,
                    width: maxX - minX + pad * 2,
                    height: maxY - minY + pad * 2,
                    x: minX - pad,
                    y: minY - pad,
                    toJSON: () => ({}),
                  } as DOMRect;
                }
              }
            }
            const inside =
              centerX > rect.left &&
              centerX < rect.right &&
              centerY > rect.top &&
              centerY < rect.bottom;
            if (!inside) return;
            nextStackTargetId = targetId;
          },
        );
      }
      setHoveredStackTargetId(nextStackTargetId);

      const parentTarget = parentDropRef.current;
      const canDropToParent =
        !!parentSpaceId && draggedGroup.every((id) => canMoveEntityToSpace(id, parentSpaceId));
      if (!parentTarget || !canDropToParent) {
        setParentDropHovered(false);
        return;
      }
      const rect = parentTarget.getBoundingClientRect();
      setParentDropHovered(
        centerX > rect.left &&
          centerX < rect.right &&
          centerY > rect.top &&
          centerY < rect.bottom,
      );
    },
    [canMoveEntityToSpace, graph.entities, graph.spaces, parentSpaceId],
  );

  const stackEntitiesOntoTarget = useCallback(
    (draggedEntityIds: string[], targetEntityId: string) => {
      const target = graph.entities[targetEntityId];
      if (!target || target.kind !== "content") return false;
      const idsToStack = draggedEntityIds.filter((id, index) => {
        if (draggedEntityIds.indexOf(id) !== index) return false;
        if (id === targetEntityId) return false;
        const entity = graph.entities[id];
        return !!entity && entity.kind === "content";
      });
      if (idsToStack.length === 0) return false;

      const stackId = target.stackId ?? createId("stack");
      setGraph((prev) => {
        let next = shallowCloneGraph(prev);
        const normalizedOldStackIds = new Set<string>();

        if (!next.entities[targetEntityId]) return prev;
        const targetEntity = next.entities[targetEntityId];
        if (!targetEntity || targetEntity.kind !== "content") return prev;
        if (!targetEntity.stackId) {
          next.entities[targetEntityId] = {
            ...targetEntity,
            stackId,
            stackOrder: 0,
          };
        }

        const existing = Object.values(next.entities)
          .filter((entity) => entity.stackId === stackId)
          .sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0));
        let nextOrder = existing.length;

        idsToStack.forEach((id) => {
          const entity = next.entities[id];
          if (!entity || entity.kind !== "content") return;
          if (entity.stackId && entity.stackId !== stackId) {
            normalizedOldStackIds.add(entity.stackId);
          }
          next.entities[id] = {
            ...entity,
            stackId,
            stackOrder: nextOrder,
          };
          nextOrder += 1;
        });

        next = normalizeStack(stackId, next);
        normalizedOldStackIds.forEach((oldStackId) => {
          next = normalizeStack(oldStackId, next);
        });
        return next;
      });
      setSelectedNodeIds([targetEntityId, ...idsToStack]);
      return true;
    },
    [createId, graph.entities, normalizeStack],
  );

  const handleDrop = useCallback(
    (draggedEntityIds: string[]) => {
      if (draggedEntityIds.length === 0) return;
      const center = centerCoords();
      const fallback = { x: center.x - 180, y: center.y - 120 };

      if (parentDropHovered && parentSpaceId) {
        const anchorBelowFolder = getParentFolderExitSlot(0) ?? fallback;
        moveEntitiesToSpace(draggedEntityIds, parentSpaceId, {
          anchor: anchorBelowFolder,
          forceLayout: true,
        });
        return;
      }

      if (hoveredFolderId) {
        const folderEntity = graph.entities[hoveredFolderId];
        if (folderEntity && folderEntity.kind === "folder") {
          const childSpaceId = graph.spaces[folderEntity.childSpaceId]
            ? folderEntity.childSpaceId
            : ensureFolderChildSpace(hoveredFolderId);
          if (childSpaceId) {
            moveEntitiesToSpace(draggedEntityIds, childSpaceId, {
              anchor: fallback,
              forceLayout: true,
            });
            return;
          }
        }
      }

      if (hoveredStackTargetId) {
        stackEntitiesOntoTarget(draggedEntityIds, hoveredStackTargetId);
      }
    },
    [
      centerCoords,
      ensureFolderChildSpace,
      getParentFolderExitSlot,
      graph.entities,
      graph.spaces,
      hoveredFolderId,
      hoveredStackTargetId,
      moveEntitiesToSpace,
      parentDropHovered,
      parentSpaceId,
      stackEntitiesOntoTarget,
    ],
  );

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (lassoStartRef.current) {
        const start = lassoStartRef.current;
        setLassoRectScreen({
          x1: start.x,
          y1: start.y,
          x2: event.clientX,
          y2: event.clientY,
        });
        return;
      }

      if (isPanningRef.current) {
        setTranslateX(event.clientX - panStartRef.current.x);
        setTranslateY(event.clientY - panStartRef.current.y);
      }

      const draggedIds = draggedNodeIdsRef.current;
      if (draggedIds.length === 0) return;
      const stackPointerDrag = stackPointerDragRef.current;
      if (stackPointerDrag && !stackPointerDrag.moved) {
        const moved =
          Math.hypot(event.clientX - stackPointerDrag.startX, event.clientY - stackPointerDrag.startY) >
          STACK_CLICK_SUPPRESS_DRAG_PX;
        if (moved) {
          stackPointerDragRef.current = { ...stackPointerDrag, moved: true };
        }
      }
      const mouseCanvasX = (event.clientX - translateX) / scale;
      const mouseCanvasY = (event.clientY - translateY) / scale;
      setGraph((prev) => {
        const nextEntities = { ...prev.entities };
        let changed = false;
        draggedIds.forEach((id) => {
          const entity = prev.entities[id];
          const offset = dragOffsetsRef.current[id];
          if (!entity || !offset) return;
          changed = true;
          nextEntities[id] = {
            ...entity,
            slots: {
              ...entity.slots,
              [activeSpaceId]: {
                x: mouseCanvasX - offset.x,
                y: mouseCanvasY - offset.y,
              },
            },
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          entities: nextEntities,
        };
      });
      updateDropTargets(draggedIds[0]);
    };

    const onMouseUp = () => {
      if (lassoStartRef.current) {
        const rect = lassoRectScreen;
        lassoStartRef.current = null;
        setLassoRectScreen(null);

        if (rect) {
          const minX = Math.min(rect.x1, rect.x2);
          const maxX = Math.max(rect.x1, rect.x2);
          const minY = Math.min(rect.y1, rect.y2);
          const maxY = Math.max(rect.y1, rect.y2);
          const isClick = Math.abs(maxX - minX) < 3 && Math.abs(maxY - minY) < 3;

          if (isClick) {
            setSelectedNodeIds([]);
          } else {
            const selected = Array.from(
              document.querySelectorAll<HTMLElement>("[data-node-id]"),
            )
              .filter((el) => {
                const r = el.getBoundingClientRect();
                return !(r.right < minX || r.left > maxX || r.bottom < minY || r.top > maxY);
              })
              .map((el) => el.dataset.nodeId)
              .filter((id): id is string => !!id);
            setSelectedNodeIds(selected);
          }
        }
      }

      isPanningRef.current = false;
      setIsPanning(false);
      if (draggedNodeIdsRef.current.length > 0) {
        handleDrop(draggedNodeIdsRef.current);
      }
      const stackPointerDrag = stackPointerDragRef.current;
      if (stackPointerDrag?.moved) {
        suppressStackOpenRef.current = {
          stackId: stackPointerDrag.stackId,
          expiresAt: Date.now() + 450,
        };
      }
      stackPointerDragRef.current = null;
      draggedNodeIdsRef.current = [];
      dragOffsetsRef.current = {};
      setDraggedNodeIds([]);
      setHoveredFolderId(null);
      setHoveredStackTargetId(null);
      setParentDropHovered(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [activeSpaceId, handleDrop, lassoRectScreen, scale, translateX, translateY, updateDropTargets]);

  useEffect(() => {
    if (!stackDrag || !stackModal) return;
    const getVisibleOrdered = (orderedIds: string[]) => orderedIds.slice(0, STACK_MODAL_MAX_ITEMS);
    const getHullBounds = (orderedIds: string[]) => {
      const layout = buildStackModalLayout(orderedIds, viewportSize, stackModalCardHeights);
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      orderedIds.forEach((id) => {
        const slot = layout[id];
        if (!slot) return;
        const cardW = STACK_MODAL_CARD_W * slot.scale;
        const cardH = (stackModalCardHeights[id] ?? STACK_MODAL_CARD_H_ESTIMATE) * slot.scale;
        minX = Math.min(minX, slot.x);
        minY = Math.min(minY, slot.y);
        maxX = Math.max(maxX, slot.x + cardW);
        maxY = Math.max(maxY, slot.y + cardH);
      });
      if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
      return { left: minX, top: minY, right: maxX, bottom: maxY };
    };
    const getDraggedRect = (
      drag: {
        entityId: string;
        currentX: number;
        currentY: number;
        pointerOffsetX: number;
        pointerOffsetY: number;
      },
      orderedIds: string[],
    ) => {
      const layout = buildStackModalLayout(orderedIds, viewportSize, stackModalCardHeights);
      const slot = layout[drag.entityId];
      const scale = slot?.scale ?? 1;
      const width = STACK_MODAL_CARD_W * scale;
      const height = (stackModalCardHeights[drag.entityId] ?? STACK_MODAL_CARD_H_ESTIMATE) * scale;
      const left = drag.currentX - drag.pointerOffsetX;
      const top = drag.currentY - drag.pointerOffsetY;
      return { left, top, right: left + width, bottom: top + height };
    };
    const isDraggedOutsideHull = (
      drag: {
        entityId: string;
        currentX: number;
        currentY: number;
        pointerOffsetX: number;
        pointerOffsetY: number;
      },
      orderedIds: string[],
    ) => {
      const hull = getHullBounds(orderedIds);
      if (!hull) return false;
      const rect = getDraggedRect(drag, orderedIds);
      const centerX = (rect.left + rect.right) / 2;
      const centerY = (rect.top + rect.bottom) / 2;
      return (
        centerX < hull.left - STACK_MODAL_EJECT_MARGIN ||
        centerX > hull.right + STACK_MODAL_EJECT_MARGIN ||
        centerY < hull.top - STACK_MODAL_EJECT_MARGIN ||
        centerY > hull.bottom + STACK_MODAL_EJECT_MARGIN
      );
    };
    const onMouseMove = (event: MouseEvent) => {
      setStackDrag((prev) => {
        if (!prev) return prev;
        const dx = event.clientX - prev.startX;
        const dy = event.clientY - prev.startY;
        const intent = Math.abs(dx) > 10 || Math.abs(dy) > 10 ? "reorder" : prev.intent;
        const visibleOrdered = getVisibleOrdered(stackModal.orderedIds);
        const outsideWithMargin = isDraggedOutsideHull(
          {
            entityId: prev.entityId,
            currentX: event.clientX,
            currentY: event.clientY,
            pointerOffsetX: prev.pointerOffsetX,
            pointerOffsetY: prev.pointerOffsetY,
          },
          visibleOrdered,
        );
        setStackModalEjectPreview(outsideWithMargin && intent === "reorder");
        if (intent === "reorder" && !outsideWithMargin) {
          setStackModal((prevModal) => {
            if (!prevModal) return prevModal;
            const visibleOrdered = [...getVisibleOrdered(prevModal.orderedIds)];
            const from = visibleOrdered.indexOf(prev.entityId);
            if (from < 0) return prevModal;
            const layout = buildStackModalLayout(visibleOrdered, viewportSize, stackModalCardHeights);
            const swapWith = visibleOrdered.findIndex((id) => {
              if (id === prev.entityId) return false;
              const slot = layout[id];
              if (!slot) return false;
              const width = STACK_MODAL_CARD_W * slot.scale;
              const height = (stackModalCardHeights[id] ?? STACK_MODAL_CARD_H_ESTIMATE) * slot.scale;
              return (
                event.clientX >= slot.x &&
                event.clientX <= slot.x + width &&
                event.clientY >= slot.y &&
                event.clientY <= slot.y + height
              );
            });
            if (swapWith < 0 || swapWith === from) return prevModal;
            const nextVisible = [...visibleOrdered];
            const current = nextVisible[from];
            nextVisible[from] = nextVisible[swapWith];
            nextVisible[swapWith] = current;
            const hiddenOrdered = prevModal.orderedIds.slice(STACK_MODAL_MAX_ITEMS);
            return {
              ...prevModal,
              orderedIds: [...nextVisible, ...hiddenOrdered],
            };
          });
        }
        return {
          ...prev,
          currentX: event.clientX,
          currentY: event.clientY,
          intent,
        };
      });
    };
    const onMouseUp = () => {
      const drag = stackDrag;
      setStackDrag(null);
      setStackModalEjectPreview(false);
      if (!drag) return;
      const outsideWithMargin = isDraggedOutsideHull(
        {
          entityId: drag.entityId,
          currentX: drag.currentX,
          currentY: drag.currentY,
          pointerOffsetX: drag.pointerOffsetX,
          pointerOffsetY: drag.pointerOffsetY,
        },
        getVisibleOrdered(stackModal.orderedIds),
      );
      if (outsideWithMargin && drag.intent === "reorder") {
        const extracted = graph.entities[drag.entityId];
        if (extracted) {
          const remainingOrdered = stackModal.orderedIds.filter((id) => id !== drag.entityId);
          const remaining = remainingOrdered
            .map((id) => graph.entities[id])
            .filter(
              (entity): entity is CanvasEntity =>
                !!entity && entity.kind === "content" && entity.stackId === stackModal.stackId,
            );
          if (remaining.length >= 2) {
            const normalizedRemaining = [...remaining]
              .sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0))
              .map((entity, index) => ({
                ...entity,
                stackId: stackModal.stackId,
                stackOrder: index,
              }));
            setGraph((prev) => {
              const next = shallowCloneGraph(prev);
              normalizedRemaining.forEach((entity) => {
                const current = next.entities[entity.id];
                if (!current) return;
                next.entities[entity.id] = {
                  ...current,
                  stackId: entity.stackId,
                  stackOrder: entity.stackOrder,
                };
              });
              const pulled = next.entities[drag.entityId];
              if (pulled && extracted.kind === "content") {
                next.entities[drag.entityId] = {
                  ...pulled,
                  stackId: null,
                  stackOrder: null,
                  zIndex: maxZIndex + 1,
                };
              }
              return next;
            });
            setMaxZIndex((z) => z + 1);
            setStackModal((prev) =>
              prev ? { ...prev, orderedIds: normalizedRemaining.map((entity) => entity.id) } : prev,
            );
          } else {
            setGraph((prev) => {
              const next = shallowCloneGraph(prev);
              const pulled = next.entities[drag.entityId];
              if (pulled) {
                next.entities[drag.entityId] = {
                  ...pulled,
                  stackId: null,
                  stackOrder: null,
                  zIndex: maxZIndex + 1,
                };
              }
              remaining.forEach((entity) => {
                const current = next.entities[entity.id];
                if (!current) return;
                next.entities[entity.id] = {
                  ...current,
                  stackId: null,
                  stackOrder: null,
                };
              });
              return next;
            });
            setMaxZIndex((z) => z + 1);
            closeStackModal();
          }
          setStackModalEjectCount((count) => count + 1);
          const worldDropX = (drag.currentX - translateX) / scale;
          const worldDropY = (drag.currentY - translateY) / scale;
          setGraph((prev) => {
            const next = shallowCloneGraph(prev);
            const entity = next.entities[drag.entityId];
            if (!entity) return prev;
            next.entities[drag.entityId] = {
              ...entity,
              slots: {
                ...entity.slots,
                [activeSpaceId]: {
                  x: Math.round(worldDropX),
                  y: Math.round(worldDropY),
                },
              },
            };
            return next;
          });
        }
        return;
      }
      if (drag.intent === "reorder") {
        const ordered = stackModal.orderedIds;
        setGraph((prev) => {
          const next = shallowCloneGraph(prev);
          ordered.forEach((id, index) => {
            const entity = next.entities[id];
            if (!entity) return;
            next.entities[id] = {
              ...entity,
              stackOrder: index,
            };
          });
          return next;
        });
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    closeStackModal,
    activeSpaceId,
    graph.entities,
    normalizeStack,
    scale,
    stackDrag,
    stackModalCardHeights,
    stackModal,
    translateX,
    translateY,
    viewportSize,
    maxZIndex,
  ]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (focusOpen) return;
      if (activeTool === "pan" || spacePanRef.current) return;
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest("[data-stack-container='true']")) return;
      const entity = target.closest<HTMLElement>(`[data-node-id]`);
      const inContent =
        target.closest(`.${styles.nodeBody}`) ||
        target.closest(`.${styles.nodeBtn}`) ||
        target.closest(`.${styles.folderTitleInput}`) ||
        target.closest(`.${styles.folderOpenBtn}`);

      if (entity && !inContent) {
        const nodeId = entity.dataset.nodeId;
        if (nodeId) {
          if (event.shiftKey) {
            setSelectedNodeIds((prev) =>
              prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
            );
            return;
          } else {
            const dragGroup =
              selectedNodeIds.includes(nodeId) && selectedNodeIds.length > 1
                ? [
                    nodeId,
                    ...selectedNodeIds.filter(
                      (id) => id !== nodeId && visibleEntityIds.includes(id),
                    ),
                  ]
                : [nodeId];
            setSelectedNodeIds(dragGroup);
            draggedNodeIdsRef.current = dragGroup;
            setDraggedNodeIds(dragGroup);

            const mouseCanvasX = (event.clientX - translateX) / scale;
            const mouseCanvasY = (event.clientY - translateY) / scale;
            const offsets: Record<string, { x: number; y: number }> = {};
            dragGroup.forEach((id) => {
              const dragEntity = graph.entities[id];
              const slot = dragEntity?.slots[activeSpaceId];
              if (!slot) return;
              offsets[id] = {
                x: mouseCanvasX - slot.x,
                y: mouseCanvasY - slot.y,
              };
            });
            dragOffsetsRef.current = offsets;
            setMaxZIndex((prev) => prev + 1);
          }
        }
      }

      const taskCheckbox = target.closest(`.${styles.taskCheckbox}`);
      if (taskCheckbox) {
        const taskItem = taskCheckbox.closest(`.${styles.taskItem}`);
        if (taskItem) {
          taskItem.classList.toggle(styles.done);
          const owner = taskCheckbox.closest<HTMLElement>(`[data-node-id]`);
          if (owner?.dataset.nodeId) {
            const bodyEl = owner.querySelector<HTMLElement>(`.${styles.nodeBody}`);
            if (bodyEl) updateNodeBody(owner.dataset.nodeId, bodyEl.innerHTML, { immediate: true });
          }
        }
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const expandBtn = target.closest<HTMLElement>(`[data-expand-btn="true"]`);
      if (!expandBtn) return;
      const entity = expandBtn.closest<HTMLElement>(`[data-node-id]`);
      const id = entity?.dataset.nodeId;
      if (id) openFocusMode(id);
    };

    const onDoubleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const folderEl = target.closest<HTMLElement>("[data-folder-id]");
      if (folderEl && !target.closest(`.${styles.folderTitleInput}`)) {
        const folderId = folderEl.dataset.folderId;
        if (folderId) {
          openFolder(folderId);
          return;
        }
      }
      const entity = target.closest<HTMLElement>(`[data-node-id]`);
      const id = entity?.dataset.nodeId;
      if (!id) return;

      const editableWithinNode =
        isEditableTarget(target) ||
        !!target.closest("input, textarea, select, [contenteditable='true']");
      if (editableWithinNode) {
        const node = graph.entities[id];
        if (node?.kind === "content") {
          openFocusMode(id);
        }
        return;
      }

      const header = target.closest(`.${styles.nodeHeader}`);
      if (!header) return;
      if (id) openFocusMode(id);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("click", onClick);
    document.addEventListener("dblclick", onDoubleClick);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("click", onClick);
      document.removeEventListener("dblclick", onDoubleClick);
    };
  }, [
    activeSpaceId,
    activeTool,
    focusOpen,
    graph.entities,
    openFocusMode,
    openFolder,
    scale,
    selectedNodeIds,
    translateX,
    translateY,
    updateNodeBody,
    visibleEntityIds,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      spacePanRef.current = true;
      setSpacePanning(true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spacePanRef.current = false;
      setSpacePanning(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const deleteEntitySelection = useCallback((entityIds: string[]) => {
    if (entityIds.length === 0) return;
    setGraph((prev) => {
      const next = shallowCloneGraph(prev);
      const entityIdsToDelete = new Set<string>();
      const spaceIdsToDelete = new Set<string>();

      const markEntity = (entityId: string) => {
        if (entityIdsToDelete.has(entityId)) return;
        const entity = next.entities[entityId];
        if (!entity) return;
        entityIdsToDelete.add(entityId);

        if (entity.kind !== "folder") return;
        const stack = [entity.childSpaceId];
        while (stack.length > 0) {
          const spaceId = stack.pop();
          if (!spaceId || spaceIdsToDelete.has(spaceId)) continue;
          const space = next.spaces[spaceId];
          if (!space) continue;
          spaceIdsToDelete.add(spaceId);
          space.entityIds.forEach(markEntity);
          Object.values(next.spaces).forEach((candidate) => {
            if (candidate.parentSpaceId === spaceId) {
              stack.push(candidate.id);
            }
          });
        }
      };

      entityIds.forEach(markEntity);

      Object.values(next.spaces).forEach((space) => {
        next.spaces[space.id] = {
          ...space,
          entityIds: space.entityIds.filter((id) => !entityIdsToDelete.has(id)),
        };
      });

      entityIdsToDelete.forEach((entityId) => {
        delete next.entities[entityId];
      });
      spaceIdsToDelete.forEach((spaceId) => {
        if (spaceId !== next.rootSpaceId) {
          delete next.spaces[spaceId];
        }
      });
      return next;
    });

    setSelectedNodeIds((prev) => prev.filter((id) => !entityIds.includes(id)));
    if (activeNodeId && entityIds.includes(activeNodeId)) {
      setFocusOpen(false);
      setActiveNodeId(null);
    }
  }, [activeNodeId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isEditableTarget(event.target)) return;

      if (focusOpen) {
        event.preventDefault();
        closeFocusMode();
        return;
      }

      if (stackModal) {
        event.preventDefault();
        closeStackModal();
        return;
      }

      if (draggedNodeIdsRef.current.length > 0 || lassoStartRef.current || lassoRectScreen) {
        event.preventDefault();
        draggedNodeIdsRef.current = [];
        dragOffsetsRef.current = {};
        setDraggedNodeIds([]);
        lassoStartRef.current = null;
        setLassoRectScreen(null);
        setHoveredFolderId(null);
        setHoveredStackTargetId(null);
        setParentDropHovered(false);
        return;
      }

      if (parentSpaceId) {
        event.preventDefault();
        goBack();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeFocusMode, closeStackModal, focusOpen, goBack, lassoRectScreen, parentSpaceId, stackModal]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isDeleteKey = event.key === "Delete" || event.key === "Backspace";
      if (!isDeleteKey) return;
      if (isEditableTarget(event.target) || focusOpen) return;
      if (selectedNodeIds.length === 0) return;
      event.preventDefault();
      deleteEntitySelection(selectedNodeIds);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteEntitySelection, focusOpen, selectedNodeIds]);

  const onViewportMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (focusOpen) return;

      // Middle mouse drag always pans (tool-agnostic), similar to design tools.
      if (event.button === 1) {
        event.preventDefault();
        isPanningRef.current = true;
        setIsPanning(true);
        panStartRef.current = {
          x: event.clientX - translateX,
          y: event.clientY - translateY,
        };
        return;
      }

      // Left button drives select/lasso and normal pan-tool behavior.
      if (event.button !== 0) return;

      const target = event.target as HTMLElement;
      const isViewport =
        activeTool === "pan" ||
        spacePanRef.current ||
        target === viewportRef.current ||
        target.tagName.toLowerCase() === "svg" ||
        target.tagName.toLowerCase() === "path";
      if (!isViewport) return;

      if (activeTool === "select" && !spacePanRef.current) {
        lassoStartRef.current = { x: event.clientX, y: event.clientY };
        setLassoRectScreen({
          x1: event.clientX,
          y1: event.clientY,
          x2: event.clientX,
          y2: event.clientY,
        });
        return;
      }
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        x: event.clientX - translateX,
        y: event.clientY - translateY,
      };
    },
    [activeTool, focusOpen, translateX, translateY],
  );

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (focusOpen) return;
      const target = event.target as HTMLElement;
      const inEditable =
        !!target.closest("input, textarea, select, [contenteditable='true']");

      // Preserve native wheel behavior inside editors when user is not zooming.
      if (inEditable && !(event.ctrlKey || event.metaKey)) return;

      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const deltaPx = normalizeWheelDelta(event);
        const factor = Math.exp(-deltaPx * WHEEL_ZOOM_SENSITIVITY);
        const nextScale = Math.min(
          Math.max(MIN_ZOOM, viewRef.current.scale * factor),
          MAX_ZOOM,
        );
        const rect = event.currentTarget.getBoundingClientRect();
        updateTransformFromMouse(nextScale, event.clientX - rect.left, event.clientY - rect.top);
      } else {
        setTranslateX((prev) => prev - event.deltaX);
        setTranslateY((prev) => prev - event.deltaY);
      }
    },
    [focusOpen, normalizeWheelDelta, updateTransformFromMouse],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target?.isContentEditable) return;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") {
        return;
      }
      if (focusOpen) return;

      const key = event.key;
      if (key === "=" || key === "+" || key === "NumpadAdd") {
        event.preventDefault();
        zoomBy(ZOOM_BUTTON_STEP);
        return;
      }
      if (key === "-" || key === "_" || key === "NumpadSubtract") {
        event.preventDefault();
        zoomBy(-ZOOM_BUTTON_STEP);
        return;
      }
      if (key === "0" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        recenterToOrigin();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusOpen, recenterToOrigin, zoomBy]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target?.isContentEditable) return;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") {
        return;
      }
      if (focusOpen) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        if (selectedNodeIds.length === 1) {
          const entity = graph.entities[selectedNodeIds[0]!];
          if (entity?.stackId) {
            unstackGroup(entity.stackId);
            return;
          }
        }
        stackSelectedContent();
      }
      if (key === "u" && selectedNodeIds.length === 1) {
        const entity = graph.entities[selectedNodeIds[0]!];
        if (!entity?.stackId) return;
        event.preventDefault();
        setGraph((prev) => {
          const next = shallowCloneGraph(prev);
          next.entities[entity.id] = {
            ...next.entities[entity.id],
            stackId: null,
            stackOrder: null,
          };
          return normalizeStack(entity.stackId!, next);
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusOpen, graph.entities, normalizeStack, selectedNodeIds, stackSelectedContent, unstackGroup]);

  const runFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
  }, []);

  const moveSelectionToParent = useCallback(() => {
    if (!parentSpaceId) return;
    const center = centerCoords();
    const idsToMove = selectedNodeIds.filter((entityId) => visibleEntityIds.includes(entityId));
    if (idsToMove.length === 0) return;
    const fallback = { x: center.x - 180, y: center.y - 120 };
    const anchorBelowFolder = getParentFolderExitSlot(0) ?? fallback;
    moveEntitiesToSpace(idsToMove, parentSpaceId, {
      anchor: anchorBelowFolder,
      forceLayout: true,
    });
  }, [
    centerCoords,
    getParentFolderExitSlot,
    moveEntitiesToSpace,
    parentSpaceId,
    selectedNodeIds,
    visibleEntityIds,
  ]);

  useEffect(() => {
    setSelectedNodeIds((prev) => prev.filter((id) => visibleEntityIds.includes(id)));
  }, [visibleEntityIds]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (!visibleEntityIds.includes(activeNodeId)) {
      setFocusOpen(false);
      setActiveNodeId(null);
    }
  }, [activeNodeId, visibleEntityIds]);

  const centerWorldX = Math.round((viewportSize.width / 2 - translateX) / scale);
  const centerWorldY = Math.round((viewportSize.height / 2 - translateY) / scale);
  const stackModalEntities = stackModal
    ? stackModal.orderedIds
        .map((id) => graph.entities[id])
        .filter((entity): entity is CanvasEntity => !!entity)
    : [];
  const stackModalVisibleEntities = stackModalEntities.slice(0, STACK_MODAL_MAX_ITEMS);
  const stackModalHiddenCount = Math.max(0, stackModalEntities.length - stackModalVisibleEntities.length);
  const stackModalLayout = useMemo(
    () =>
      buildStackModalLayout(
        stackModalVisibleEntities.map((entity) => entity.id),
        viewportSize,
        stackModalCardHeights,
      ),
    [stackModalCardHeights, stackModalVisibleEntities, viewportSize],
  );
  const fanOriginX = stackModal ? stackModal.originX - 170 : 0;
  const fanOriginY = stackModal ? stackModal.originY - 95 : 0;
  const stackModalHull = useMemo(() => {
    if (stackModalVisibleEntities.length === 0) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    stackModalVisibleEntities.forEach((entity) => {
      const slot = stackModalLayout[entity.id];
      if (!slot) return;
      const cardW = STACK_MODAL_CARD_W * slot.scale;
      const cardH = (stackModalCardHeights[entity.id] ?? STACK_MODAL_CARD_H_ESTIMATE) * slot.scale;
      minX = Math.min(minX, slot.x);
      minY = Math.min(minY, slot.y);
      maxX = Math.max(maxX, slot.x + cardW);
      maxY = Math.max(maxY, slot.y + cardH);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
    return {
      left: minX,
      top: minY,
      right: maxX,
      bottom: maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [stackModalCardHeights, stackModalLayout, stackModalVisibleEntities]);
  return (
    <div className={styles.shell}>
      <div
        ref={viewportRef}
        className={`${styles.viewport} ${activeSpaceId !== graph.rootSpaceId ? styles.deepSpace : ""}`}
        onMouseDown={onViewportMouseDown}
        onWheel={onWheel}
        style={{
          backgroundPosition: `${translateX}px ${translateY}px`,
          cursor: isPanning
            ? "grabbing"
            : activeTool === "pan" || spacePanning
              ? "grab"
              : "default",
        }}
      >
        <div
          className={styles.canvas}
          style={{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})` }}
        >
          {standaloneEntities.map((entity) => {
            const slot = entity.slots[activeSpaceId] ?? { x: 0, y: 0 };
            const draggedIndex = draggedNodeIds.indexOf(entity.id);
            const dragged = draggedIndex >= 0;
            const dropPreview = dragged && !!hoveredFolderId;
            const selected = selectedNodeIds.includes(entity.id);
            const folderCount =
              entity.kind === "folder"
                ? graph.spaces[entity.childSpaceId]?.entityIds.length ?? 0
                : 0;
            return (
              <div
                key={entity.id}
                data-node-id={entity.id}
                data-space-id={activeSpaceId}
                data-stack-target={entity.kind === "content" ? "true" : undefined}
                className={`${styles.nodePlacement} ${hoveredStackTargetId === entity.id ? styles.stackDropTarget : ""}`}
                style={{
                  left: `${slot.x}px`,
                  top: `${slot.y}px`,
                  transform: `rotate(${entity.rotation}deg) scale(${dropPreview ? 0.92 : 1})`,
                  zIndex: dragged ? maxZIndex + draggedIndex : nodeZ.get(entity.id),
                }}
              >
                {hoveredStackTargetId === entity.id ? <div className={styles.nodeStackHoverFrame} /> : null}
                {entity.kind === "content" ? (
                  <ArchitecturalNodeCard
                    id={entity.id}
                    title={entity.title}
                    width={entity.width}
                    theme={entity.theme}
                    tapeVariant={tapeVariantForTheme(entity.theme)}
                    tapeRotation={entity.tapeRotation}
                    bodyHtml={entity.bodyHtml}
                    activeTool={activeTool}
                    dragged={dragged}
                    selected={selected}
                    showTape={!entity.stackId}
                    onBodyCommit={updateNodeBody}
                    onExpand={openFocusMode}
                  />
                ) : (
                  <ArchitecturalFolderCard
                    id={entity.id}
                    title={entity.title}
                    itemCount={folderCount}
                    dragOver={hoveredFolderId === entity.id}
                    selected={selected}
                    onTitleCommit={(title) => renameFolder(entity.id, title)}
                    onOpen={() => openFolder(entity.id)}
                  />
                )}
              </div>
            );
          })}
          {collapsedStacks.map(({ stackId, entities, top }) => {
            if (stackModal?.stackId === stackId) return null;
            const slot = top.slots[activeSpaceId] ?? { x: 0, y: 0 };
            const selected = entities.some((entity) => selectedNodeIds.includes(entity.id));
            const draggingStack = entities.some((entity) => draggedNodeIds.includes(entity.id));
            const z = draggingStack
              ? maxZIndex + 1
              : Math.max(...entities.map((entity) => nodeZ.get(entity.id) ?? 1)) + 1;
            const focusBounds = selected ? stackFocusBoundsById[stackId] ?? null : null;
            const hoverBounds = hoveredStackTargetId === top.id ? stackHoverBoundsById[stackId] ?? null : null;
            return (
              <div
                key={stackId}
                data-stack-container="true"
                data-stack-id={stackId}
                data-stack-target="true"
                data-stack-top-id={top.id}
                className={`${styles.stackContainer} ${hoveredStackTargetId === top.id ? styles.stackDropTarget : ""}`}
                style={{
                  left: `${slot.x}px`,
                  top: `${slot.y}px`,
                  zIndex: z,
                }}
                onMouseDown={(event) => {
                  if (event.button !== 0 || activeTool !== "select") return;
                  const target = event.target as HTMLElement;
                  if (target.closest("[data-expand-btn='true']")) return;
                  event.stopPropagation();
                  const mouseCanvasX = (event.clientX - translateX) / scale;
                  const mouseCanvasY = (event.clientY - translateY) / scale;
                  const offsets: Record<string, { x: number; y: number }> = {};
                  entities.forEach((entity) => {
                    const entitySlot = entity.slots[activeSpaceId];
                    if (!entitySlot) return;
                    offsets[entity.id] = {
                      x: mouseCanvasX - entitySlot.x,
                      y: mouseCanvasY - entitySlot.y,
                    };
                  });
                  dragOffsetsRef.current = offsets;
                  draggedNodeIdsRef.current = entities.map((entity) => entity.id);
                  setDraggedNodeIds(entities.map((entity) => entity.id));
                  setSelectedNodeIds(entities.map((entity) => entity.id));
                  setMaxZIndex((prev) => prev + 1);
                  stackPointerDragRef.current = {
                    stackId,
                    startX: event.clientX,
                    startY: event.clientY,
                    moved: false,
                  };
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  const target = event.target as HTMLElement;
                  if (target.closest("[data-expand-btn='true']")) return;
                  const suppressed = suppressStackOpenRef.current;
                  if (suppressed) {
                    if (Date.now() > suppressed.expiresAt) {
                      suppressStackOpenRef.current = null;
                    } else if (suppressed.stackId === stackId) {
                      suppressStackOpenRef.current = null;
                      return;
                    }
                  }
                  if (draggedNodeIdsRef.current.length > 0) return;
                  const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                  setStackModal({
                    stackId,
                    orderedIds: entities.map((entity) => entity.id),
                    originX: rect.left + rect.width / 2,
                    originY: rect.top + rect.height / 2,
                  });
                }}
              >
                {focusBounds ? (
                  <div
                    className={styles.stackFocusBounds}
                    style={{
                      left: focusBounds.left,
                      top: focusBounds.top,
                      width: focusBounds.width,
                      height: focusBounds.height,
                    }}
                  />
                ) : null}
                {hoverBounds ? (
                  <div
                    className={styles.stackHoverBounds}
                    style={{
                      left: hoverBounds.left,
                      top: hoverBounds.top,
                      width: hoverBounds.width,
                      height: hoverBounds.height,
                    }}
                  />
                ) : null}
                {entities.map((entity, index) => (
                  <div
                    key={entity.id}
                    data-stack-layer="true"
                    className={`${styles.stackLayer} ${index === entities.length - 1 ? styles.stackLayerTopInteractive : ""}`}
                    style={{
                      "--stack-x": `${index * 6}px`,
                      "--stack-y": `${index * 6}px`,
                      "--stack-r": `${(index - (entities.length - 1) / 2) * 1.6}deg`,
                    } as React.CSSProperties}
                  >
                    {entity.kind === "content" ? (
                      <ArchitecturalNodeCard
                        id={entity.id}
                        title={entity.title}
                        width={entity.width}
                        theme={entity.theme}
                        tapeVariant={tapeVariantForTheme(entity.theme)}
                        tapeRotation={entity.tapeRotation}
                        bodyHtml={entity.bodyHtml}
                        activeTool={activeTool}
                        dragged={draggingStack}
                        selected={false}
                        showTape={!entity.stackId}
                        onBodyCommit={updateNodeBody}
                        onExpand={openFocusMode}
                        bodyEditable={false}
                      />
                    ) : (
                      <ArchitecturalFolderCard
                        id={entity.id}
                        title={entity.title}
                        itemCount={graph.spaces[entity.childSpaceId]?.entityIds.length ?? 0}
                        dragOver={false}
                        selected={false}
                        onTitleCommit={(title) => renameFolder(entity.id, title)}
                        onOpen={() => openFolder(entity.id)}
                      />
                    )}
                  </div>
                ))}
                <div className={styles.stackCountBadge}>{entities.length}</div>
              </div>
            );
          })}
        </div>
        <div className={styles.chromeLayer}>
        <ArchitecturalStatusBar
          centerWorldX={centerWorldX}
          centerWorldY={centerWorldY}
          scale={scale}
        />

        <div className={styles.navWrap}>
          <div className={`${styles.glassPanel} ${styles.navPanel}`}>
            <div className={styles.navRow}>
              {parentSpaceId ? (
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={goBack}
                >
                  <ArrowLeft size={12} />
                  Back
                </button>
              ) : null}
              {parentSpaceId ? (
                <button
                  ref={parentDropRef}
                  type="button"
                  className={`${styles.parentDrawer} ${parentDropHovered ? styles.parentDrawerActive : ""}`}
                  onClick={moveSelectionToParent}
                  disabled={selectedNodeIds.length === 0}
                >
                  <span className={styles.parentDrawerTab}>Drawer</span>
                  <span className={styles.parentDrawerLabel}>Remove from folder</span>
                </button>
              ) : null}
              <div className={styles.crumbTrail}>
                {navigationPath.map((spaceId, index) => {
                  const isActive = spaceId === activeSpaceId;
                  const label =
                    spaceId === graph.rootSpaceId ? "Root" : graph.spaces[spaceId]?.name ?? "Unknown";
                  return (
                    <span key={spaceId} className={styles.crumbItem}>
                      {index > 0 ? <span className={styles.crumbSep}>/</span> : null}
                      <button
                        type="button"
                        className={`${styles.crumbBtn} ${isActive ? styles.crumbActive : ""}`}
                        onClick={() => enterSpace(spaceId)}
                        disabled={isActive}
                      >
                        {label}
                      </button>
                    </span>
                  );
                })}
              </div>
              {parentSpaceId ? (
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={moveSelectionToParent}
                  disabled={selectedNodeIds.length === 0}
                >
                  Remove selected
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <ArchitecturalBottomDock onFormat={runFormat} onCreateNode={createNewNode} />

        <ArchitecturalToolRail
          activeTool={activeTool}
          onSetTool={setActiveTool}
          onZoomIn={() => zoomBy(ZOOM_BUTTON_STEP)}
          onZoomOut={() => zoomBy(-ZOOM_BUTTON_STEP)}
          onRecenter={recenterToOrigin}
        />
      </div>
      </div>

      {lassoRectScreen ? (
        <div
          className={styles.lassoRect}
          style={{
            left: Math.min(lassoRectScreen.x1, lassoRectScreen.x2),
            top: Math.min(lassoRectScreen.y1, lassoRectScreen.y2),
            width: Math.abs(lassoRectScreen.x2 - lassoRectScreen.x1),
            height: Math.abs(lassoRectScreen.y2 - lassoRectScreen.y1),
          }}
        />
      ) : null}

      {stackModal ? <div className={styles.stackScrim} onClick={closeStackModal} /> : null}
      {stackModal ? (
        <div
          className={styles.stackModal}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeStackModal();
            }
          }}
        >
          <div className={styles.stackModalCloseButtonWrap}>
            <ArchitecturalFocusCloseButton
              label="Close"
              variant="dark"
              showIcon={false}
              onClick={closeStackModal}
            />
          </div>
          <div
            className={styles.stackFanStage}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeStackModal();
              }
            }}
          >
            {stackModalHull && stackDrag ? (
              <div
                className={`${styles.stackHullDropCue} ${stackModalEjectPreview ? styles.stackHullDropCueActive : ""}`}
                style={{
                  left: stackModalHull.left - STACK_MODAL_EJECT_MARGIN,
                  top: stackModalHull.top - STACK_MODAL_EJECT_MARGIN,
                  width: stackModalHull.width + STACK_MODAL_EJECT_MARGIN * 2,
                  height: stackModalHull.height + STACK_MODAL_EJECT_MARGIN * 2,
                }}
              />
            ) : null}
            {stackModalVisibleEntities.map((entity, index) => {
              const slot = stackModalLayout[entity.id] ?? {
                x: viewportSize.width / 2 - 170,
                y: viewportSize.height / 2 - 95,
                scale: 1,
              };
              const drag = stackDrag?.entityId === entity.id ? stackDrag : null;
              const collapsedX = fanOriginX + index * 6;
              const collapsedY = fanOriginY + index * 6;
              const baseX = stackModalExpanded ? slot.x : collapsedX;
              const baseY = stackModalExpanded ? slot.y : collapsedY;
              const dragX = drag ? drag.currentX - drag.pointerOffsetX : baseX;
              const dragY = drag ? drag.currentY - drag.pointerOffsetY : baseY;
              const rotation = stackModalExpanded
                ? ((index % 2 === 0 ? -1 : 1) * 0.8)
                : (index - (stackModalEntities.length - 1) / 2) * 1.6;
              return (
                <div
                  key={entity.id}
                  className={`${styles.stackFanCard} ${drag ? styles.stackFanDragging : ""} ${drag && stackModalEjectPreview ? styles.stackFanEjectArmed : ""}`}
                  style={{
                    zIndex: 900 + index,
                    transform: `translate(${dragX}px, ${dragY}px) rotate(${rotation}deg) scale(${slot.scale})`,
                  }}
                  ref={(el) => {
                    if (!el) return;
                    const cardEl = el.firstElementChild as HTMLElement | null;
                    const h = cardEl?.offsetHeight ?? STACK_MODAL_CARD_H_ESTIMATE;
                    setStackModalCardHeights((prev) => {
                      const current = prev[entity.id];
                      if (current && Math.abs(current - h) < 1) return prev;
                      return { ...prev, [entity.id]: h };
                    });
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    setStackDrag({
                      entityId: entity.id,
                      stackId: stackModal.stackId,
                      startX: event.clientX,
                      startY: event.clientY,
                      currentX: event.clientX,
                      currentY: event.clientY,
                      pointerOffsetX: event.clientX - baseX,
                      pointerOffsetY: event.clientY - baseY,
                      intent: "pending",
                    });
                  }}
                >
                  {entity.kind === "content" ? (
                    <ArchitecturalNodeCard
                      id={entity.id}
                      title={entity.title}
                      width={entity.width}
                      theme={entity.theme}
                      tapeVariant={tapeVariantForTheme(entity.theme)}
                      tapeRotation={entity.tapeRotation}
                      bodyHtml={entity.bodyHtml}
                      activeTool={activeTool}
                      dragged={!!drag}
                      selected={false}
                      showTape={!entity.stackId}
                      onBodyCommit={updateNodeBody}
                      onExpand={openFocusMode}
                    />
                  ) : (
                    <ArchitecturalFolderCard
                      id={entity.id}
                      title={entity.title}
                      itemCount={graph.spaces[entity.childSpaceId]?.entityIds.length ?? 0}
                      dragOver={false}
                      selected={false}
                      onTitleCommit={(title) => renameFolder(entity.id, title)}
                      onOpen={() => openFolder(entity.id)}
                    />
                  )}
                </div>
              );
            })}
            {stackModalHiddenCount > 0 ? (
              <div className={styles.stackModalOverflowBadge}>
                +{stackModalHiddenCount} more in stack
              </div>
            ) : null}
            {stackModalEjectCount > 0 ? (
              <div className={styles.stackModalEjectBadge}>Removed {stackModalEjectCount}</div>
            ) : null}
            {stackDrag && stackModalEjectPreview ? (
              <div className={styles.stackModalUnstackHint}>Release to unstack</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={`${styles.focusOverlay} ${focusOpen ? styles.focusActive : ""}`}>
        <div className={styles.focusHeader}>
          <div className={styles.focusMeta}>
            EDITING // {activeNodeId ? activeNodeId.toUpperCase() : "NODE"}
          </div>
          <ArchitecturalFocusCloseButton
            variant={focusCodeTheme ? "dark" : "light"}
            onClick={closeFocusMode}
          />
        </div>
        <div className={styles.focusContent}>
          <BufferedTextInput
            type="text"
            className={styles.focusTitle}
            value={focusTitle}
            debounceMs={150}
            onCommit={(next) => setFocusTitle(next)}
            placeholder="Untitled Document"
            data-focus-title-editor="true"
            style={{
              color: focusCodeTheme
                ? "var(--sys-color-white)"
                : "var(--sys-color-black)",
            }}
          />
          <BufferedContentEditable
            value={focusBody}
            className={`${styles.focusBody} ${focusCodeTheme ? styles.focusCode : ""}`}
            editable
            spellCheck={false}
            debounceMs={150}
            dataAttribute="data-focus-body-editor"
            onCommit={(nextHtml) => setFocusBody(nextHtml)}
          />
        </div>
      </div>
    </div>
  );
}
