"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";

import styles from "./ArchitecturalCanvasApp.module.css";
import { ArchitecturalBottomDock } from "@/src/components/foundation/ArchitecturalBottomDock";
import { ArchitecturalNodeCard } from "@/src/components/foundation/ArchitecturalNodeCard";
import { ArchitecturalStatusBar } from "@/src/components/foundation/ArchitecturalStatusBar";
import { ArchitecturalToolRail } from "@/src/components/foundation/ArchitecturalToolRail";
import type {
  CanvasNode,
  CanvasTool,
  NodeTheme,
} from "@/src/components/foundation/architectural-types";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_BUTTON_STEP = 0.2;
const WHEEL_ZOOM_SENSITIVITY = 0.0012;


const INITIAL_NODES: CanvasNode[] = [
  {
    id: "node-1",
    title: "Project Thesis",
    x: -300,
    y: -320,
    rotation: -1,
    theme: "default",
    tapeRotation: 2,
    bodyHtml: `
      <h1>A Structural Approach</h1>
      <p>Unlike fluid glass interfaces, this environment prioritizes rigid bounds and definitive states. It feels more like arranging physical blueprints than floating digital clouds.</p>
      <blockquote>Clarity over aesthetic blur. The architecture of thought requires solid foundations.</blockquote>
      <p>Notice the crosshair grid-it implies precision and measurement rather than passive atmosphere.</p>
    `,
  },
  {
    id: "node-2",
    title: "SYS // Configuration.js",
    x: 140,
    y: -210,
    rotation: 0.5,
    width: 420,
    theme: "code",
    tapeRotation: -1.5,
    bodyHtml: `
      <span style="color: #c678dd;">const</span> <span style="color: #e5c07b;">environment</span> = {<br>
      &nbsp;&nbsp;<span style="color: #d19a66;">mode</span>: <span style="color: #98c379;">'architectural'</span>,<br>
      &nbsp;&nbsp;<span style="color: #d19a66;">friction</span>: <span style="color: #d19a66;">0.85</span>,<br>
      &nbsp;&nbsp;<span style="color: #d19a66;">snapToGrid</span>: <span style="color: #c678dd;">false</span>,<br>
      &nbsp;&nbsp;<span style="color: #d19a66;">theme</span>: {<br>
      &nbsp;&nbsp;&nbsp;&nbsp;base: <span style="color: #98c379;">'#0a0a0c'</span>,<br>
      &nbsp;&nbsp;&nbsp;&nbsp;accent: <span style="color: #98c379;">'#3b82f6'</span><br>
      &nbsp;&nbsp;}<br>
      };<br><br>
      <span style="color: #5c6370;">// Awaiting secondary confirmation...</span>
    `,
  },
  {
    id: "node-3",
    title: "Immediate Actions",
    x: 240,
    y: 210,
    rotation: -2,
    width: 280,
    theme: "task",
    tapeRotation: 3,
    bodyHtml: `
      <div class="${styles.taskItem} ${styles.done}">
        <div class="${styles.taskCheckbox}"></div>
        <div class="${styles.taskText}" contenteditable="true">Define variant palette</div>
      </div>
      <div class="${styles.taskItem} ${styles.done}">
        <div class="${styles.taskCheckbox}"></div>
        <div class="${styles.taskText}" contenteditable="true">Implement tape randomization</div>
      </div>
      <div class="${styles.taskItem}">
        <div class="${styles.taskCheckbox}"></div>
        <div class="${styles.taskText}" contenteditable="true">Build "Focus Mode" overlay</div>
      </div>
      <div class="${styles.taskItem}">
        <div class="${styles.taskCheckbox}"></div>
        <div class="${styles.taskText}" contenteditable="true">Review typographical hierarchy</div>
      </div>
    `,
  },
  {
    id: "node-4",
    title: "Reference // Structural",
    x: -200,
    y: 310,
    rotation: 1,
    theme: "media",
    tapeRotation: -2.5,
    bodyHtml: `
      <div class="${styles.mediaPlaceholder}">
        <span>Image Placeholder</span>
      </div>
      <div contenteditable="true" style="font-size: 13px; color: #555;">
        Brutalist web design pattern reference. Note the heavy borders and lack of border-radius.
      </div>
    `,
  },
];

export function ArchitecturalCanvasApp() {
  const [nodes, setNodes] = useState<CanvasNode[]>(INITIAL_NODES);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth / 2,
  );
  const [translateY, setTranslateY] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerHeight / 2,
  );
  const [maxZIndex, setMaxZIndex] = useState(100);
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [spacePanning, setSpacePanning] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [lassoRectScreen, setLassoRectScreen] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
  }));

  const [focusOpen, setFocusOpen] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [focusTitle, setFocusTitle] = useState("");
  const [focusBody, setFocusBody] = useState("");
  const [focusCodeTheme, setFocusCodeTheme] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const viewRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const lassoStartRef = useRef<{ x: number; y: number } | null>(null);
  const spacePanRef = useRef(false);

  const nodeZ = useMemo(() => {
    const zMap = new Map<string, number>();
    nodes.forEach((node, index) => zMap.set(node.id, index + 1));
    return zMap;
  }, [nodes]);

  const updateNodeBody = useCallback((id: string, html: string) => {
    setNodes((prev) =>
      prev.map((node) => (node.id === id ? { ...node, bodyHtml: html } : node)),
    );
  }, []);

  const openFocusMode = useCallback((id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    setActiveNodeId(id);
    setFocusTitle(node.title);
    setFocusBody(node.bodyHtml);
    setFocusCodeTheme(node.theme === "code");
    setFocusOpen(true);
  }, [nodes]);

  const closeFocusMode = useCallback(() => {
    if (activeNodeId) {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === activeNodeId
            ? {
                ...node,
                title: focusTitle.trim() || "Untitled",
                bodyHtml: focusBody,
              }
            : node,
        ),
      );
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

  const createNewNode = useCallback((type: NodeTheme) => {
    const center = centerCoords();
    const id = `node-${Date.now()}`;
    const x = center.x - 170 + (Math.random() * 60 - 30);
    const y = center.y - 100 + (Math.random() * 60 - 30);
    const rotation = (Math.random() - 0.5) * 4;
    const tapeRotation = (Math.random() - 0.5) * 6;

    let title = "New Note";
    let width: number | undefined;
    let bodyHtml = `<div contenteditable="true">Start typing...</div>`;

    if (type === "task") {
      title = "Checklist";
      width = 300;
      bodyHtml = `
        <div class="${styles.taskItem}">
          <div class="${styles.taskCheckbox}"></div>
          <div class="${styles.taskText}" contenteditable="true">New task</div>
        </div>
      `;
    } else if (type === "code") {
      title = "Snippet";
      width = 380;
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

    const nextNode: CanvasNode = {
      id,
      title,
      x,
      y,
      rotation,
      width,
      theme: type,
      tapeRotation,
      bodyHtml,
    };

    setMaxZIndex((prev) => prev + 1);
    setNodes((prev) => [...prev, nextNode]);
  }, [centerCoords]);

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

      const draggedNodeId = draggedNodeRef.current;
      if (!draggedNodeId) return;
      const x = (event.clientX - translateX) / scale - dragOffsetRef.current.x;
      const y = (event.clientY - translateY) / scale - dragOffsetRef.current.y;
      setNodes((prev) =>
        prev.map((node) =>
          node.id === draggedNodeId
            ? {
                ...node,
                x,
                y,
              }
            : node,
        ),
      );
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
      draggedNodeRef.current = null;
      setDraggedNodeId(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [lassoRectScreen, scale, translateX, translateY]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (focusOpen) return;
      if (activeTool === "pan" || spacePanRef.current) return;
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      const entity = target.closest<HTMLElement>(`[data-node-id]`);
      const inContent =
        target.closest(`.${styles.nodeBody}`) || target.closest(`.${styles.nodeBtn}`);

      if (entity && !inContent) {
        const nodeId = entity.dataset.nodeId;
        if (nodeId) {
          if (event.shiftKey) {
            setSelectedNodeIds((prev) =>
              prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
            );
          } else {
            setSelectedNodeIds([nodeId]);
          }
        }
        const rect = entity.getBoundingClientRect();
        draggedNodeRef.current = entity.dataset.nodeId ?? null;
        setDraggedNodeId(entity.dataset.nodeId ?? null);
        dragOffsetRef.current = {
          x: (event.clientX - rect.left) / scale,
          y: (event.clientY - rect.top) / scale,
        };
        setMaxZIndex((prev) => prev + 1);
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
  }, [activeTool, focusOpen, openFocusMode, scale, updateNodeBody]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return (
        el.isContentEditable ||
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT"
      );
    };

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
      if (!(event.ctrlKey || event.metaKey)) return;

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
      if (key === "0") {
        event.preventDefault();
        recenterToOrigin();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [recenterToOrigin, zoomBy]);

  const runFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
  }, []);

  const centerWorldX = Math.round((viewportSize.width / 2 - translateX) / scale);
  const centerWorldY = Math.round((viewportSize.height / 2 - translateY) / scale);

  return (
    <div className={styles.shell}>
      <div
        ref={viewportRef}
        className={styles.viewport}
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
        <svg className={styles.connections} aria-hidden>
          <path className={styles.link} d="M 30 -140 C 190 -140, 140 300, 250 300" />
          <path className={styles.link} d="M 520 320 C 610 320, 590 -30, 150 -30" />
        </svg>

        <div
          className={styles.canvas}
          style={{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})` }}
        >
          {nodes.map((node) => {
            const dragged = draggedNodeId === node.id;
            return (
              <ArchitecturalNodeCard
                key={node.id}
                node={node}
                activeTool={activeTool}
                dragged={dragged}
                selected={selectedNodeIds.includes(node.id)}
                zIndex={dragged ? maxZIndex : nodeZ.get(node.id)}
                onBodyInput={updateNodeBody}
                onExpand={openFocusMode}
              />
            );
          })}
        </div>
      </div>

      <ArchitecturalStatusBar
        centerWorldX={centerWorldX}
        centerWorldY={centerWorldY}
        scale={scale}
      />

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
          <button type="button" className={styles.focusClose} onClick={closeFocusMode}>
            <CheckCircle size={16} /> Done
          </button>
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
