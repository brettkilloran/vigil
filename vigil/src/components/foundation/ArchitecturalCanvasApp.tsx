"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CornersOut, DownloadSimple, Folder } from "@phosphor-icons/react";

import styles from "./ArchitecturalCanvasApp.module.css";
import { ArchitecturalBottomDock } from "@/src/components/foundation/ArchitecturalBottomDock";
import { ArchitecturalFocusCloseButton } from "@/src/components/foundation/ArchitecturalFocusCloseButton";
import { ArchitecturalNodeCard } from "@/src/components/foundation/ArchitecturalNodeCard";
import { ArchitecturalStatusBar } from "@/src/components/foundation/ArchitecturalStatusBar";
import { ArchitecturalToolRail } from "@/src/components/foundation/ArchitecturalToolRail";
import { buildArchitecturalSeedGraph } from "@/src/components/foundation/architectural-seed";
import type {
  CanvasEntity,
  CanvasGraph,
  CanvasSpace,
  CanvasTool,
  NodeTheme,
} from "@/src/components/foundation/architectural-types";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_BUTTON_STEP = 0.2;
const WHEEL_ZOOM_SENSITIVITY = 0.0012;
const UNIFIED_NODE_WIDTH = 340;
const LAYOUT_COLUMNS = 4;
const LAYOUT_COL_GAP = 380;
const LAYOUT_ROW_GAP = 280;

type ArchitecturalCanvasScenario = "default" | "nested" | "corrupt";

const ROOT_SPACE_ID = "root";

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
  const [parentDropHovered, setParentDropHovered] = useState(false);

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

  const updateNodeBody = useCallback((id: string, html: string) => {
    setGraph((prev) => {
      const entity = prev.entities[id];
      if (!entity || entity.kind !== "content") return prev;
      return {
        ...prev,
        entities: {
          ...prev.entities,
          [id]: { ...entity, bodyHtml: html },
        },
      };
    });
  }, []);

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

  const renameFolder = useCallback((entityId: string, title: string) => {
    setGraph((prev) => {
      const entity = prev.entities[entityId];
      if (!entity || entity.kind !== "folder") return prev;
      const next = shallowCloneGraph(prev);
      const nextTitle = title.trim() || "Untitled Folder";
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
  }, []);

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
        <div contenteditable="true" style="font-size: 13px; color: #555;">Caption...</div>
      `;
    }

    const nextNode = {
      id,
      title,
      kind: "content" as const,
      rotation,
      width,
      theme: type,
      tapeRotation,
      bodyHtml,
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
      const draggedEl = document.querySelector<HTMLElement>(`[data-node-id="${draggedEntityId}"]`);
      if (!draggedEl) return;
      const dragRect = draggedEl.getBoundingClientRect();
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

      if (!hoveredFolderId) return;
      const folderEntity = graph.entities[hoveredFolderId];
      if (!folderEntity || folderEntity.kind !== "folder") return;
      const childSpaceId = graph.spaces[folderEntity.childSpaceId]
        ? folderEntity.childSpaceId
        : ensureFolderChildSpace(hoveredFolderId);
      if (!childSpaceId) return;
      moveEntitiesToSpace(draggedEntityIds, childSpaceId, {
        anchor: fallback,
        forceLayout: true,
      });
    },
    [
      centerCoords,
      ensureFolderChildSpace,
      getParentFolderExitSlot,
      graph.entities,
      graph.spaces,
      hoveredFolderId,
      moveEntitiesToSpace,
      parentDropHovered,
      parentSpaceId,
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
      draggedNodeIdsRef.current = [];
      dragOffsetsRef.current = {};
      setDraggedNodeIds([]);
      setHoveredFolderId(null);
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
    const onMouseDown = (event: MouseEvent) => {
      if (focusOpen) return;
      if (activeTool === "pan" || spacePanRef.current) return;
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
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
            if (bodyEl) updateNodeBody(owner.dataset.nodeId, bodyEl.innerHTML);
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
      const header = target.closest(`.${styles.nodeHeader}`);
      if (!header) return;
      const entity = target.closest<HTMLElement>(`[data-node-id]`);
      const id = entity?.dataset.nodeId;
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

      if (draggedNodeIdsRef.current.length > 0 || lassoStartRef.current || lassoRectScreen) {
        event.preventDefault();
        draggedNodeIdsRef.current = [];
        dragOffsetsRef.current = {};
        setDraggedNodeIds([]);
        lassoStartRef.current = null;
        setLassoRectScreen(null);
        setHoveredFolderId(null);
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
  }, [closeFocusMode, focusOpen, goBack, lassoRectScreen, parentSpaceId]);

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
          {visibleEntities.map((entity) => {
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
                className={styles.nodePlacement}
                style={{
                  left: `${slot.x}px`,
                  top: `${slot.y}px`,
                  transform: `rotate(${entity.rotation}deg) scale(${dropPreview ? 0.92 : 1})`,
                  zIndex: dragged ? maxZIndex + draggedIndex : nodeZ.get(entity.id),
                }}
              >
                {entity.kind === "content" ? (
                  <ArchitecturalNodeCard
                    id={entity.id}
                    title={entity.title}
                    width={entity.width}
                    theme={entity.theme}
                    tapeRotation={entity.tapeRotation}
                    bodyHtml={entity.bodyHtml}
                    activeTool={activeTool}
                    dragged={dragged}
                    selected={selected}
                    onBodyInput={updateNodeBody}
                    onExpand={openFocusMode}
                  />
                ) : (
                  <div
                    data-folder-drop="true"
                    data-folder-id={entity.id}
                    className={`${styles.folderNode} ${
                      hoveredFolderId === entity.id ? styles.folderDragOver : ""
                    } ${selected ? styles.folderSelected : ""}`}
                  >
                    <div className={styles.folderTab}>
                      <Folder size={12} />
                      FOLDER
                    </div>
                    <div className={styles.folderBack} />
                    <div className={styles.folderInterior}>
                      <DownloadSimple size={24} />
                      <span>Drop to insert</span>
                    </div>
                    <div className={styles.folderFront}>
                      <div className={styles.folderTopRow}>
                        <div className={styles.folderMetaBlock}>
                          <div
                            className={styles.folderTitleInput}
                            contentEditable
                            suppressContentEditableWarning
                            spellCheck={false}
                            onInput={(event) =>
                              renameFolder(entity.id, (event.target as HTMLElement).innerText)
                            }
                          >
                            {entity.title}
                          </div>
                          <div className={styles.folderBadge}>
                            {folderCount} item{folderCount === 1 ? "" : "s"}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={styles.folderOpenBtn}
                          data-folder-open-btn="true"
                          onClick={(event) => {
                            event.stopPropagation();
                            openFolder(entity.id);
                          }}
                        >
                          <CornersOut size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
                ref={parentDropRef}
                type="button"
                className={`${styles.navBtn} ${parentDropHovered ? styles.navBtnDrop : ""}`}
                onClick={goBack}
              >
                <ArrowLeft size={12} />
                Back
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
                Move out
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
          <input
            type="text"
            className={styles.focusTitle}
            value={focusTitle}
            onChange={(event) => setFocusTitle(event.target.value)}
            placeholder="Untitled Document"
            style={{ color: focusCodeTheme ? "#ffffff" : "#111111" }}
          />
          <div
            className={`${styles.focusBody} ${focusCodeTheme ? styles.focusCode : ""}`}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            dangerouslySetInnerHTML={{ __html: focusBody }}
            onInput={(event) => setFocusBody((event.target as HTMLElement).innerHTML)}
          />
        </div>
      </div>
    </div>
  );
}
