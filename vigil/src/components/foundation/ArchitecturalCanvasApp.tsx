"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsOutSimple,
  CheckCircle,
  CheckSquare,
  Code,
  Crosshair,
  CursorClick,
  FileText,
  HandGrabbing,
  Image as ImageIcon,
  ListBullets,
  MagnifyingGlass,
  Minus,
  Plus,
  TextB,
  TextH,
  TextItalic,
} from "@phosphor-icons/react";

import styles from "./ArchitecturalCanvasApp.module.css";

type NodeTheme = "default" | "code" | "task" | "media";
type TapeType = "masking" | "clear" | "dark";

type CanvasNode = {
  id: string;
  title: string;
  x: number;
  y: number;
  rotation: number;
  width?: number;
  theme: NodeTheme;
  tape: TapeType;
  tapeRotation: number;
  bodyHtml: string;
  noHeader?: boolean;
};

const INITIAL_NODES: CanvasNode[] = [
  {
    id: "node-1",
    title: "Project Thesis",
    x: 4050,
    y: 4050,
    rotation: -1,
    theme: "default",
    tape: "masking",
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
    x: 4500,
    y: 4150,
    rotation: 0.5,
    width: 420,
    theme: "code",
    tape: "dark",
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
    x: 4600,
    y: 4550,
    rotation: -2,
    width: 280,
    theme: "task",
    tape: "masking",
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
    x: 4150,
    y: 4650,
    rotation: 1,
    theme: "media",
    tape: "clear",
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
  {
    id: "node-5",
    title: "",
    x: 4950,
    y: 4200,
    rotation: 4,
    width: 200,
    theme: "default",
    tape: "masking",
    tapeRotation: -4,
    bodyHtml: `
      <span style="font-size: 16px; font-weight: 500; color: #111;">
        Double-click a card header to expand it.
      </span>
    `,
    noHeader: true,
  },
];

function tapeClass(tape: TapeType): string {
  if (tape === "dark") return styles.tapeDark;
  if (tape === "clear") return styles.tapeClear;
  return styles.tapeMasking;
}

function themeClass(theme: NodeTheme): string {
  if (theme === "code") return styles.themeCode;
  if (theme === "task") return styles.themeTask;
  if (theme === "media") return styles.themeMedia;
  return styles.themeDefault;
}

export function ArchitecturalCanvasApp() {
  const [nodes, setNodes] = useState<CanvasNode[]>(INITIAL_NODES);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(() =>
    typeof window === "undefined" ? -4000 : -4000 + window.innerWidth / 2 - 200,
  );
  const [translateY, setTranslateY] = useState(() =>
    typeof window === "undefined" ? -4000 : -4000 + window.innerHeight / 2 - 300,
  );
  const [maxZIndex, setMaxZIndex] = useState(100);
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

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
      const canvasX = (mouseX - translateX) / scale;
      const canvasY = (mouseY - translateY) / scale;
      const nextTranslateX = mouseX - canvasX * nextScale;
      const nextTranslateY = mouseY - canvasY * nextScale;
      setScale(nextScale);
      setTranslateX(nextTranslateX);
      setTranslateY(nextTranslateY);
    },
    [scale, translateX, translateY],
  );

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
    const tape: TapeType =
      type === "code"
        ? "dark"
        : type === "media"
          ? "clear"
          : (["masking", "clear", "dark"][
              Math.floor(Math.random() * 3)
            ] as TapeType);

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
      tape,
      tapeRotation,
      bodyHtml,
    };

    setMaxZIndex((prev) => prev + 1);
    setNodes((prev) => [...prev, nextNode]);
  }, [centerCoords]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
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
  }, [scale, translateX, translateY]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (focusOpen) return;
      const target = event.target as HTMLElement;
      const entity = target.closest<HTMLElement>(`[data-node-id]`);
      const inContent =
        target.closest(`.${styles.nodeBody}`) || target.closest(`.${styles.nodeBtn}`);

      if (entity && !inContent) {
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
  }, [focusOpen, openFocusMode, scale, updateNodeBody]);

  const onViewportMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (focusOpen) return;
      const target = event.target as HTMLElement;
      const isViewport =
        target === viewportRef.current ||
        target.tagName.toLowerCase() === "svg" ||
        target.tagName.toLowerCase() === "path";
      if (!isViewport) return;
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        x: event.clientX - translateX,
        y: event.clientY - translateY,
      };
    },
    [focusOpen, translateX, translateY],
  );

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (focusOpen) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const delta = event.deltaY > 0 ? -0.05 : 0.05;
        const nextScale = Math.min(Math.max(0.3, scale + delta), 3);
        const rect = event.currentTarget.getBoundingClientRect();
        updateTransformFromMouse(nextScale, event.clientX - rect.left, event.clientY - rect.top);
      } else {
        setTranslateX((prev) => prev - event.deltaX);
        setTranslateY((prev) => prev - event.deltaY);
      }
    },
    [focusOpen, scale, updateTransformFromMouse],
  );

  const runFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
  }, []);

  return (
    <div className={styles.shell}>
      <div
        ref={viewportRef}
        className={styles.viewport}
        onMouseDown={onViewportMouseDown}
        onWheel={onWheel}
        style={{
          backgroundPosition: `${translateX}px ${translateY}px`,
          cursor: isPanning ? "grabbing" : "grab",
        }}
      >
        <svg className={styles.connections} aria-hidden>
          <path className={styles.link} d="M 4200 4100 C 4400 4100, 4300 4600, 4600 4600" />
          <path className={styles.link} d="M 4700 4650 C 4800 4650, 4800 4300, 4950 4300" />
        </svg>

        <div
          className={styles.canvas}
          style={{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})` }}
        >
          {nodes.map((node) => {
            const dragged = draggedNodeId === node.id;
            return (
              <div
                key={node.id}
                data-node-id={node.id}
                className={`${styles.entityNode} ${themeClass(node.theme)} ${
                  dragged ? styles.dragging : ""
                }`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: node.width ? `${node.width}px` : undefined,
                  transform: `rotate(${node.rotation}deg)`,
                  zIndex: dragged ? maxZIndex : nodeZ.get(node.id),
                }}
              >
                <div
                  className={`${styles.tape} ${tapeClass(node.tape)}`}
                  style={{ transform: `translateX(-50%) rotate(${node.tapeRotation}deg)` }}
                />

                {!node.noHeader && (
                  <div className={styles.nodeHeader}>
                    <span className={styles.nodeTitle}>{node.title}</span>
                    <div className={styles.nodeActions}>
                      <button
                        type="button"
                        className={styles.nodeBtn}
                        data-expand-btn="true"
                        title="Focus Mode"
                      >
                        <ArrowsOutSimple size={16} />
                      </button>
                    </div>
                  </div>
                )}

                <div
                  className={`${styles.nodeBody} ${node.noHeader ? styles.messageBody : ""}`}
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  dangerouslySetInnerHTML={{ __html: node.bodyHtml }}
                  onInput={(event) =>
                    updateNodeBody(node.id, (event.target as HTMLElement).innerHTML)
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.statusWrap}>
        <div className={styles.glassPanel}>
          <div className={styles.statusLeft}>
            <div className={styles.pulseDot} />
            <span className={styles.monoTag}>ARCH_ENV</span>
          </div>
          <div className={styles.sep} />
          <div className={styles.monoSmall}>
            X:<span className={styles.metric}>{Math.round(Math.abs(translateX))}</span> Y:
            <span className={styles.metric}>{Math.round(Math.abs(translateY))}</span>
          </div>
          <div className={styles.sep} />
          <div className={styles.monoSmall}>
            <MagnifyingGlass size={12} />
            <span className={styles.metric}>{Math.round(scale * 100)}%</span>
          </div>
        </div>
      </div>

      <div className={styles.bottomDock}>
        <div className={styles.glassPanelDock}>
          <div className={styles.formatToolbar}>
            <button type="button" className={styles.btnIcon} title="Bold" onMouseDown={(e) => {
              e.preventDefault();
              runFormat("bold");
            }}>
              <TextB size={18} />
            </button>
            <button type="button" className={styles.btnIcon} title="Italic" onMouseDown={(e) => {
              e.preventDefault();
              runFormat("italic");
            }}>
              <TextItalic size={18} />
            </button>
            <div className={styles.sepSmall} />
            <button
              type="button"
              className={styles.btnIcon}
              title="List"
              onMouseDown={(e) => {
                e.preventDefault();
                runFormat("insertUnorderedList");
              }}
            >
              <ListBullets size={18} />
            </button>
            <button
              type="button"
              className={styles.btnIcon}
              title="Heading"
              onMouseDown={(e) => {
                e.preventDefault();
                runFormat("formatBlock", "H1");
              }}
            >
              <TextH size={18} />
            </button>
          </div>

          <div className={styles.addMenu}>
            <button type="button" className={styles.addBtn} onClick={() => createNewNode("default")}>
              <FileText size={16} /> Note
            </button>
            <button type="button" className={styles.addBtn} onClick={() => createNewNode("task")}>
              <CheckSquare size={16} /> Task
            </button>
            <button type="button" className={styles.addBtn} onClick={() => createNewNode("code")}>
              <Code size={16} /> Code
            </button>
            <button type="button" className={styles.addBtn} onClick={() => createNewNode("media")}>
              <ImageIcon size={16} /> Media
            </button>
          </div>
        </div>
      </div>

      <div className={styles.sideTools}>
        <button type="button" className={`${styles.btnIcon} ${styles.active}`} title="Select">
          <CursorClick size={18} />
        </button>
        <button type="button" className={styles.btnIcon} title="Pan Hand">
          <HandGrabbing size={18} />
        </button>
        <div className={styles.sepVertical} />
        <button
          type="button"
          className={styles.btnIcon}
          title="Zoom In"
          onClick={() => setScale((prev) => Math.min(prev + 0.2, 3))}
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          className={styles.btnIcon}
          title="Zoom Out"
          onClick={() => setScale((prev) => Math.max(prev - 0.2, 0.3))}
        >
          <Minus size={18} />
        </button>
        <button
          type="button"
          className={styles.btnIcon}
          title="Recenter"
          onClick={() => {
            setTranslateX(-4000 + window.innerWidth / 2);
            setTranslateY(-4000 + window.innerHeight / 2);
            setScale(1);
          }}
        >
          <Crosshair size={18} />
        </button>
      </div>

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
