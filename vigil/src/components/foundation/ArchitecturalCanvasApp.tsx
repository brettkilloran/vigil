"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CopySimple,
  DownloadSimple,
  FileText,
  Folder,
  MagnifyingGlass,
  NotePencil,
  SquaresFour,
  Stack,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";

import styles from "./ArchitecturalCanvasApp.module.css";
import { BufferedContentEditable } from "@/src/components/editing/BufferedContentEditable";
import { BufferedTextInput } from "@/src/components/editing/BufferedTextInput";
import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";
import {
  ArchitecturalBottomDock,
  ArchitecturalFolderColorStrip,
  DEFAULT_DOC_INSERT_ACTIONS,
  DEFAULT_FORMAT_ACTIONS,
  type ConnectionDockMode,
} from "@/src/components/foundation/ArchitecturalBottomDock";
import { ArchitecturalParentExitThreshold } from "@/src/components/foundation/ArchitecturalParentExitThreshold";
import { ArchitecturalFocusCloseButton } from "@/src/components/foundation/ArchitecturalFocusCloseButton";
import { ArchitecturalFolderCard } from "@/src/components/foundation/ArchitecturalFolderCard";
import { ArchitecturalNodeCard } from "@/src/components/foundation/ArchitecturalNodeCard";
import { ArchitecturalStatusBar } from "@/src/components/foundation/ArchitecturalStatusBar";
import { ArchitecturalToolRail } from "@/src/components/foundation/ArchitecturalToolRail";
import {
  applyImageDataUrlToArchitecturalMediaBody,
  getArchitecturalMediaNotes,
  parseArchitecturalMediaFromBody,
  setArchitecturalMediaNotes,
} from "@/src/components/foundation/architectural-media-html";
import {
  FOLDER_COLOR_SCHEMES,
  type FolderColorSchemeId,
} from "@/src/components/foundation/architectural-folder-schemes";
import { buildArchitecturalSeedGraph } from "@/src/components/foundation/architectural-seed";
import { pointerEventTargetElement } from "@/src/components/foundation/pointer-event-target";
import {
  cloneArchitecturalGraph,
  MAX_ARCHITECTURAL_UNDO,
  type ArchitecturalUndoSnapshot,
} from "@/src/components/foundation/architectural-undo";
import { useModKeyHints } from "@/src/lib/mod-keys";
import { useRecentItems } from "@/src/hooks/use-recent-items";
import {
  clampContextMenuPosition,
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuPosition,
} from "@/src/components/ui/ContextMenu";
import {
  CommandPalette,
  type PaletteAction,
  type PaletteItem,
  type PaletteSpace,
} from "@/src/components/ui/CommandPalette";
import type {
  CanvasConnectionPin,
  ContentTheme,
  CanvasEntity,
  CanvasGraph,
  CanvasPinConnection,
  CanvasSpace,
  CanvasTool,
  DockFormatAction,
  NodeTheme,
  TapeVariant,
} from "@/src/components/foundation/architectural-types";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_BUTTON_STEP = 0.2;
const WHEEL_ZOOM_SENSITIVITY = 0.0012;
const UNIFIED_NODE_WIDTH = 340;
/** Matches `.folderNode` width/height in ArchitecturalCanvasApp.module.css */
const FOLDER_CARD_WIDTH = 420;
const FOLDER_CARD_HEIGHT = 280;
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
const FOLDER_PREVIEW_MAX_ITEMS = 6;

type ArchitecturalCanvasScenario = "default" | "nested" | "corrupt";

const ROOT_SPACE_ID = "root";
const CONNECTION_DEFAULT_COLOR =
  FOLDER_COLOR_SCHEMES.find((s) => s.id === "coral")?.swatch ?? "oklch(0.68 0.32 48)";
/** Dark neutral thread for "Black mirror" / classic picker slot (not a folder scheme swatch). */
const CONNECTION_CLASSIC_THREAD_COLOR = "oklch(0.22 0.025 265)";
/** OS/browser built-ins only — CSS has no pin/scissors keywords; crosshair reads as precise targeting. */
const CONNECTION_DRAW_CURSOR = "crosshair";
const CONNECTION_CUT_CURSOR = "crosshair";
const CONNECTION_PIN_DEFAULT_CONTENT: CanvasConnectionPin = {
  anchor: "topLeftInset",
  insetX: 14,
  insetY: 18,
};
const CONNECTION_PIN_DEFAULT_FOLDER: CanvasConnectionPin = {
  anchor: "topLeftInset",
  // Fallback when anchor element is not mounted (SSR / no DOM).
  insetX: 34,
  insetY: 80,
};
const CONNECTION_FRICTION = 0.93;
const CONNECTION_GRAVITY = 0.35;
const CONNECTION_ITERATIONS = 4;
const CONNECTION_SEGMENTS = 12;

type RopePoint = {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  pinned: boolean;
};

type RopeConstraint = {
  p1: number;
  p2: number;
  length: number;
};

type RopeRuntime = {
  points: RopePoint[];
  constraints: RopeConstraint[];
};

/** Canvas camera; used to map pin anchors from screen space (getBoundingClientRect) to graph space. */
type ConnectionPinViewContext = {
  tx: number;
  ty: number;
  scale: number;
};

function isUuidLike(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createRopeRuntime(start: { x: number; y: number }, end: { x: number; y: number }): RopeRuntime {
  const points: RopePoint[] = [];
  const constraints: RopeConstraint[] = [];
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const segmentLength = Math.max(14, distance / CONNECTION_SEGMENTS);
  for (let i = 0; i <= CONNECTION_SEGMENTS; i += 1) {
    const t = i / CONNECTION_SEGMENTS;
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    points.push({
      x,
      y,
      oldX: x,
      oldY: y,
      pinned: i === 0 || i === CONNECTION_SEGMENTS,
    });
  }
  for (let i = 0; i < CONNECTION_SEGMENTS; i += 1) {
    constraints.push({ p1: i, p2: i + 1, length: segmentLength * 1.1 });
  }
  return { points, constraints };
}

function resolveConnectionPin(
  entityId: string,
  pin: CanvasConnectionPin,
  activeSpaceId: string,
  graph: CanvasGraph,
  view?: ConnectionPinViewContext,
): { x: number; y: number } | null {
  const entity = graph.entities[entityId];
  if (!entity) return null;
  const slot = entity.slots[activeSpaceId];
  if (!slot) return null;
  const normalizedPin =
    pin.anchor === "topLeftInset"
      ? entity.kind === "folder"
        ? CONNECTION_PIN_DEFAULT_FOLDER
        : CONNECTION_PIN_DEFAULT_CONTENT
      : pin;

  // Prefer live node geometry so pin anchors stay attached under rotation.
  const escapedId =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(entityId)
      : entityId.replace(/"/g, '\\"');
  const escapedSpace =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(activeSpaceId)
      : activeSpaceId.replace(/"/g, '\\"');
  const nodeSel = `[data-node-id="${escapedId}"][data-space-id="${escapedSpace}"]`;
  /* Fan stage is a shell sibling of the canvas; when the stack modal is open, match it first so
     threads follow the fanned cards instead of the (still-mounted) collapsed stack under the scrim. */
  const fanStage = document.querySelector<HTMLElement>("[data-stack-fan-stage='true']");
  const placement =
    (fanStage?.querySelector<HTMLElement>(nodeSel) as HTMLElement | null) ??
    document.querySelector<HTMLElement>(nodeSel);
  if (placement) {
    const pinSelector =
      entity.kind === "folder"
        ? "[data-folder-connection-pin-anchor]"
        : entity.kind === "content"
          ? "[data-content-connection-pin-anchor]"
          : null;
    const stackLayer = placement.dataset.stackLayer === "true";
    const inFanStage = !!placement.closest("[data-stack-fan-stage='true']");
    if (view && pinSelector && (stackLayer || inFanStage)) {
      const anchorEl = placement.querySelector<HTMLElement>(pinSelector);
      if (anchorEl) {
        const r = anchorEl.getBoundingClientRect();
        const cx = (r.left + r.right) / 2;
        const cy = (r.top + r.bottom) / 2;
        return {
          x: (cx - view.tx) / view.scale,
          y: (cy - view.ty) / view.scale,
        };
      }
    }

    const w = placement.offsetWidth || (entity.kind === "folder" ? FOLDER_CARD_WIDTH : entity.width ?? UNIFIED_NODE_WIDTH);
    const h = placement.offsetHeight || (entity.kind === "folder" ? FOLDER_CARD_HEIGHT : 280);
    const rad = (entity.rotation * Math.PI) / 180;
    const cx = w / 2;
    const cy = h / 2;

    let insetX = normalizedPin.insetX;
    let insetY = normalizedPin.insetY;
    const applyAnchor = (selector: string) => {
      const anchor = placement!.querySelector<HTMLElement>(selector);
      if (!anchor) return;
      let ax = anchor.offsetLeft + anchor.offsetWidth / 2;
      let ay = anchor.offsetTop + anchor.offsetHeight / 2;
      let op: HTMLElement | null = anchor.offsetParent as HTMLElement | null;
      while (op && op !== placement) {
        ax += op.offsetLeft;
        ay += op.offsetTop;
        op = op.offsetParent as HTMLElement | null;
      }
      if (op === placement) {
        insetX = ax;
        insetY = ay;
      }
    };
    if (entity.kind === "folder") {
      applyAnchor("[data-folder-connection-pin-anchor]");
    } else if (entity.kind === "content") {
      applyAnchor("[data-content-connection-pin-anchor]");
    }

    const dx = insetX - cx;
    const dy = insetY - cy;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    return {
      x: slot.x + cx + rx,
      y: slot.y + cy + ry,
    };
  }

  return {
    // Slots are stored as top-left card placement coordinates.
    x: slot.x + normalizedPin.insetX,
    y: slot.y + normalizedPin.insetY,
  };
}

function tapeVariantForTheme(theme: ContentTheme): TapeVariant {
  if (theme === "code" || theme === "media") return "dark";
  return "clear";
}

function normalizedFocusTitle(raw: string): string {
  return raw.trim() || "Untitled";
}

function folderPreviewTitles(
  folder: Extract<CanvasEntity, { kind: "folder" }>,
  graph: CanvasGraph,
): string[] {
  const childSpace = graph.spaces[folder.childSpaceId];
  if (!childSpace) return [];

  return [...childSpace.entityIds]
    .reverse()
    .map((entityId) => graph.entities[entityId])
    .filter((entity): entity is Extract<CanvasEntity, { kind: "content" }> => entity?.kind === "content")
    .slice(0, FOLDER_PREVIEW_MAX_ITEMS)
    .map((entity) => normalizedFocusTitle(entity.title));
}

function shallowCloneGraph(graph: CanvasGraph): CanvasGraph {
  return {
    ...graph,
    spaces: { ...graph.spaces },
    entities: { ...graph.entities },
    connections: { ...graph.connections },
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

/**
 * Focus / selection is in a rich prose body where the formatting dock applies.
 * Excludes titles (focus overlay, folder names), plain-text fields, and other inputs.
 */
function isTextFormattingToolbarTarget(focusEl: Element | null): boolean {
  if (!focusEl || !(focusEl instanceof HTMLElement)) return false;
  const root = focusEl.closest("[contenteditable='true']");
  if (!root) return false;
  return !!root.closest("[data-node-body-editor], [data-focus-body-editor]");
}

/** Caret is in a prose body surface (not card titles) — in-document insert tools apply. */
function isRichDocBodyFormattingTarget(focusEl: Element | null): boolean {
  if (!focusEl || !(focusEl instanceof HTMLElement)) return false;
  const root = focusEl.closest("[contenteditable='true']");
  if (!root) return false;
  return !!root.closest("[data-node-body-editor], [data-focus-body-editor]");
}

function normalizeFormatBlockTag(value: string | null | undefined): "p" | "h1" | "h2" | "h3" | "blockquote" {
  const cleaned = (value ?? "")
    .toLowerCase()
    .replace(/[<>]/g, "")
    .trim();
  if (cleaned === "h1" || cleaned === "h2" || cleaned === "h3" || cleaned === "blockquote") {
    return cleaned;
  }
  return "p";
}

function isNodeWithin(element: HTMLElement, candidate: Node | null): boolean {
  if (!candidate) return false;
  if (candidate === element) return true;
  return element.contains(candidate);
}

function placeCaretAtEnd(element: HTMLElement) {
  element.focus();
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function shouldNormalizeChecklistMarkup(
  html: string,
  taskItemClass: string,
): boolean {
  return html.includes(taskItemClass) || html.includes('data-arch-checklist="true"');
}

function normalizeChecklistMarkup(
  html: string,
  classes: { taskItem: string; taskCheckbox: string; taskText: string; done: string },
): string {
  if (typeof document === "undefined") return html;
  if (!shouldNormalizeChecklistMarkup(html, classes.taskItem)) return html;

  const doc = new DOMParser().parseFromString(
    `<div id="__arch_task_parse">${html}</div>`,
    "text/html",
  );
  const wrap = doc.getElementById("__arch_task_parse");
  if (!wrap) return html;

  wrap.querySelectorAll("ul[data-arch-checklist='true']").forEach((ul) => {
    const frag = doc.createDocumentFragment();
    ul.querySelectorAll("li").forEach((li) => {
      const item = doc.createElement("div");
      item.setAttribute("class", classes.taskItem);
      item.setAttribute("contenteditable", "false");

      const checked = !!li.querySelector("input[type='checkbox']:checked");
      if (checked) item.classList.add(classes.done);

      const checkbox = doc.createElement("div");
      checkbox.setAttribute("class", classes.taskCheckbox);
      checkbox.setAttribute("contenteditable", "false");
      item.appendChild(checkbox);

      const text = doc.createElement("div");
      text.setAttribute("class", classes.taskText);
      text.setAttribute("contenteditable", "true");
      text.innerHTML = li.innerHTML.replace(/<input[^>]*>/gi, "").trim() || "New item";
      item.appendChild(text);
      frag.appendChild(item);
    });
    ul.replaceWith(frag);
  });

  wrap.querySelectorAll(`.${classes.taskItem}`).forEach((taskItemEl) => {
    const taskItem = taskItemEl as HTMLElement;
    taskItem.setAttribute("contenteditable", "false");
    let checkbox = taskItem.querySelector<HTMLElement>(`.${classes.taskCheckbox}`);
    if (!checkbox) {
      checkbox = doc.createElement("div");
      checkbox.setAttribute("class", classes.taskCheckbox);
      taskItem.prepend(checkbox);
    }
    checkbox.setAttribute("contenteditable", "false");

    let taskText = taskItem.querySelector<HTMLElement>(`.${classes.taskText}`);
    if (!taskText) {
      taskText = doc.createElement("div");
      taskText.setAttribute("class", classes.taskText);
      taskText.setAttribute("contenteditable", "true");

      const textParts: string[] = [];
      Array.from(taskItem.childNodes).forEach((node) => {
        if (node === checkbox || node === taskText) return;
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as Element).classList.contains(classes.taskCheckbox)
        ) {
          return;
        }
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as Element).classList.contains(classes.taskText)
        ) {
          return;
        }
        const value =
          node.nodeType === Node.TEXT_NODE
            ? node.textContent ?? ""
            : (node as HTMLElement).innerText ?? "";
        if (value.trim()) textParts.push(value.trim());
      });
      taskText.textContent = textParts.join(" ") || "New item";
      taskItem.appendChild(taskText);
    }
  });

  return wrap.innerHTML;
}

type LassoRectScreen = { x1: number; y1: number; x2: number; y2: number };

/**
 * Whether a pointer event target is “canvas chrome” for pan / marquee lasso (not on an entity, stack, or thread).
 * Entity surfaces win over raw svg/path (e.g. icons inside cards). Connection threads are not marquee targets.
 */
function isCanvasPointerMarqueeOrPanSurface(
  target: HTMLElement,
  viewportEl: HTMLElement | null,
  canvasClassName: string,
  activeTool: CanvasTool,
  spacePanning: boolean,
): boolean {
  if (activeTool === "pan" || spacePanning) return true;
  if (
    target.closest("[data-node-id]") ||
    target.closest("[data-stack-container='true']") ||
    target.closest("[data-connection-id]")
  ) {
    return false;
  }
  if (target === viewportEl) return true;
  const tag = target.tagName.toLowerCase();
  if (tag === "svg" || tag === "path") return true;
  return !!target.closest(`.${canvasClassName}`);
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
        mediaFrame: styles.mediaFrame,
        mediaImage: styles.mediaImage,
        mediaImageActions: styles.mediaImageActions,
        mediaUploadBtn: styles.mediaUploadBtn,
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
  const maxZIndexRef = useRef(100);
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNodeIds, setDraggedNodeIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [spacePanning, setSpacePanning] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionDockMode>("move");
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [connectionColor, setConnectionColor] = useState(CONNECTION_DEFAULT_COLOR);
  const [connectionCursorWorld, setConnectionCursorWorld] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [connectionPaths, setConnectionPaths] = useState<Record<string, string>>({});
  const [lassoRectScreen, setLassoRectScreen] = useState<LassoRectScreen | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  /** After fonts + layout frame; drives viewport fade-in and avoids first-paint hiccups. */
  const [canvasSurfaceReady, setCanvasSurfaceReady] = useState(false);

  const [focusOpen, setFocusOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryNodeId, setGalleryNodeId] = useState<string | null>(null);
  const [galleryDraftTitle, setGalleryDraftTitle] = useState("");
  const [galleryDraftNotes, setGalleryDraftNotes] = useState("");
  const [galleryBaselineTitle, setGalleryBaselineTitle] = useState("");
  const [galleryBaselineNotes, setGalleryBaselineNotes] = useState("");
  const [galleryDimsLabel, setGalleryDimsLabel] = useState("— × —");
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [focusTitle, setFocusTitle] = useState("");
  const [focusBody, setFocusBody] = useState("");
  const [focusBaselineTitle, setFocusBaselineTitle] = useState("");
  const [focusBaselineBody, setFocusBaselineBody] = useState("");
  const [focusCodeTheme, setFocusCodeTheme] = useState(false);
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [hoveredStackTargetId, setHoveredStackTargetId] = useState<string | null>(null);
  const [parentDropHovered, setParentDropHovered] = useState(false);
  const parentDropHoveredRef = useRef(false);
  const dragPointerScreenRef = useRef({ x: 0, y: 0 });
  const setParentDropHover = useCallback((next: boolean) => {
    parentDropHoveredRef.current = next;
    setParentDropHovered(next);
  }, []);
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
  /** Frozen visible ids for eject hull during a stack drag (layout swaps won’t shrink/grow the drop zone). */
  const stackDragHullOrderedIdsRef = useRef<string[] | null>(null);
  /** Latest stack order during an active stack drag (synced before React re-render). */
  const stackModalOrderedIdsDuringDragRef = useRef<string[] | null>(null);
  const stackEjectTouchedOutsideRef = useRef(false);
  /** After user leaves the eject hull then returns, skip live reorder until mouseup (prevents swap spam). */
  const stackBlockLiveReorderRef = useRef(false);
  const lastStackEjectPreviewRef = useRef(false);
  const stackModalRef = useRef(stackModal);
  const stackDragRef = useRef(stackDrag);
  const stackModalCardHeightsRef = useRef(stackModalCardHeights);
  const [selectionContextMenu, setSelectionContextMenu] = useState<ContextMenuPosition>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [connectionContextMenu, setConnectionContextMenu] = useState<ContextMenuPosition>(null);
  /** Canvas/stack: show dock format cluster only while focus is in a rich-text surface (card/folder title or body). */
  const [textFormatChromeActive, setTextFormatChromeActive] = useState(false);
  /** True when the caret is in a note/body editor (not titles) — drives in-doc insert strip on canvas. */
  const [richDocInsertChromeActive, setRichDocInsertChromeActive] = useState(false);
  const [formatCommandState, setFormatCommandState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    unorderedList: false,
    orderedList: false,
    blockTag: "p" as "p" | "h1" | "h2" | "h3" | "blockquote",
  });

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const ropeRuntimeRef = useRef<Record<string, RopeRuntime>>({});
  const shellTopLeftStackRef = useRef<HTMLDivElement | null>(null);
  const parentDropRef = useRef<HTMLDivElement | null>(null);
  /** Ignore well click/activation briefly after a parent drop (mouseup can synthesize a click). */
  const suppressParentExitActivateUntilRef = useRef(0);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeIdsRef = useRef<string[]>([]);
  const dragOffsetsRef = useRef<Record<string, { x: number; y: number }>>({});
  const viewRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const lassoStartRef = useRef<{ x: number; y: number } | null>(null);
  /** Mirrors lasso rect for global mouseup; React state can lag one frame behind a quick click. */
  const lassoRectScreenRef = useRef<LassoRectScreen | null>(null);
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
  const graphRef = useRef(graph);
  const activeSpaceIdRef = useRef(activeSpaceId);
  const navigationPathRef = useRef(navigationPath);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const selectionBeforeConnectionModeRef = useRef<string[] | null>(null);
  const undoPastRef = useRef<ArchitecturalUndoSnapshot[]>([]);
  const undoFutureRef = useRef<ArchitecturalUndoSnapshot[]>([]);
  const isApplyingHistoryRef = useRef(false);
  const focusOpenRef = useRef(focusOpen);
  const galleryOpenRef = useRef(galleryOpen);
  const activeNodeIdRef = useRef(activeNodeId);
  const pendingMediaUploadRef = useRef<{ mode: "focus" | "canvas"; id: string } | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastFormatRangeRef = useRef<Range | null>(null);
  const [historyEpoch, setHistoryEpoch] = useState(0);

  graphRef.current = graph;
  maxZIndexRef.current = maxZIndex;
  stackModalRef.current = stackModal;
  stackDragRef.current = stackDrag;
  stackModalCardHeightsRef.current = stackModalCardHeights;
  activeSpaceIdRef.current = activeSpaceId;
  navigationPathRef.current = navigationPath;
  selectedNodeIdsRef.current = selectedNodeIds;
  focusOpenRef.current = focusOpen;
  galleryOpenRef.current = galleryOpen;
  activeNodeIdRef.current = activeNodeId;

  const modKeyHints = useModKeyHints();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { items: recentItems, push: pushRecentItem } = useRecentItems();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setPaletteOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const createId = useCallback((prefix: string) => {
    idCounterRef.current += 1;
    return `${prefix}-${Date.now()}-${idCounterRef.current}`;
  }, []);

  const closeStackModal = useCallback(() => {
    setStackDrag(null);
    stackDragRef.current = null;
    stackDragHullOrderedIdsRef.current = null;
    stackModalOrderedIdsDuringDragRef.current = null;
    stackEjectTouchedOutsideRef.current = false;
    stackBlockLiveReorderRef.current = false;
    lastStackEjectPreviewRef.current = false;
    setStackModalExpanded(false);
    setStackModal(null);
    setStackModalEjectPreview(false);
    setStackModalEjectCount(0);
    setSelectedNodeIds([]);
  }, []);

  const recordUndoBeforeMutation = useCallback(() => {
    if (isApplyingHistoryRef.current) return;
    const snap: ArchitecturalUndoSnapshot = {
      graph: cloneArchitecturalGraph(graphRef.current),
      activeSpaceId: activeSpaceIdRef.current,
      navigationPath: [...navigationPathRef.current],
      selectedNodeIds: [...selectedNodeIdsRef.current],
    };
    undoPastRef.current = [...undoPastRef.current, snap].slice(-MAX_ARCHITECTURAL_UNDO);
    undoFutureRef.current = [];
    setHistoryEpoch((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    if (undoPastRef.current.length === 0) return;
    isApplyingHistoryRef.current = true;
    const current: ArchitecturalUndoSnapshot = {
      graph: cloneArchitecturalGraph(graphRef.current),
      activeSpaceId: activeSpaceIdRef.current,
      navigationPath: [...navigationPathRef.current],
      selectedNodeIds: [...selectedNodeIdsRef.current],
    };
    const restore = undoPastRef.current[undoPastRef.current.length - 1]!;
    undoPastRef.current = undoPastRef.current.slice(0, -1);
    undoFutureRef.current.push(current);

    const rGraph = cloneArchitecturalGraph(restore.graph);
    let nextSpaceId = restore.activeSpaceId;
    let nextPath = restore.navigationPath;
    if (!rGraph.spaces[nextSpaceId]) {
      nextSpaceId = rGraph.rootSpaceId;
      nextPath = buildPathToSpace(nextSpaceId, rGraph.spaces, rGraph.rootSpaceId);
    }

    setGraph(rGraph);
    setActiveSpaceId(nextSpaceId);
    setNavigationPath(nextPath);
    setSelectedNodeIds(restore.selectedNodeIds.filter((id) => rGraph.entities[id]));
    closeStackModal();
    const restoredFocusNodeId = activeNodeIdRef.current;
    if (focusOpenRef.current && restoredFocusNodeId) {
      const restored = rGraph.entities[restoredFocusNodeId];
      if (restored && restored.kind === "content") {
        setActiveNodeId(restoredFocusNodeId);
        setFocusTitle(restored.title);
        setFocusBody(restored.bodyHtml);
        setFocusBaselineTitle(restored.title);
        setFocusBaselineBody(restored.bodyHtml);
        setFocusCodeTheme(restored.theme === "code");
        setFocusOpen(true);
      } else {
        setFocusOpen(false);
        setActiveNodeId(null);
      }
    } else {
      setFocusOpen(false);
      setActiveNodeId(null);
    }
    requestAnimationFrame(() => {
      isApplyingHistoryRef.current = false;
    });
    setHistoryEpoch((n) => n + 1);
  }, [closeStackModal]);

  const redo = useCallback(() => {
    if (undoFutureRef.current.length === 0) return;
    isApplyingHistoryRef.current = true;
    const current: ArchitecturalUndoSnapshot = {
      graph: cloneArchitecturalGraph(graphRef.current),
      activeSpaceId: activeSpaceIdRef.current,
      navigationPath: [...navigationPathRef.current],
      selectedNodeIds: [...selectedNodeIdsRef.current],
    };
    const restore = undoFutureRef.current[undoFutureRef.current.length - 1]!;
    undoFutureRef.current = undoFutureRef.current.slice(0, -1);
    undoPastRef.current = [...undoPastRef.current, current].slice(-MAX_ARCHITECTURAL_UNDO);

    const rGraph = cloneArchitecturalGraph(restore.graph);
    let nextSpaceId = restore.activeSpaceId;
    let nextPath = restore.navigationPath;
    if (!rGraph.spaces[nextSpaceId]) {
      nextSpaceId = rGraph.rootSpaceId;
      nextPath = buildPathToSpace(nextSpaceId, rGraph.spaces, rGraph.rootSpaceId);
    }

    setGraph(rGraph);
    setActiveSpaceId(nextSpaceId);
    setNavigationPath(nextPath);
    setSelectedNodeIds(restore.selectedNodeIds.filter((id) => rGraph.entities[id]));
    closeStackModal();
    const restoredFocusNodeId = activeNodeIdRef.current;
    if (focusOpenRef.current && restoredFocusNodeId) {
      const restored = rGraph.entities[restoredFocusNodeId];
      if (restored && restored.kind === "content") {
        setActiveNodeId(restoredFocusNodeId);
        setFocusTitle(restored.title);
        setFocusBody(restored.bodyHtml);
        setFocusBaselineTitle(restored.title);
        setFocusBaselineBody(restored.bodyHtml);
        setFocusCodeTheme(restored.theme === "code");
        setFocusOpen(true);
      } else {
        setFocusOpen(false);
        setActiveNodeId(null);
      }
    } else {
      setFocusOpen(false);
      setActiveNodeId(null);
    }
    requestAnimationFrame(() => {
      isApplyingHistoryRef.current = false;
    });
    setHistoryEpoch((n) => n + 1);
  }, [closeStackModal]);

  void historyEpoch;
  const canUndo = undoPastRef.current.length > 0;
  const canRedo = undoFutureRef.current.length > 0;

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

  const setConnectionSyncPatch = useCallback(
    (connectionId: string, patch: Partial<CanvasPinConnection>) => {
      setGraph((prev) => {
        const current = prev.connections[connectionId];
        if (!current) return prev;
        const next = shallowCloneGraph(prev);
        next.connections[connectionId] = { ...current, ...patch, updatedAt: Date.now() };
        return next;
      });
    },
    [],
  );

  const syncCreateConnection = useCallback(
    async (connectionId: string) => {
      const snap = graphRef.current.connections[connectionId];
      if (!snap) return;
      const sourceEntity = graphRef.current.entities[snap.sourceEntityId];
      const targetEntity = graphRef.current.entities[snap.targetEntityId];
      const sourceItemId = sourceEntity?.persistedItemId ?? sourceEntity?.id ?? null;
      const targetItemId = targetEntity?.persistedItemId ?? targetEntity?.id ?? null;
      if (!isUuidLike(sourceItemId) || !isUuidLike(targetItemId)) {
        setConnectionSyncPatch(connectionId, {
          syncState: "local-only",
          syncError: "No persisted UUID mapping for one or more cards.",
        });
        return;
      }
      setConnectionSyncPatch(connectionId, { syncState: "syncing", syncError: null });
      try {
        const res = await fetch("/api/item-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceItemId,
            targetItemId,
            linkType: "pin",
            color: snap.color,
            sourcePin: `${snap.sourcePin.anchor}:${snap.sourcePin.insetX}:${snap.sourcePin.insetY}`,
            targetPin: `${snap.targetPin.anchor}:${snap.targetPin.insetX}:${snap.targetPin.insetY}`,
            meta: {
              sourcePinConfig: snap.sourcePin,
              targetPinConfig: snap.targetPin,
            },
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as {
          link?: { id?: string };
          deduped?: boolean;
        };
        setConnectionSyncPatch(connectionId, {
          syncState: "synced",
          dbLinkId: body.link?.id ?? snap.dbLinkId ?? null,
          syncError: null,
        });
      } catch (error) {
        setConnectionSyncPatch(connectionId, {
          syncState: "error",
          syncError: error instanceof Error ? error.message : "Failed to persist link",
        });
      }
    },
    [setConnectionSyncPatch],
  );

  const syncDeleteConnection = useCallback(async (connection: CanvasPinConnection) => {
    if (!connection.dbLinkId || !isUuidLike(connection.dbLinkId)) return;
    try {
      await fetch("/api/item-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: connection.dbLinkId }),
      });
    } catch {
      // Keep local delete authoritative.
    }
  }, []);

  const syncColorConnection = useCallback(
    async (connectionId: string, color: string) => {
      const snap = graphRef.current.connections[connectionId];
      if (!snap?.dbLinkId || !isUuidLike(snap.dbLinkId)) return;
      try {
        await fetch("/api/item-links", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: snap.dbLinkId, color }),
        });
      } catch {
        setConnectionSyncPatch(connectionId, {
          syncState: "error",
          syncError: "Failed to sync connection color",
        });
      }
    },
    [setConnectionSyncPatch],
  );

  const createConnection = useCallback(
    (sourceEntityId: string, targetEntityId: string) => {
      const connectionId = createId("conn");
      recordUndoBeforeMutation();
      setGraph((prev) => {
        const sourceExists = !!prev.entities[sourceEntityId];
        const targetExists = !!prev.entities[targetEntityId];
        if (!sourceExists || !targetExists || sourceEntityId === targetEntityId) return prev;
        const next = shallowCloneGraph(prev);
        next.connections[connectionId] = {
          id: connectionId,
          sourceEntityId,
          targetEntityId,
          sourcePin:
            prev.entities[sourceEntityId]?.kind === "folder"
              ? CONNECTION_PIN_DEFAULT_FOLDER
              : CONNECTION_PIN_DEFAULT_CONTENT,
          targetPin:
            prev.entities[targetEntityId]?.kind === "folder"
              ? CONNECTION_PIN_DEFAULT_FOLDER
              : CONNECTION_PIN_DEFAULT_CONTENT,
          color: connectionColor,
          slackMultiplier: 1.1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          syncState: "local-only",
          syncError: null,
        };
        return next;
      });
      void syncCreateConnection(connectionId);
    },
    [connectionColor, createId, recordUndoBeforeMutation, syncCreateConnection],
  );

  const cutConnection = useCallback(
    (connectionId: string) => {
      const existing = graphRef.current.connections[connectionId];
      if (!existing) return;
      recordUndoBeforeMutation();
      setGraph((prev) => {
        if (!prev.connections[connectionId]) return prev;
        const next = shallowCloneGraph(prev);
        delete next.connections[connectionId];
        return next;
      });
      delete ropeRuntimeRef.current[connectionId];
      void syncDeleteConnection(existing);
    },
    [recordUndoBeforeMutation, syncDeleteConnection],
  );

  const recolorConnection = useCallback(
    (connectionId: string, color: string) => {
      const current = graphRef.current.connections[connectionId];
      if (!current || current.color === color) return;
      recordUndoBeforeMutation();
      setConnectionSyncPatch(connectionId, { color });
      void syncColorConnection(connectionId, color);
    },
    [recordUndoBeforeMutation, setConnectionSyncPatch, syncColorConnection],
  );

  const setConnectionSlack = useCallback(
    (connectionId: string, nextSlack: number) => {
      const current = graphRef.current.connections[connectionId];
      if (!current) return;
      const clamped = Math.max(1.0, Math.min(1.35, nextSlack));
      if (Math.abs((current.slackMultiplier ?? 1.1) - clamped) < 0.001) return;
      recordUndoBeforeMutation();
      setConnectionSyncPatch(connectionId, { slackMultiplier: clamped });
    },
    [recordUndoBeforeMutation, setConnectionSyncPatch],
  );

  const applyConnectionColor = useCallback(
    (nextColor: string) => {
      setConnectionColor(nextColor);
      const selected = selectedNodeIdsRef.current;
      if (selected.length !== 2) return;
      const [a, b] = selected;
      const between = Object.values(graphRef.current.connections)
        .filter(
          (connection) =>
            (connection.sourceEntityId === a && connection.targetEntityId === b) ||
            (connection.sourceEntityId === b && connection.targetEntityId === a),
        )
        .map((connection) => connection.id);
      between.forEach((id) => recolorConnection(id, nextColor));
    },
    [recolorConnection],
  );
  const connectionColorSchemeId = useMemo<FolderColorSchemeId | null>(() => {
    if (connectionColor === CONNECTION_CLASSIC_THREAD_COLOR) return null;
    return FOLDER_COLOR_SCHEMES.find((scheme) => scheme.swatch === connectionColor)?.id ?? null;
  }, [connectionColor]);
  const applyConnectionColorScheme = useCallback(
    (nextScheme: FolderColorSchemeId | null) => {
      if (nextScheme === null) {
        applyConnectionColor(CONNECTION_CLASSIC_THREAD_COLOR);
        return;
      }
      const match = FOLDER_COLOR_SCHEMES.find((scheme) => scheme.id === nextScheme);
      if (!match) return;
      applyConnectionColor(match.swatch);
    },
    [applyConnectionColor],
  );

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

  useEffect(() => {
    let frame = 0;
    const step = () => {
      const graphSnap = graphRef.current;
      const spaceId = activeSpaceIdRef.current;
      const runtimeById = ropeRuntimeRef.current;
      const nextPaths: Record<string, string> = {};
      const activeIds = new Set<string>();
      const { tx, ty, scale: pinScale } = viewRef.current;
      const pinView: ConnectionPinViewContext = { tx, ty, scale: pinScale };
      Object.values(graphSnap.connections).forEach((connection) => {
        const start = resolveConnectionPin(
          connection.sourceEntityId,
          connection.sourcePin,
          spaceId,
          graphSnap,
          pinView,
        );
        const end = resolveConnectionPin(
          connection.targetEntityId,
          connection.targetPin,
          spaceId,
          graphSnap,
          pinView,
        );
        if (!start || !end) return;
        activeIds.add(connection.id);
        let runtime = runtimeById[connection.id];
        if (!runtime) {
          runtime = createRopeRuntime(start, end);
          runtimeById[connection.id] = runtime;
        }
        const first = runtime.points[0];
        const last = runtime.points[runtime.points.length - 1];
        first.x = start.x;
        first.y = start.y;
        first.oldX = start.x;
        first.oldY = start.y;
        last.x = end.x;
        last.y = end.y;
        last.oldX = end.x;
        last.oldY = end.y;
        const slackMultiplier = connection.slackMultiplier ?? 1.1;
        const liveDistance = Math.hypot(end.x - start.x, end.y - start.y);
        const segmentLength = Math.max(14, liveDistance / CONNECTION_SEGMENTS) * slackMultiplier;
        runtime.constraints.forEach((constraint) => {
          constraint.length = segmentLength;
        });

        runtime.points.forEach((point) => {
          if (point.pinned) return;
          const vx = (point.x - point.oldX) * CONNECTION_FRICTION;
          const vy = (point.y - point.oldY) * CONNECTION_FRICTION;
          point.oldX = point.x;
          point.oldY = point.y;
          point.x += vx;
          point.y += vy + CONNECTION_GRAVITY;
        });
        for (let i = 0; i < CONNECTION_ITERATIONS; i += 1) {
          runtime.constraints.forEach((constraint) => {
            const p1 = runtime.points[constraint.p1];
            const p2 = runtime.points[constraint.p2];
            if (!p1 || !p2) return;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy) || 0.0001;
            const difference = constraint.length - dist;
            const percent = difference / dist / 2;
            const offsetX = dx * percent;
            const offsetY = dy * percent;
            if (!p1.pinned) {
              p1.x -= offsetX;
              p1.y -= offsetY;
            }
            if (!p2.pinned) {
              p2.x += offsetX;
              p2.y += offsetY;
            }
          });
        }

        let path = `M ${runtime.points[0]?.x ?? 0} ${runtime.points[0]?.y ?? 0}`;
        for (let i = 1; i < runtime.points.length - 1; i += 1) {
          const p = runtime.points[i];
          const n = runtime.points[i + 1];
          if (!p || !n) continue;
          const cx = (p.x + n.x) / 2;
          const cy = (p.y + n.y) / 2;
          path += ` Q ${p.x} ${p.y}, ${cx} ${cy}`;
        }
        const penultimate = runtime.points[runtime.points.length - 2];
        if (penultimate && last) {
          path += ` Q ${penultimate.x} ${penultimate.y}, ${last.x} ${last.y}`;
        }
        nextPaths[connection.id] = path;
      });
      Object.keys(runtimeById).forEach((id) => {
        if (!activeIds.has(id)) delete runtimeById[id];
      });
      setConnectionPaths(nextPaths);
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const activeSpace = graph.spaces[activeSpaceId] ?? graph.spaces[graph.rootSpaceId];
  const visibleEntityIds = activeSpace?.entityIds ?? [];
  const visibleEntities = useMemo(
    () =>
      visibleEntityIds
        .map((id) => graph.entities[id])
        .filter((entity): entity is CanvasEntity => !!entity),
    [graph.entities, visibleEntityIds],
  );
  const visibleConnections = useMemo(
    () =>
      Object.values(graph.connections).filter((connection) => {
        const source = graph.entities[connection.sourceEntityId];
        const target = graph.entities[connection.targetEntityId];
        if (!source || !target) return false;
        return !!source.slots[activeSpaceId] && !!target.slots[activeSpaceId];
      }),
    [activeSpaceId, graph.connections, graph.entities],
  );

  const parentSpaceId = activeSpace?.parentSpaceId ?? null;

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const out: PaletteItem[] = [];
    for (const entity of Object.values(graph.entities)) {
      const slotSpaceIds = Object.keys(entity.slots);
      if (slotSpaceIds.length === 0) continue;
      const preferredSpaceId =
        slotSpaceIds.includes(activeSpaceId) ? activeSpaceId : slotSpaceIds[0]!;
      const space = graph.spaces[preferredSpaceId];
      if (!space) continue;
      const snippet =
        entity.kind === "content"
          ? entity.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180)
          : undefined;
      out.push({
        id: entity.id,
        title: entity.title || "Untitled",
        itemType: entity.kind === "folder" ? "folder" : entity.theme === "task" ? "checklist" : entity.theme,
        entityType: null,
        spaceId: preferredSpaceId,
        spaceName: space.name,
        snippet,
      });
    }
    return out;
  }, [activeSpaceId, graph.entities, graph.spaces]);

  const paletteSpaces = useMemo<PaletteSpace[]>(() => {
    return Object.values(graph.spaces).map((space) => {
      const path = buildPathToSpace(space.id, graph.spaces, graph.rootSpaceId)
        .map((id) => (id === graph.rootSpaceId ? "Root" : graph.spaces[id]?.name ?? "Unknown"))
        .join(" / ");
      return { id: space.id, name: space.name, pathLabel: path };
    });
  }, [graph.rootSpaceId, graph.spaces]);

  const [parentExitRail, setParentExitRail] = useState({ top: 24, height: 40 });
  const syncParentExitRail = useCallback(() => {
    const stack = shellTopLeftStackRef.current;
    if (!stack) return;
    const r = stack.getBoundingClientRect();
    setParentExitRail({
      top: Math.round(r.top),
      height: Math.max(Math.round(r.height), 32),
    });
  }, []);

  useLayoutEffect(() => {
    syncParentExitRail();
    const node = shellTopLeftStackRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => syncParentExitRail());
    ro.observe(node);
    return () => ro.disconnect();
  }, [
    navigationPath,
    activeSpaceId,
    parentSpaceId,
    selectedNodeIds.length,
    syncParentExitRail,
  ]);

  useLayoutEffect(() => {
    if (draggedNodeIds.length > 0) syncParentExitRail();
  }, [draggedNodeIds.length, syncParentExitRail]);

  useEffect(() => {
    window.addEventListener("resize", syncParentExitRail);
    return () => window.removeEventListener("resize", syncParentExitRail);
  }, [syncParentExitRail]);

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
      const normalizedHtml = normalizeChecklistMarkup(html, {
        taskItem: styles.taskItem,
        taskCheckbox: styles.taskCheckbox,
        taskText: styles.taskText,
        done: styles.done,
      });
      queueGraphCommit(
        `content-body:${id}`,
        () => {
          const prev = graphRef.current;
          const entity = prev.entities[id];
          if (!entity || entity.kind !== "content") return;
          if (entity.bodyHtml === normalizedHtml) return;
          recordUndoBeforeMutation();
          setGraph((p) => {
            const e = p.entities[id];
            if (!e || e.kind !== "content") return p;
            if (e.bodyHtml === normalizedHtml) return p;
            return {
              ...p,
              entities: {
                ...p.entities,
                [id]: { ...e, bodyHtml: normalizedHtml },
              },
            };
          });
        },
        options?.immediate ? 0 : 120,
      );
    },
    [queueGraphCommit, recordUndoBeforeMutation],
  );

  const onArchitecturalMediaFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      const pending = pendingMediaUploadRef.current;
      pendingMediaUploadRef.current = null;
      if (!file || !file.type.startsWith("image/") || !pending) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const alt =
          file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() ||
          "Uploaded image";
        if (pending.mode === "focus") {
          setFocusBody((prev) =>
            applyImageDataUrlToArchitecturalMediaBody(
              prev,
              dataUrl,
              alt,
              styles.mediaImage,
            ),
          );
          return;
        }
        const entity = graphRef.current.entities[pending.id];
        if (!entity || entity.kind !== "content") return;
        updateNodeBody(
          pending.id,
          applyImageDataUrlToArchitecturalMediaBody(
            entity.bodyHtml,
            dataUrl,
            alt,
            styles.mediaImage,
          ),
          { immediate: true },
        );
      };
      reader.readAsDataURL(file);
    },
    [updateNodeBody],
  );

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const stopCaretDriftOnButton = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest("[data-architectural-media-upload]");
      if (t) e.preventDefault();
    };
    const onUploadClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest("[data-architectural-media-upload]");
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      const ownerFromBtn = t.getAttribute("data-media-owner-id");
      if (ownerFromBtn) {
        pendingMediaUploadRef.current = { mode: "canvas", id: ownerFromBtn };
        mediaFileInputRef.current?.click();
        return;
      }
      const inFocusBody = t.closest("[data-focus-body-editor]");
      const nodeHost = t.closest("[data-node-id]");
      if (inFocusBody && focusOpenRef.current && activeNodeIdRef.current) {
        pendingMediaUploadRef.current = {
          mode: "focus",
          id: activeNodeIdRef.current,
        };
      } else if (nodeHost?.dataset.nodeId) {
        pendingMediaUploadRef.current = {
          mode: "canvas",
          id: nodeHost.dataset.nodeId,
        };
      } else {
        return;
      }
      mediaFileInputRef.current?.click();
    };
    shell.addEventListener("mousedown", stopCaretDriftOnButton, true);
    shell.addEventListener("click", onUploadClick, true);
    return () => {
      shell.removeEventListener("mousedown", stopCaretDriftOnButton, true);
      shell.removeEventListener("click", onUploadClick, true);
    };
  }, []);

  const openFocusMode = useCallback((id: string) => {
    const entity = graph.entities[id];
    if (!entity || entity.kind !== "content") return;
    const spaceId = Object.keys(entity.slots)[0] ?? activeSpaceIdRef.current;
    const spaceName = graph.spaces[spaceId]?.name ?? "Unknown";
    pushRecentItem({
      id: entity.id,
      title: entity.title,
      itemType: entity.theme === "task" ? "checklist" : entity.theme,
      spaceId,
      spaceName,
    });
    const normalizedBody =
      entity.theme === "task"
        ? normalizeChecklistMarkup(entity.bodyHtml, {
            taskItem: styles.taskItem,
            taskCheckbox: styles.taskCheckbox,
            taskText: styles.taskText,
            done: styles.done,
          })
        : entity.bodyHtml;
    setActiveNodeId(id);
    setFocusTitle(entity.title);
    setFocusBody(normalizedBody);
    setFocusBaselineTitle(entity.title);
    setFocusBaselineBody(normalizedBody);
    setFocusCodeTheme(entity.theme === "code");
    setFocusOpen(true);
  }, [graph.entities, graph.spaces, pushRecentItem]);

  const closeMediaGallery = useCallback(() => {
    setGalleryOpen(false);
    setGalleryNodeId(null);
    setGalleryDraftTitle("");
    setGalleryDraftNotes("");
    setGalleryBaselineTitle("");
    setGalleryBaselineNotes("");
  }, []);

  const openMediaGallery = useCallback((id: string) => {
    const entity = graph.entities[id];
    if (!entity || entity.kind !== "content" || entity.theme !== "media") return;
    const notes = getArchitecturalMediaNotes(entity.bodyHtml);
    setGalleryNodeId(id);
    setGalleryDraftTitle(entity.title);
    setGalleryDraftNotes(notes);
    setGalleryBaselineTitle(entity.title);
    setGalleryBaselineNotes(notes);
    setGalleryOpen(true);
  }, [graph.entities]);

  const saveGalleryAndClose = useCallback(() => {
    if (!galleryNodeId) return;
    const entity = graphRef.current.entities[galleryNodeId];
    if (!entity || entity.kind !== "content" || entity.theme !== "media") {
      closeMediaGallery();
      return;
    }
    const nextTitle = normalizedFocusTitle(galleryDraftTitle);
    const nextBody = setArchitecturalMediaNotes(entity.bodyHtml, galleryDraftNotes);
    if (entity.title === nextTitle && entity.bodyHtml === nextBody) {
      closeMediaGallery();
      return;
    }
    recordUndoBeforeMutation();
    setGraph((prev) => {
      const e = prev.entities[galleryNodeId];
      if (!e || e.kind !== "content") return prev;
      return {
        ...prev,
        entities: {
          ...prev.entities,
          [galleryNodeId]: {
            ...e,
            title: nextTitle,
            bodyHtml: setArchitecturalMediaNotes(e.bodyHtml, galleryDraftNotes),
          },
        },
      };
    });
    closeMediaGallery();
  }, [
    closeMediaGallery,
    galleryDraftNotes,
    galleryDraftTitle,
    galleryNodeId,
    recordUndoBeforeMutation,
  ]);

  const handleNodeExpand = useCallback(
    (id: string) => {
      const entity = graph.entities[id];
      if (!entity || entity.kind !== "content") return;
      if (entity.theme === "media") openMediaGallery(id);
      else openFocusMode(id);
    },
    [graph.entities, openFocusMode, openMediaGallery],
  );

  useEffect(() => {
    if (!galleryOpen || !galleryNodeId) return;
    const e = graph.entities[galleryNodeId];
    if (!e || e.kind !== "content" || e.theme !== "media") {
      closeMediaGallery();
    }
  }, [closeMediaGallery, galleryNodeId, galleryOpen, graph.entities]);

  const saveFocusAndClose = useCallback(() => {
    const normalizedFocusBody = normalizeChecklistMarkup(focusBody, {
      taskItem: styles.taskItem,
      taskCheckbox: styles.taskCheckbox,
      taskText: styles.taskText,
      done: styles.done,
    });
    if (activeNodeId) {
      const entity = graphRef.current.entities[activeNodeId];
      if (entity && entity.kind === "content") {
        const nextTitle = focusTitle.trim() || "Untitled";
        if (entity.title !== nextTitle || entity.bodyHtml !== normalizedFocusBody) {
          recordUndoBeforeMutation();
        }
      }
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
              bodyHtml: normalizedFocusBody,
            },
          },
        };
      });
    }
    setFocusOpen(false);
    setActiveNodeId(null);
  }, [activeNodeId, focusBody, focusTitle, recordUndoBeforeMutation]);

  const discardFocusAndClose = useCallback(() => {
    setFocusOpen(false);
    setActiveNodeId(null);
  }, []);

  const focusDirty = useMemo(
    () =>
      normalizedFocusTitle(focusTitle) !== normalizedFocusTitle(focusBaselineTitle) ||
      focusBody !== focusBaselineBody,
    [focusTitle, focusBody, focusBaselineTitle, focusBaselineBody],
  );

  const galleryDirty = useMemo(
    () =>
      !!galleryOpen &&
      !!galleryNodeId &&
      (normalizedFocusTitle(galleryDraftTitle) !== normalizedFocusTitle(galleryBaselineTitle) ||
        galleryDraftNotes !== galleryBaselineNotes),
    [
      galleryBaselineNotes,
      galleryBaselineTitle,
      galleryDraftNotes,
      galleryDraftTitle,
      galleryNodeId,
      galleryOpen,
    ],
  );

  const onFocusOverlayPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!focusOpen) return;
      const t = event.target as HTMLElement;
      if (t.closest(`.${styles.focusSheet}`)) return;
      if (t.closest(`.${styles.focusBottomDock}`)) return;
      event.preventDefault();
      event.stopPropagation();
    },
    [focusOpen],
  );

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

  const connectionPinView = useMemo<ConnectionPinViewContext>(
    () => ({ tx: translateX, ty: translateY, scale }),
    [translateX, translateY, scale],
  );

  useEffect(() => {
    const freshGraph = buildArchitecturalSeedGraph(
      {
        taskItem: styles.taskItem,
        done: styles.done,
        taskCheckbox: styles.taskCheckbox,
        taskText: styles.taskText,
        mediaFrame: styles.mediaFrame,
        mediaImage: styles.mediaImage,
        mediaImageActions: styles.mediaImageActions,
        mediaUploadBtn: styles.mediaUploadBtn,
      },
      scenario,
    );
    setGraph(freshGraph);
    setActiveSpaceId(freshGraph.rootSpaceId);
    setNavigationPath([freshGraph.rootSpaceId]);
    setSelectedNodeIds([]);
    setConnectionSourceId(null);
    setConnectionMode("move");
    setFocusOpen(false);
    setActiveNodeId(null);
    undoPastRef.current = [];
    undoFutureRef.current = [];
    setHistoryEpoch((n) => n + 1);
  }, [scenario]);

  useLayoutEffect(() => {
    // Apply camera before first paint so we never flash translate 0,0 (especially
    // noticeable when seed content sits far from the origin).
    setTranslateX(window.innerWidth / 2);
    setTranslateY(window.innerHeight / 2);
    setViewportSize({ width: window.innerWidth, height: window.innerHeight });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCanvasSurfaceReady(true);
    }

    const onResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    const reveal = () => {
      if (!cancelled) setCanvasSurfaceReady(true);
    };
    const hardCapMs = 1400;
    const capTimer = window.setTimeout(reveal, hardCapMs);

    void (async () => {
      try {
        await document.fonts?.ready;
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.clearTimeout(capTimer);
          reveal();
        });
      });
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(capTimer);
    };
  }, []);

  const centerCoords = useCallback(() => {
    return {
      x: (window.innerWidth / 2 - translateX) / scale,
      y: (window.innerHeight / 2 - translateY) / scale,
    };
  }, [scale, translateX, translateY]);

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
    const vis = visibleEntityIds;
    const ids = selectedNodeIdsRef.current.filter((id) => {
      const entity = graphRef.current.entities[id];
      return !!entity && entity.kind === "content" && vis.includes(id);
    });
    if (ids.length < 2) return;
    recordUndoBeforeMutation();
    const stackId = createId("stack");
    setGraph((prev) => {
      const next = shallowCloneGraph(prev);
      const slots = ids
        .map((id) => next.entities[id]?.slots[activeSpaceId])
        .filter((s): s is { x: number; y: number } => !!s);
      if (slots.length === 0) return prev;
      /* One shared slot for the stack (matches drop-onto-target stacking). Top-left of the pile
         keeps the collapsed container aligned with `resolveConnectionPin` + thread endpoints. */
      const anchorX = Math.min(...slots.map((s) => s.x));
      const anchorY = Math.min(...slots.map((s) => s.y));
      ids.forEach((id, index) => {
        const entity = next.entities[id];
        if (!entity || entity.kind !== "content") return;
        next.entities[id] = {
          ...entity,
          stackId,
          stackOrder: index,
          slots: {
            ...entity.slots,
            [activeSpaceId]: { x: anchorX, y: anchorY },
          },
        };
      });
      return next;
    });
    setSelectedNodeIds(ids);
  }, [activeSpaceId, createId, recordUndoBeforeMutation, visibleEntityIds]);

  const unstackGroup = useCallback((stackId: string) => {
    recordUndoBeforeMutation();
    setGraph((prev) => {
      const next = shallowCloneGraph(prev);
      const members = Object.values(next.entities)
        .filter(
          (entity): entity is Extract<CanvasEntity, { kind: "content" }> =>
            entity.kind === "content" && entity.stackId === stackId,
        )
        .sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0));
      if (members.length === 0) return prev;

      const anchor =
        members[members.length - 1]?.slots[activeSpaceId] ??
        members[0]?.slots[activeSpaceId] ?? { x: 0, y: 0 };
      const cols = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(members.length))));
      const spacingX = 72;
      const spacingY = 64;

      members.forEach((entity, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const centeredCol = col - (cols - 1) / 2;
        next.entities[entity.id] = {
          ...entity,
          stackId: null,
          stackOrder: null,
          slots: {
            ...entity.slots,
            [activeSpaceId]: {
              x: Math.round(anchor.x + centeredCol * spacingX),
              y: Math.round(anchor.y + row * spacingY),
            },
          },
        };
      });
      return next;
    });
  }, [activeSpaceId, recordUndoBeforeMutation]);

  const ensureFolderChildSpace = useCallback(
    (folderId: string): string | null => {
      const folderEarly = graphRef.current.entities[folderId];
      if (!folderEarly || folderEarly.kind !== "folder") return null;
      if (graphRef.current.spaces[folderEarly.childSpaceId]) {
        return folderEarly.childSpaceId;
      }
      recordUndoBeforeMutation();
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
    [activeSpaceId, createId, recordUndoBeforeMutation],
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
      options?: { anchor?: { x: number; y: number }; forceLayout?: boolean; skipUndo?: boolean },
    ) => {
      if (!options?.skipUndo) {
        recordUndoBeforeMutation();
      }
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
    [canMoveEntityToSpace, recordUndoBeforeMutation],
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

  const focusEntityFromPalette = useCallback(
    (entityId: string, openInFocus = false) => {
      const graphSnap = graphRef.current;
      const entity = graphSnap.entities[entityId];
      if (!entity) return;
      const candidateSpaceIds = Object.keys(entity.slots);
      let targetSpaceId = activeSpaceIdRef.current;
      if (!entity.slots[targetSpaceId]) {
        targetSpaceId = candidateSpaceIds[0] ?? targetSpaceId;
      }
      if (!graphSnap.spaces[targetSpaceId]) return;
      if (targetSpaceId !== activeSpaceIdRef.current) {
        setActiveSpaceId(targetSpaceId);
        setNavigationPath(buildPathToSpace(targetSpaceId, graphSnap.spaces, graphSnap.rootSpaceId));
      }
      const slot = entity.slots[targetSpaceId];
      if (slot) {
        const viewport = viewportRef.current?.getBoundingClientRect();
        const width = viewport?.width ?? window.innerWidth;
        const height = viewport?.height ?? window.innerHeight;
        const nextScale = viewRef.current.scale;
        setTranslateX(width / 2 - slot.x * nextScale);
        setTranslateY(height / 2 - slot.y * nextScale);
      }
      setSelectedNodeIds([entityId]);
      if (openInFocus && entity.kind === "content") {
        openFocusMode(entityId);
      }
    },
    [openFocusMode],
  );

  const paletteActions = useMemo<PaletteAction[]>(
    () => [
      { id: "create-note", label: "Create note", hint: "Add a new note at center", icon: <FileText size={14} weight="bold" /> },
      { id: "create-checklist", label: "Create checklist", hint: "Add a checklist card", icon: <NotePencil size={14} weight="bold" /> },
      { id: "create-media", label: "Create image card", hint: "Add a media card", icon: <SquaresFour size={14} weight="bold" /> },
      { id: "create-folder", label: "Create folder", hint: "Add folder and child space", icon: <Folder size={14} weight="bold" /> },
      { id: "export-json", label: "Export graph JSON", hint: "Download the current graph", icon: <DownloadSimple size={14} weight="bold" /> },
      { id: "toggle-theme", label: "Toggle theme", hint: "Switch light/dark shell class", icon: <CopySimple size={14} weight="bold" /> },
      { id: "zoom-fit", label: "Zoom to fit", hint: "Fit visible cards into the viewport", icon: <SquaresFour size={14} weight="bold" /> },
      { id: "recenter", label: "Recenter canvas", hint: modKeyHints.recenter, icon: <Stack size={14} weight="bold" /> },
    ],
    [modKeyHints.recenter],
  );

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

  const moveSelectionToParent = useCallback(() => {
    if (Date.now() < suppressParentExitActivateUntilRef.current) return;
    if (!parentSpaceId) return;
    const idsToMove = selectedNodeIds.filter((entityId) => visibleEntityIds.includes(entityId));
    if (idsToMove.length === 0) return;
    if (!idsToMove.every((id) => canMoveEntityToSpace(id, parentSpaceId))) return;
    const center = centerCoords();
    const fallback = { x: center.x - 180, y: center.y - 120 };
    const anchorBelowFolder = getParentFolderExitSlot(0) ?? fallback;
    moveEntitiesToSpace(idsToMove, parentSpaceId, {
      anchor: anchorBelowFolder,
      forceLayout: true,
    });
  }, [
    canMoveEntityToSpace,
    centerCoords,
    getParentFolderExitSlot,
    moveEntitiesToSpace,
    parentSpaceId,
    selectedNodeIds,
    visibleEntityIds,
  ]);

  const renameFolder = useCallback(
    (entityId: string, title: string) => {
      queueGraphCommit(
        `folder-title:${entityId}`,
        () => {
          const prev = graphRef.current;
          const entity = prev.entities[entityId];
          if (!entity || entity.kind !== "folder") return;
          const nextTitle = title.trim() || "Untitled Folder";
          if (entity.title === nextTitle) return;
          recordUndoBeforeMutation();
          setGraph((p) => {
            const ent = p.entities[entityId];
            if (!ent || ent.kind !== "folder") return p;
            const next = shallowCloneGraph(p);
            const t = title.trim() || "Untitled Folder";
            if (ent.title === t) return p;
            next.entities[entityId] = {
              ...ent,
              title: t,
            };
            if (next.spaces[ent.childSpaceId]) {
              next.spaces[ent.childSpaceId] = {
                ...next.spaces[ent.childSpaceId],
                name: t,
              };
            }
            return next;
          });
        },
        120,
      );
    },
    [queueGraphCommit, recordUndoBeforeMutation],
  );

  const setFolderColorScheme = useCallback(
    (entityId: string, scheme: FolderColorSchemeId | null) => {
      queueGraphCommit(
        `folder-scheme:${entityId}`,
        () => {
          const prev = graphRef.current;
          const entity = prev.entities[entityId];
          if (!entity || entity.kind !== "folder") return;
          if (scheme == null && entity.folderColorScheme == null) return;
          if (scheme != null && entity.folderColorScheme === scheme) return;
          recordUndoBeforeMutation();
          setGraph((p) => {
            const ent = p.entities[entityId];
            if (!ent || ent.kind !== "folder") return p;
            const next = shallowCloneGraph(p);
            if (scheme == null) {
              const updated = { ...ent };
              delete updated.folderColorScheme;
              next.entities[entityId] = updated;
            } else {
              next.entities[entityId] = { ...ent, folderColorScheme: scheme };
            }
            return next;
          });
        },
        120,
      );
    },
    [queueGraphCommit, recordUndoBeforeMutation],
  );

  const renameContentEntity = useCallback(
    (entityId: string, title: string) => {
      queueGraphCommit(
        `content-title:${entityId}`,
        () => {
          const prev = graphRef.current;
          const entity = prev.entities[entityId];
          if (!entity || entity.kind !== "content") return;
          const nextTitle = title.trim() || "Untitled";
          if (entity.title === nextTitle) return;
          recordUndoBeforeMutation();
          setGraph((p) => {
            const ent = p.entities[entityId];
            if (!ent || ent.kind !== "content") return p;
            const t = title.trim() || "Untitled";
            if (ent.title === t) return p;
            const next = shallowCloneGraph(p);
            next.entities[entityId] = { ...ent, title: t };
            return next;
          });
        },
        120,
      );
    },
    [queueGraphCommit, recordUndoBeforeMutation],
  );

  const folderColorPickerForDock = useMemo(() => {
    if (focusOpen || galleryOpen) return null;
    if (selectedNodeIds.length !== 1) return null;
    const id = selectedNodeIds[0]!;
    const e = graph.entities[id];
    if (!e || e.kind !== "folder") return null;
    return {
      value: e.folderColorScheme ?? null,
      onChange: (next: FolderColorSchemeId | null) => setFolderColorScheme(id, next),
    };
  }, [focusOpen, galleryOpen, graph.entities, selectedNodeIds, setFolderColorScheme]);

  const createNewNode = useCallback((type: NodeTheme) => {
    recordUndoBeforeMutation();
    const center = centerCoords();
    const x = center.x - 170 + (Math.random() * 60 - 30);
    const y = center.y - 100 + (Math.random() * 60 - 30);
    const rotation = (Math.random() - 0.5) * 4;
    const tapeRotation = (Math.random() - 0.5) * 6;
    setMaxZIndex((prev) => prev + 1);

    if (type === "folder") {
      const entityId = createId("folder");
      const childSpaceId = createId("space");
      const fx = center.x - FOLDER_CARD_WIDTH / 2 + (Math.random() * 60 - 30);
      const fy = center.y - FOLDER_CARD_HEIGHT / 2 + (Math.random() * 60 - 30);
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
          width: FOLDER_CARD_WIDTH,
          tapeRotation: 0,
          stackId: null,
          stackOrder: null,
          slots: {
            [activeSpaceId]: { x: fx, y: fy },
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
    let contentTheme: ContentTheme =
      type === "task" ? "default" : (type as ContentTheme);
    let bodyHtml = `<div contenteditable="true">Start typing...</div>`;

    if (type === "task") {
      title = "Checklist";
      bodyHtml = `
        <div class="${styles.taskItem}" contenteditable="false">
          <div class="${styles.taskCheckbox}" contenteditable="false"></div>
          <div class="${styles.taskText}" contenteditable="true">Clarify objective and acceptance criteria</div>
        </div>
        <div class="${styles.taskItem}" contenteditable="false">
          <div class="${styles.taskCheckbox}" contenteditable="false"></div>
          <div class="${styles.taskText}" contenteditable="true">Break work into two focused steps</div>
        </div>
      `;
    } else if (type === "code") {
      title = "Snippet";
      contentTheme = "code";
      bodyHtml = `// [IN] Compose shard at cursor…`;
    } else if (type === "media") {
      title = "Untitled photo";
      contentTheme = "media";
      bodyHtml = `
        <div class="${styles.mediaFrame}" data-architectural-media-root="true">
          <div class="${styles.mediaPlaceholder}" data-architectural-media-fallback="true">Upload an image</div>
          <div class="${styles.mediaImageActions}" contenteditable="false">
            <button type="button" class="${styles.mediaUploadBtn}" data-architectural-media-upload="true">Upload</button>
          </div>
        </div>
        <div data-architectural-media-notes="true"></div>
      `;
    }

    const nextNode = {
      id,
      title,
      kind: "content" as const,
      rotation,
      width,
      theme: contentTheme,
      tapeVariant: tapeVariantForTheme(contentTheme),
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
  }, [activeSpaceId, centerCoords, createId, recordUndoBeforeMutation]);

  const runPaletteAction = useCallback((actionId: string) => {
    if (actionId === "create-note") {
      createNewNode("default");
      return;
    }
    if (actionId === "create-checklist") {
      createNewNode("task");
      return;
    }
    if (actionId === "create-media") {
      createNewNode("media");
      return;
    }
    if (actionId === "create-folder") {
      createNewNode("folder");
      return;
    }
    if (actionId === "export-json") {
      const data = JSON.stringify(graphRef.current, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vigil-graph-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (actionId === "toggle-theme") {
      const html = document.documentElement;
      html.classList.toggle("dark");
      html.dataset.vigilTheme = html.classList.contains("dark") ? "dark" : "light";
      return;
    }
    if (actionId === "zoom-fit") {
      const ids = activeSpace?.entityIds ?? [];
      if (ids.length === 0) {
        recenterToOrigin();
        return;
      }
      const slots = ids
        .map((id) => graphRef.current.entities[id]?.slots[activeSpaceIdRef.current])
        .filter((slot): slot is { x: number; y: number } => !!slot);
      if (slots.length === 0) {
        recenterToOrigin();
        return;
      }
      const minX = Math.min(...slots.map((slot) => slot.x));
      const minY = Math.min(...slots.map((slot) => slot.y));
      const maxX = Math.max(...slots.map((slot) => slot.x + UNIFIED_NODE_WIDTH));
      const maxY = Math.max(...slots.map((slot) => slot.y + 260));
      const viewport = viewportRef.current?.getBoundingClientRect();
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const pad = 120;
      const nextScale = Math.max(
        MIN_ZOOM,
        Math.min(
          MAX_ZOOM,
          Math.min((width - pad) / Math.max(1, maxX - minX), (height - pad) / Math.max(1, maxY - minY)),
        ),
      );
      setScale(nextScale);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      setTranslateX(width / 2 - centerX * nextScale);
      setTranslateY(height / 2 - centerY * nextScale);
      return;
    }
    if (actionId === "recenter") {
      recenterToOrigin();
    }
  }, [activeSpace?.entityIds, createNewNode, recenterToOrigin]);

  const updateDropTargets = useCallback(
    (draggedEntityId: string, pointerClientX?: number, pointerClientY?: number) => {
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
        setParentDropHover(false);
        return;
      }
      const rect = parentTarget.getBoundingClientRect();
      /** Parent strip is chrome-adjacent and thin; use the live pointer (not card center). */
      const pad = 28;
      const left = rect.left - pad;
      const right = rect.right + pad;
      const top = rect.top - pad;
      const bottom = rect.bottom + pad;
      let inParent = false;
      if (pointerClientX != null && pointerClientY != null) {
        inParent =
          pointerClientX >= left &&
          pointerClientX <= right &&
          pointerClientY >= top &&
          pointerClientY <= bottom;
      }
      if (!inParent) {
        inParent =
          centerX >= left &&
          centerX <= right &&
          centerY >= top &&
          centerY <= bottom;
      }
      setParentDropHover(inParent);
    },
    [canMoveEntityToSpace, graph.entities, graph.spaces, parentSpaceId, setParentDropHover],
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
        const targetSlot = targetEntity.slots[activeSpaceId];
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
            slots: targetSlot
              ? {
                  ...entity.slots,
                  [activeSpaceId]: { x: targetSlot.x, y: targetSlot.y },
                }
              : entity.slots,
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
    [activeSpaceId, createId, graph.entities, normalizeStack],
  );

  const handleDrop = useCallback(
    (draggedEntityIds: string[]) => {
      if (draggedEntityIds.length === 0) return;
      const center = centerCoords();
      const fallback = { x: center.x - 180, y: center.y - 120 };

      if (parentDropHoveredRef.current && parentSpaceId) {
        const anchorBelowFolder = getParentFolderExitSlot(0) ?? fallback;
        moveEntitiesToSpace(draggedEntityIds, parentSpaceId, {
          anchor: anchorBelowFolder,
          forceLayout: true,
          skipUndo: true,
        });
        suppressParentExitActivateUntilRef.current = Date.now() + 500;
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
              skipUndo: true,
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
      parentSpaceId,
      stackEntitiesOntoTarget,
    ],
  );

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (lassoStartRef.current) {
        const start = lassoStartRef.current;
        const next: LassoRectScreen = {
          x1: start.x,
          y1: start.y,
          x2: event.clientX,
          y2: event.clientY,
        };
        lassoRectScreenRef.current = next;
        setLassoRectScreen(next);
        return;
      }

      if (isPanningRef.current) {
        setTranslateX(event.clientX - panStartRef.current.x);
        setTranslateY(event.clientY - panStartRef.current.y);
      }

      const draggedIds = draggedNodeIdsRef.current;
      if (draggedIds.length === 0) return;
      dragPointerScreenRef.current = { x: event.clientX, y: event.clientY };
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
          const currentSlot = entity.slots[activeSpaceId];
          if (!currentSlot) return;
          const nextX = mouseCanvasX - offset.x;
          const nextY = mouseCanvasY - offset.y;
          if (Math.abs(currentSlot.x - nextX) < 0.001 && Math.abs(currentSlot.y - nextY) < 0.001) {
            return;
          }
          changed = true;
          nextEntities[id] = {
            ...entity,
            slots: {
              ...entity.slots,
              [activeSpaceId]: {
                x: nextX,
                y: nextY,
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
      updateDropTargets(draggedIds[0], event.clientX, event.clientY);
    };

    const onMouseUp = () => {
      if (lassoStartRef.current) {
        const start = lassoStartRef.current;
        const rect: LassoRectScreen =
          lassoRectScreenRef.current ?? {
            x1: start.x,
            y1: start.y,
            x2: start.x,
            y2: start.y,
          };
        lassoStartRef.current = null;
        lassoRectScreenRef.current = null;
        setLassoRectScreen(null);

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

      isPanningRef.current = false;
      setIsPanning(false);
      if (draggedNodeIdsRef.current.length > 0) {
        const ids = draggedNodeIdsRef.current;
        updateDropTargets(ids[0], dragPointerScreenRef.current.x, dragPointerScreenRef.current.y);
        handleDrop(ids);
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
      setParentDropHover(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [activeSpaceId, handleDrop, scale, translateX, translateY, updateDropTargets]);

  useEffect(() => {
    if (!stackModal) return;

    const getVisibleOrdered = (orderedIds: string[]) =>
      orderedIds.slice(0, STACK_MODAL_MAX_ITEMS);

    const getHullBounds = (orderedIds: string[]) => {
      const cardHeights = stackModalCardHeightsRef.current;
      const layout = buildStackModalLayout(orderedIds, viewportSize, cardHeights);
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      orderedIds.forEach((id) => {
        const slot = layout[id];
        if (!slot) return;
        const cardW = STACK_MODAL_CARD_W * slot.scale;
        const cardH = (cardHeights[id] ?? STACK_MODAL_CARD_H_ESTIMATE) * slot.scale;
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
      const cardHeights = stackModalCardHeightsRef.current;
      const layout = buildStackModalLayout(orderedIds, viewportSize, cardHeights);
      const slot = layout[drag.entityId];
      const slotScale = slot?.scale ?? 1;
      const width = STACK_MODAL_CARD_W * slotScale;
      const height =
        (cardHeights[drag.entityId] ?? STACK_MODAL_CARD_H_ESTIMATE) * slotScale;
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
      const prev = stackDragRef.current;
      if (!prev) return;

      const dx = event.clientX - prev.startX;
      const dy = event.clientY - prev.startY;
      const intent =
        Math.abs(dx) > 10 || Math.abs(dy) > 10 ? "reorder" : prev.intent;

      const hullOrdered =
        stackDragHullOrderedIdsRef.current ??
        getVisibleOrdered(stackModalRef.current?.orderedIds ?? []);

      const outsideWithMargin = isDraggedOutsideHull(
        {
          entityId: prev.entityId,
          currentX: event.clientX,
          currentY: event.clientY,
          pointerOffsetX: prev.pointerOffsetX,
          pointerOffsetY: prev.pointerOffsetY,
        },
        hullOrdered,
      );

      if (intent === "reorder" && outsideWithMargin) {
        stackEjectTouchedOutsideRef.current = true;
      }
      if (stackEjectTouchedOutsideRef.current && !outsideWithMargin) {
        stackBlockLiveReorderRef.current = true;
      }

      const nextEject = outsideWithMargin && intent === "reorder";
      if (nextEject !== lastStackEjectPreviewRef.current) {
        lastStackEjectPreviewRef.current = nextEject;
        setStackModalEjectPreview(nextEject);
      }

      if (
        intent === "reorder" &&
        !outsideWithMargin &&
        !stackBlockLiveReorderRef.current
      ) {
        setStackModal((prevModal) => {
          if (!prevModal) return prevModal;
          const visibleOrdered = [...getVisibleOrdered(prevModal.orderedIds)];
          const from = visibleOrdered.indexOf(prev.entityId);
          if (from < 0) return prevModal;
          const cardHeights = stackModalCardHeightsRef.current;
          const layout = buildStackModalLayout(visibleOrdered, viewportSize, cardHeights);
          const swapWith = visibleOrdered.findIndex((id) => {
            if (id === prev.entityId) return false;
            const slot = layout[id];
            if (!slot) return false;
            const width = STACK_MODAL_CARD_W * slot.scale;
            const height = (cardHeights[id] ?? STACK_MODAL_CARD_H_ESTIMATE) * slot.scale;
            return (
              event.clientX >= slot.x &&
              event.clientX <= slot.x + width &&
              event.clientY >= slot.y &&
              event.clientY <= slot.y + height
            );
          });
          if (swapWith < 0 || swapWith === from) return prevModal;
          const nextVisible = [...visibleOrdered];
          const swapItem = nextVisible[from];
          nextVisible[from] = nextVisible[swapWith];
          nextVisible[swapWith] = swapItem;
          const hiddenOrdered = prevModal.orderedIds.slice(STACK_MODAL_MAX_ITEMS);
          const nextOrdered = [...nextVisible, ...hiddenOrdered];
          stackModalOrderedIdsDuringDragRef.current = nextOrdered;
          return {
            ...prevModal,
            orderedIds: nextOrdered,
          };
        });
      }

      const nextDrag = {
        ...prev,
        currentX: event.clientX,
        currentY: event.clientY,
        intent,
      };
      stackDragRef.current = nextDrag;
      setStackDrag(nextDrag);
    };

    const onMouseUp = () => {
      const drag = stackDragRef.current;
      const hullSnap = stackDragHullOrderedIdsRef.current;
      const orderedSnap = stackModalOrderedIdsDuringDragRef.current;

      setStackDrag(null);
      stackDragRef.current = null;
      setStackModalEjectPreview(false);
      lastStackEjectPreviewRef.current = false;
      stackDragHullOrderedIdsRef.current = null;
      stackModalOrderedIdsDuringDragRef.current = null;
      stackEjectTouchedOutsideRef.current = false;
      stackBlockLiveReorderRef.current = false;

      const modal = stackModalRef.current;
      if (!drag || !modal) return;

      const hullForEject = hullSnap ?? getVisibleOrdered(modal.orderedIds);
      const outsideWithMargin = isDraggedOutsideHull(
        {
          entityId: drag.entityId,
          currentX: drag.currentX,
          currentY: drag.currentY,
          pointerOffsetX: drag.pointerOffsetX,
          pointerOffsetY: drag.pointerOffsetY,
        },
        hullForEject,
      );

      const orderedIdsForCommit = orderedSnap ?? modal.orderedIds;

      if (outsideWithMargin && drag.intent === "reorder") {
        const graphSnap = graphRef.current;
        const extracted = graphSnap.entities[drag.entityId];
        const spaceId = activeSpaceIdRef.current;
        const zi = maxZIndexRef.current;
        if (extracted) {
          const remainingOrdered = orderedIdsForCommit.filter((id) => id !== drag.entityId);
          const remaining = remainingOrdered
            .map((id) => graphSnap.entities[id])
            .filter(
              (entity): entity is CanvasEntity =>
                !!entity && entity.kind === "content" && entity.stackId === modal.stackId,
            );
          if (remaining.length >= 2) {
            const normalizedRemaining = [...remaining]
              .sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0))
              .map((entity, index) => ({
                ...entity,
                stackId: modal.stackId,
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
                  zIndex: zi + 1,
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
                  zIndex: zi + 1,
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
          const { tx, ty, scale: viewScale } = viewRef.current;
          const worldDropX = (drag.currentX - drag.pointerOffsetX - tx) / viewScale;
          const worldDropY = (drag.currentY - drag.pointerOffsetY - ty) / viewScale;
          setGraph((prev) => {
            const next = shallowCloneGraph(prev);
            const entity = next.entities[drag.entityId];
            if (!entity) return prev;
            next.entities[drag.entityId] = {
              ...entity,
              slots: {
                ...entity.slots,
                [spaceId]: {
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
        const ordered = orderedIdsForCommit;
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
  }, [closeStackModal, stackModal?.stackId, viewportSize.width, viewportSize.height]);

  useEffect(() => {
    if (connectionMode !== "draw" || !connectionSourceId) {
      setConnectionCursorWorld(null);
      return;
    }
    const onMove = (event: MouseEvent) => {
      const { tx, ty, scale: viewScale } = viewRef.current;
      setConnectionCursorWorld({
        x: (event.clientX - tx) / viewScale,
        y: (event.clientY - ty) / viewScale,
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [connectionMode, connectionSourceId]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const taskCheckbox = target.closest(`.${styles.taskCheckbox}`);
      if (taskCheckbox) {
        event.preventDefault();
        event.stopPropagation();
        const taskItem = taskCheckbox.closest(`.${styles.taskItem}`);
        if (taskItem) {
          taskItem.classList.toggle(styles.done);
          const focusBodyEl = taskCheckbox.closest<HTMLElement>("[data-focus-body-editor='true']");
          if (focusBodyEl && focusOpenRef.current && activeNodeIdRef.current) {
            const nextHtml = normalizeChecklistMarkup(focusBodyEl.innerHTML, {
              taskItem: styles.taskItem,
              taskCheckbox: styles.taskCheckbox,
              taskText: styles.taskText,
              done: styles.done,
            });
            if (focusBodyEl.innerHTML !== nextHtml) {
              focusBodyEl.innerHTML = nextHtml;
            }
            setFocusBody(nextHtml);
            return;
          }
          const owner = taskCheckbox.closest<HTMLElement>(`[data-node-id]`);
          if (owner?.dataset.nodeId) {
            const bodyEl = owner.querySelector<HTMLElement>(`.${styles.nodeBody}`);
            if (bodyEl) {
              const nextHtml = normalizeChecklistMarkup(bodyEl.innerHTML, {
                taskItem: styles.taskItem,
                taskCheckbox: styles.taskCheckbox,
                taskText: styles.taskText,
                done: styles.done,
              });
              if (bodyEl.innerHTML !== nextHtml) {
                bodyEl.innerHTML = nextHtml;
              }
              updateNodeBody(owner.dataset.nodeId, nextHtml, { immediate: true });
            }
          }
        }
        return;
      }

      const entity = target.closest<HTMLElement>(`[data-node-id]`);
      if (connectionMode !== "move") {
        if (connectionMode === "draw" && entity?.dataset.nodeId) {
          const nodeId = entity.dataset.nodeId;
          if (!nodeId) return;
          event.preventDefault();
          event.stopPropagation();
          if (!connectionSourceId) {
            setConnectionSourceId(nodeId);
          } else if (connectionSourceId === nodeId) {
            setConnectionSourceId(null);
          } else {
            createConnection(connectionSourceId, nodeId);
            setConnectionSourceId(null);
          }
          return;
        }
        if (connectionMode === "cut") {
          return;
        }
      }

      if (focusOpen || galleryOpen) return;
      if (activeTool === "pan" || spacePanRef.current) return;
      if (event.button !== 0) return;
      if (target.closest("[data-stack-container='true']")) return;
      const inContent =
        target.closest(`.${styles.nodeBody}`) ||
        target.closest(`.${styles.nodeBtn}`) ||
        target.closest(`.${styles.folderTitleInput}`) ||
        target.closest("[data-folder-open-btn='true']");

      if (entity && !inContent) {
        const nodeId = entity.dataset.nodeId;
        if (nodeId) {
          const extendSelection =
            event.shiftKey || event.ctrlKey || event.metaKey;
          if (extendSelection) {
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
            recordUndoBeforeMutation();
            setSelectedNodeIds(dragGroup);
            draggedNodeIdsRef.current = dragGroup;
            setDraggedNodeIds(dragGroup);
            dragPointerScreenRef.current = { x: event.clientX, y: event.clientY };

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

    };

    const onClick = (event: MouseEvent) => {
      if (connectionMode !== "move") return;
      const target = event.target as HTMLElement;
      const expandBtn = target.closest<HTMLElement>(`[data-expand-btn="true"]`);
      if (!expandBtn) return;
      const entity = expandBtn.closest<HTMLElement>(`[data-node-id]`);
      const id = entity?.dataset.nodeId;
      if (id) handleNodeExpand(id);
    };

    const onDoubleClick = (event: MouseEvent) => {
      const target = pointerEventTargetElement(event.target);
      if (!target) return;

      if (connectionMode === "draw" || connectionMode === "cut") {
        if (focusOpen || galleryOpen || stackModalRef.current) return;
        if (
          isCanvasPointerMarqueeOrPanSurface(
            target,
            viewportRef.current,
            styles.canvas,
            activeTool,
            false,
          )
        ) {
          event.preventDefault();
          setConnectionMode("move");
          setConnectionSourceId(null);
          setConnectionCursorWorld(null);
          const restore = selectionBeforeConnectionModeRef.current;
          if (restore) {
            setSelectedNodeIds(restore.filter((id) => !!graphRef.current.entities[id]));
          }
          selectionBeforeConnectionModeRef.current = null;
        }
        return;
      }

      if (connectionMode !== "move") return;
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

      const node = graph.entities[id];
      if (
        node?.kind === "content" &&
        node.theme === "media" &&
        target.closest("[data-image-open-gallery]")
      ) {
        handleNodeExpand(id);
        return;
      }

      const editableWithinNode =
        isEditableTarget(event.target) ||
        !!target.closest("input, textarea, select, [contenteditable='true']");
      if (editableWithinNode) {
        if (node?.kind === "content" && node.theme !== "media") {
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
    connectionMode,
    connectionSourceId,
    createConnection,
    focusOpen,
    galleryOpen,
    graph.entities,
    handleNodeExpand,
    openFocusMode,
    openFolder,
    recordUndoBeforeMutation,
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
    recordUndoBeforeMutation();
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
    if (galleryNodeId && entityIds.includes(galleryNodeId)) {
      closeMediaGallery();
    }
  }, [activeNodeId, closeMediaGallery, galleryNodeId, recordUndoBeforeMutation]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isEditableTarget(event.target)) return;

      if (galleryOpen) {
        event.preventDefault();
        closeMediaGallery();
        return;
      }

      if (focusOpen) {
        event.preventDefault();
        return;
      }

      if (stackModal) {
        event.preventDefault();
        closeStackModal();
        return;
      }

      if (draggedNodeIdsRef.current.length > 0 || lassoStartRef.current) {
        event.preventDefault();
        draggedNodeIdsRef.current = [];
        dragOffsetsRef.current = {};
        setDraggedNodeIds([]);
        lassoStartRef.current = null;
        lassoRectScreenRef.current = null;
        setLassoRectScreen(null);
        setHoveredFolderId(null);
        setHoveredStackTargetId(null);
        setParentDropHover(false);
        return;
      }

      if (parentSpaceId) {
        event.preventDefault();
        goBack();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMediaGallery, closeStackModal, focusOpen, galleryOpen, goBack, parentSpaceId, stackModal]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isDeleteKey = event.key === "Delete" || event.key === "Backspace";
      if (!isDeleteKey) return;
      if (isEditableTarget(event.target) || focusOpen || galleryOpen) return;
      if (selectedNodeIds.length === 0) return;
      event.preventDefault();
      deleteEntitySelection(selectedNodeIds);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteEntitySelection, focusOpen, galleryOpen, selectedNodeIds]);

  const onViewportMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (focusOpen || galleryOpen || stackModal) return;

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
      if (connectionMode !== "move") return;

      const target = event.target as HTMLElement;
      if (
        !isCanvasPointerMarqueeOrPanSurface(
          target,
          viewportRef.current,
          styles.canvas,
          activeTool,
          spacePanRef.current,
        )
      ) {
        return;
      }

      if (activeTool === "select" && !spacePanRef.current) {
        lassoStartRef.current = { x: event.clientX, y: event.clientY };
        const initial: LassoRectScreen = {
          x1: event.clientX,
          y1: event.clientY,
          x2: event.clientX,
          y2: event.clientY,
        };
        lassoRectScreenRef.current = initial;
        setLassoRectScreen(initial);
        return;
      }
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        x: event.clientX - translateX,
        y: event.clientY - translateY,
      };
    },
    [activeTool, connectionMode, focusOpen, galleryOpen, stackModal, translateX, translateY],
  );

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (focusOpen || galleryOpen || stackModal) return;
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
    [focusOpen, galleryOpen, stackModal, normalizeWheelDelta, updateTransformFromMouse],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target?.isContentEditable) return;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") {
        return;
      }
      if (focusOpen || galleryOpen || stackModal) return;

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
  }, [focusOpen, galleryOpen, recenterToOrigin, stackModal, zoomBy]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target?.isContentEditable) return;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") {
        return;
      }
      if (focusOpen || galleryOpen) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusOpen, galleryOpen, redo, undo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target?.isContentEditable) return;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") {
        return;
      }
      if (focusOpen || galleryOpen) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "z") return;
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
        recordUndoBeforeMutation();
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
  }, [
    focusOpen,
    galleryOpen,
    graph.entities,
    normalizeStack,
    recordUndoBeforeMutation,
    selectedNodeIds,
    stackSelectedContent,
    unstackGroup,
  ]);

  const resolveRichTextFormatTarget = useCallback((): HTMLElement | null => {
    const shell = shellRef.current;
    if (!shell) return null;
    if (focusOpenRef.current && activeNodeIdRef.current) {
      return shell.querySelector<HTMLElement>('[data-focus-body-editor="true"]');
    }
    const ids = selectedNodeIdsRef.current;
    if (ids.length !== 1) return null;
    const entity = graphRef.current.entities[ids[0]!];
    if (!entity || entity.kind !== "content") return null;
    if (entity.theme !== "default" && entity.theme !== "task") return null;
    return shell.querySelector<HTMLElement>(`[data-node-id="${ids[0]!}"] [data-node-body-editor="true"]`);
  }, []);

  const canInsertImageAtCurrentTarget = useCallback(() => {
    if (focusOpenRef.current && activeNodeIdRef.current) {
      const entity = graphRef.current.entities[activeNodeIdRef.current];
      return !!entity && entity.kind === "content" && entity.theme !== "code";
    }
    const ids = selectedNodeIdsRef.current;
    if (ids.length !== 1) return false;
    const entity = graphRef.current.entities[ids[0]!];
    return (
      !!entity &&
      entity.kind === "content" &&
      (entity.theme === "default" || entity.theme === "task")
    );
  }, []);

  const refreshTextFormatChrome = useCallback(() => {
    const shell = shellRef.current;
    const ae = document.activeElement;
    if (!shell || !ae || !(ae instanceof Node) || !shell.contains(ae)) {
      setTextFormatChromeActive(false);
      setRichDocInsertChromeActive(false);
      setFormatCommandState({
        bold: false,
        italic: false,
        underline: false,
        strikeThrough: false,
        unorderedList: false,
        orderedList: false,
        blockTag: "p",
      });
      return;
    }
    const fmt = isTextFormattingToolbarTarget(ae);
    setTextFormatChromeActive(fmt);
    setRichDocInsertChromeActive(fmt && isRichDocBodyFormattingTarget(ae));
    if (!fmt) {
      setFormatCommandState({
        bold: false,
        italic: false,
        underline: false,
        strikeThrough: false,
        unorderedList: false,
        orderedList: false,
        blockTag: "p",
      });
      return;
    }
    setFormatCommandState({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
      unorderedList: document.queryCommandState("insertUnorderedList"),
      orderedList: document.queryCommandState("insertOrderedList"),
      blockTag: normalizeFormatBlockTag(document.queryCommandValue("formatBlock")),
    });
  }, []);

  useEffect(() => {
    const onIn = () => refreshTextFormatChrome();
    const onOut = () => {
      requestAnimationFrame(() => refreshTextFormatChrome());
    };
    document.addEventListener("focusin", onIn, true);
    document.addEventListener("focusout", onOut, true);
    return () => {
      document.removeEventListener("focusin", onIn, true);
      document.removeEventListener("focusout", onOut, true);
    };
  }, [refreshTextFormatChrome]);

  useEffect(() => {
    const onSelectionChange = () => {
      const shell = shellRef.current;
      const selection = window.getSelection();
      if (!shell || !selection || selection.rangeCount < 1) {
        lastFormatRangeRef.current = null;
        refreshTextFormatChrome();
        return;
      }
      const range = selection.getRangeAt(0);
      const anchor = range.commonAncestorContainer;
      const anchorEl =
        anchor instanceof HTMLElement ? anchor : anchor.parentElement;
      if (!anchorEl || !shell.contains(anchorEl) || !isTextFormattingToolbarTarget(anchorEl)) {
        lastFormatRangeRef.current = null;
        refreshTextFormatChrome();
        return;
      }
      lastFormatRangeRef.current = range.cloneRange();
      refreshTextFormatChrome();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [refreshTextFormatChrome]);

  const runFormat = useCallback(
    (command: string, value?: string) => {
      const shell = shellRef.current;
      if (!shell) return;

      const dispatchInput = (target: HTMLElement | null) => {
        target?.dispatchEvent(new Event("input", { bubbles: true }));
      };

      const restoreSelection = (target: HTMLElement | null) => {
        const selection = window.getSelection();
        const saved = lastFormatRangeRef.current;
        if (!selection || !saved || !target) return false;
        if (!isNodeWithin(target, saved.commonAncestorContainer)) return false;
        selection.removeAllRanges();
        selection.addRange(saved);
        return true;
      };

      const target = resolveRichTextFormatTarget();
      if (command === "arch:insertImage") {
        if (!canInsertImageAtCurrentTarget()) return;
        if (focusOpenRef.current && activeNodeIdRef.current) {
          pendingMediaUploadRef.current = { mode: "focus", id: activeNodeIdRef.current };
        } else {
          const ids = selectedNodeIdsRef.current;
          const entity = ids.length === 1 ? graphRef.current.entities[ids[0]!] : null;
          if (!entity || entity.kind !== "content") return;
          pendingMediaUploadRef.current = { mode: "canvas", id: entity.id };
        }
        mediaFileInputRef.current?.click();
        return;
      }

      if (!target) return;
      if (!restoreSelection(target)) {
        placeCaretAtEnd(target);
      }

      if (command === "arch:checklist") {
        document.execCommand(
          "insertHTML",
          false,
          `<div class="${styles.taskItem}" contenteditable="false"><div class="${styles.taskCheckbox}" contenteditable="false"></div><div class="${styles.taskText}" contenteditable="true">New item</div></div>`,
        );
        dispatchInput(target);
        refreshTextFormatChrome();
        return;
      }

      if (command === "formatBlock" && value === "h1") {
        const current = normalizeFormatBlockTag(document.queryCommandValue("formatBlock"));
        const next = current === "h1" || current === "h2" || current === "h3" ? "p" : "h1";
        document.execCommand("formatBlock", false, next);
        dispatchInput(target);
        refreshTextFormatChrome();
        return;
      }

      if (command === "formatBlock" && value === "blockquote") {
        const current = normalizeFormatBlockTag(document.queryCommandValue("formatBlock"));
        document.execCommand("formatBlock", false, current === "blockquote" ? "p" : "blockquote");
        dispatchInput(target);
        refreshTextFormatChrome();
        return;
      }

      document.execCommand(command, false, value);
      dispatchInput(target);
      refreshTextFormatChrome();
    },
    [canInsertImageAtCurrentTarget, refreshTextFormatChrome, resolveRichTextFormatTarget],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (galleryOpenRef.current) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey) return;
      const key = event.key.toLowerCase();
      const command = key === "b" ? "bold" : key === "i" ? "italic" : key === "u" ? "underline" : null;
      if (!command) return;
      const target = event.target as HTMLElement | null;
      if (!target || !isTextFormattingToolbarTarget(target)) return;
      event.preventDefault();
      runFormat(command);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runFormat]);

  const closeSelectionContextMenu = useCallback(() => {
    setSelectionContextMenu(null);
  }, []);

  const closeConnectionContextMenu = useCallback(() => {
    setConnectionContextMenu(null);
  }, []);

  const handleViewportContextMenuCapture = useCallback(
    (event: React.MouseEvent) => {
      if (focusOpen || galleryOpen || stackModal) return;
      const target = event.target as HTMLElement;
      if (target.closest("[data-connection-id]")) return;
      if (isEditableTarget(target)) return;
      if (target.closest("[contenteditable='true']")) return;

      const nodeHost = target.closest<HTMLElement>("[data-node-id]");
      const nodeId = nodeHost?.dataset.nodeId;
      const stackHost = target.closest<HTMLElement>("[data-stack-container='true']");
      const stackId = stackHost?.dataset.stackId;

      let hitIds: string[] | null = null;
      if (nodeId && visibleEntityIds.includes(nodeId)) {
        hitIds = [nodeId];
      } else if (stackId) {
        const members = visibleEntities
          .filter((e) => e.stackId === stackId)
          .sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0))
          .map((e) => e.id);
        if (members.length > 0) hitIds = members;
      }

      if (!hitIds || hitIds.length < 1) return;

      event.preventDefault();
      event.stopPropagation();
      setSelectedNodeIds(hitIds);
      setSelectionContextMenu(
        clampContextMenuPosition(
          { x: event.clientX, y: event.clientY },
          { maxWidth: 236, maxHeight: 280, edgePadding: 8 },
        ),
      );
    },
    [focusOpen, galleryOpen, stackModal, visibleEntities, visibleEntityIds],
  );

  const duplicateSelectedEntities = useCallback(() => {
    const ids = selectedNodeIdsRef.current.filter((id) => visibleEntityIds.includes(id));
    if (ids.length === 0) return;
    const spaceId = activeSpaceIdRef.current;
    const prev = graphRef.current;
    const space = prev.spaces[spaceId];
    if (!space) return;

    type PlanEntry =
      | { kind: "content"; nid: string; fromId: string }
      | { kind: "folder"; nid: string; fromId: string; childSpaceId: string };

    const plan: PlanEntry[] = [];
    for (const id of ids) {
      const e = prev.entities[id];
      if (!e) continue;
      const slot = e.slots[spaceId];
      if (!slot) continue;
      if (e.kind === "content") {
        plan.push({ kind: "content", nid: createId("node"), fromId: id });
      } else {
        plan.push({
          kind: "folder",
          nid: createId("folder"),
          fromId: id,
          childSpaceId: createId("space"),
        });
      }
    }
    if (plan.length === 0) return;

    recordUndoBeforeMutation();
    setGraph((p) => {
      const next = shallowCloneGraph(p);
      const sp = next.spaces[spaceId];
      if (!sp) return p;
      const newIds: string[] = [];
      const delta = 36;
      for (const entry of plan) {
        const e = p.entities[entry.fromId];
        if (!e) continue;
        const slot = e.slots[spaceId];
        if (!slot) continue;
        newIds.push(entry.nid);
        if (entry.kind === "content" && e.kind === "content") {
          next.entities[entry.nid] = {
            ...e,
            id: entry.nid,
            stackId: null,
            stackOrder: null,
            slots: {
              ...e.slots,
              [spaceId]: { x: slot.x + delta, y: slot.y + delta },
            },
          };
        } else if (entry.kind === "folder" && e.kind === "folder") {
          next.spaces[entry.childSpaceId] = {
            id: entry.childSpaceId,
            name: e.title || "New Folder",
            parentSpaceId: spaceId,
            entityIds: [],
          };
          next.entities[entry.nid] = {
            ...e,
            id: entry.nid,
            childSpaceId: entry.childSpaceId,
            stackId: null,
            stackOrder: null,
            slots: {
              ...e.slots,
              [spaceId]: { x: slot.x + delta, y: slot.y + delta },
            },
          };
        }
      }
      next.spaces[spaceId] = {
        ...sp,
        entityIds: [...sp.entityIds, ...newIds],
      };
      return next;
    });
    setSelectedNodeIds(plan.map((x) => x.nid));
  }, [createId, recordUndoBeforeMutation, visibleEntityIds]);

  const alignSelectedInGrid = useCallback(() => {
    const ids = selectedNodeIdsRef.current.filter((id) => visibleEntityIds.includes(id));
    if (ids.length < 2) return;
    const spaceId = activeSpaceIdRef.current;
    recordUndoBeforeMutation();
    const cellW = 380;
    const cellH = 300;
    const gapX = 24;
    const gapY = 24;
    setGraph((prev) => {
      const next = shallowCloneGraph(prev);
      const sorted = [...ids].sort((a, b) => {
        const sa = next.entities[a]?.slots[spaceId];
        const sb = next.entities[b]?.slots[spaceId];
        if (!sa || !sb) return 0;
        if (Math.abs(sa.y - sb.y) > 8) return sa.y - sb.y;
        return sa.x - sb.x;
      });
      let ox = Number.POSITIVE_INFINITY;
      let oy = Number.POSITIVE_INFINITY;
      sorted.forEach((id) => {
        const s = next.entities[id]?.slots[spaceId];
        if (!s) return;
        ox = Math.min(ox, s.x);
        oy = Math.min(oy, s.y);
      });
      if (!Number.isFinite(ox) || !Number.isFinite(oy)) return prev;
      const cols = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
      sorted.forEach((id, i) => {
        const e = next.entities[id];
        if (!e) return;
        const col = i % cols;
        const row = Math.floor(i / cols);
        next.entities[id] = {
          ...e,
          slots: {
            ...e.slots,
            [spaceId]: {
              x: ox + col * (cellW + gapX),
              y: oy + row * (cellH + gapY),
            },
          },
        };
      });
      return next;
    });
  }, [recordUndoBeforeMutation, visibleEntityIds]);

  const canStackFromSelection = useMemo(() => {
    const contentIds = selectedNodeIds.filter((id) => {
      const e = graph.entities[id];
      return e?.kind === "content" && visibleEntityIds.includes(id);
    });
    return contentIds.length >= 2;
  }, [graph.entities, selectedNodeIds, visibleEntityIds]);

  const selectionContextMenuItems = useMemo<ContextMenuItem[]>(
    () => [
      {
        label: "Create stack",
        icon: <Stack size={18} weight="bold" aria-hidden />,
        disabled: !canStackFromSelection,
        onSelect: () => stackSelectedContent(),
      },
      {
        label: "Align in grid",
        icon: <SquaresFour size={18} weight="bold" aria-hidden />,
        disabled: selectedNodeIds.length < 2,
        onSelect: () => alignSelectedInGrid(),
      },
      {
        label: "Delete",
        icon: <Trash size={18} weight="bold" aria-hidden />,
        onSelect: () => deleteEntitySelection([...selectedNodeIdsRef.current]),
      },
      {
        label: "Copy",
        icon: <CopySimple size={18} weight="bold" aria-hidden />,
        onSelect: () => duplicateSelectedEntities(),
      },
    ],
    [
      alignSelectedInGrid,
      canStackFromSelection,
      deleteEntitySelection,
      duplicateSelectedEntities,
      selectedNodeIds.length,
      stackSelectedContent,
    ],
  );

  const connectionContextMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!selectedConnectionId) return [];
    const selected = graph.connections[selectedConnectionId];
    const currentSlack = selected?.slackMultiplier ?? 1.1;
    const base = [
      {
        label: "Cut connection",
        onSelect: () => cutConnection(selectedConnectionId),
      },
      {
        label: "Make thread taught",
        disabled: currentSlack <= 1.01,
        onSelect: () => setConnectionSlack(selectedConnectionId, 1.02),
      },
      {
        label: "Loosten thread",
        disabled: currentSlack >= 1.29,
        onSelect: () => setConnectionSlack(selectedConnectionId, 1.28),
      },
    ];
    /* Thread color lives on the draw-mode spool in the tool rail — keeps this menu short. */
    return base;
  }, [cutConnection, graph.connections, selectedConnectionId, setConnectionSlack]);

  const canInsertImage = useMemo(() => {
    if (focusOpen && activeNodeId) {
      const entity = graph.entities[activeNodeId];
      return !!entity && entity.kind === "content" && entity.theme !== "code";
    }
    if (selectedNodeIds.length !== 1) return false;
    const entity = graph.entities[selectedNodeIds[0]!];
    return (
      !!entity &&
      entity.kind === "content" &&
      (entity.theme === "default" || entity.theme === "task")
    );
  }, [activeNodeId, focusOpen, graph.entities, selectedNodeIds]);

  const dockInsertActions = useMemo<DockFormatAction[]>(
    () =>
      DEFAULT_DOC_INSERT_ACTIONS.map((action) => {
        if (action.command === "arch:insertImage") {
          return { ...action, disabled: !canInsertImage };
        }
        if (action.command === "formatBlock" && action.value === "blockquote") {
          return { ...action, active: formatCommandState.blockTag === "blockquote" };
        }
        return action;
      }),
    [canInsertImage, formatCommandState.blockTag],
  );

  const dockFormatActions = useMemo<DockFormatAction[]>(
    () =>
      DEFAULT_FORMAT_ACTIONS.map((action) => {
        if (action.command === "bold") return { ...action, active: formatCommandState.bold };
        if (action.command === "italic") return { ...action, active: formatCommandState.italic };
        if (action.command === "underline") return { ...action, active: formatCommandState.underline };
        if (action.command === "strikeThrough") {
          return { ...action, active: formatCommandState.strikeThrough };
        }
        if (action.command === "insertUnorderedList") {
          return { ...action, active: formatCommandState.unorderedList };
        }
        if (action.command === "insertOrderedList") {
          return { ...action, active: formatCommandState.orderedList };
        }
        if (action.command === "formatBlock" && action.value === "h1") {
          const level = formatCommandState.blockTag;
          const headingLabel =
            level === "h1" || level === "h2" || level === "h3"
              ? `Heading (${level.toUpperCase()})`
              : "Heading";
          return {
            ...action,
            label: headingLabel,
            active: level === "h1" || level === "h2" || level === "h3",
          };
        }
        return action;
      }),
    [formatCommandState],
  );

  useEffect(() => {
    if (selectedNodeIds.length < 1) setSelectionContextMenu(null);
  }, [selectedNodeIds]);

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      const t = event.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("[data-connection-id]")) return;
      if (connectionContextMenu) return;
      setSelectedConnectionId(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [connectionContextMenu]);

  useEffect(() => {
    if (!selectedConnectionId) {
      setConnectionContextMenu(null);
    }
  }, [selectedConnectionId]);

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
  const selectedVisibleIds = useMemo(
    () => selectedNodeIds.filter((id) => visibleEntityIds.includes(id)),
    [selectedNodeIds, visibleEntityIds],
  );
  const parentExitStripVisible =
    !!parentSpaceId && (draggedNodeIds.length > 0 || selectedVisibleIds.length > 0);
  const parentExitInteractive = useMemo(() => {
    if (!parentSpaceId) return false;
    return (
      selectedVisibleIds.length > 0 &&
      selectedVisibleIds.every((id) => canMoveEntityToSpace(id, parentSpaceId))
    );
  }, [canMoveEntityToSpace, parentSpaceId, selectedVisibleIds]);

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

  const galleryEntity =
    galleryOpen && galleryNodeId ? graph.entities[galleryNodeId] : undefined;
  const galleryRaster = useMemo(() => {
    if (!galleryEntity || galleryEntity.kind !== "content" || galleryEntity.theme !== "media") {
      return { src: null as string | null, alt: "" };
    }
    return parseArchitecturalMediaFromBody(galleryEntity.bodyHtml);
  }, [galleryEntity]);

  const galleryBodyFingerprint =
    galleryOpen &&
    galleryEntity?.kind === "content" &&
    galleryEntity.theme === "media"
      ? galleryEntity.bodyHtml
      : "";

  useEffect(() => {
    if (!galleryOpen) {
      setGalleryDimsLabel("— × —");
      return;
    }
    setGalleryDimsLabel("— × —");
  }, [galleryOpen, galleryBodyFingerprint]);

  return (
    <div
      ref={shellRef}
      className={`${styles.shell} ${focusOpen || galleryOpen ? styles.shellBackdropBlurActive : ""} ${
        focusOpen ? styles.shellFocusDockBleed : ""
      }`}
    >
      <div
        ref={viewportRef}
        className={`${styles.viewport} ${styles.viewportSurface} ${
          canvasSurfaceReady ? styles.viewportSurfaceReady : styles.viewportSurfacePending
        } ${activeSpaceId !== graph.rootSpaceId ? styles.deepSpace : ""}${
          stackModal ? ` ${styles.viewportStackModalOpen}` : ""
        } ${connectionMode !== "move" ? styles.viewportConnectionMode : ""}`}
        aria-busy={!canvasSurfaceReady}
        data-canvas-ready={canvasSurfaceReady ? "true" : "false"}
        onMouseDown={onViewportMouseDown}
        onContextMenuCapture={handleViewportContextMenuCapture}
        onWheel={onWheel}
        style={{
          backgroundPosition: `${translateX}px ${translateY}px`,
          ["--connection-cursor" as string]:
            connectionMode === "cut"
              ? CONNECTION_CUT_CURSOR
              : connectionMode === "draw" && connectionSourceId
                ? "copy"
                : CONNECTION_DRAW_CURSOR,
          cursor: isPanning
            ? "grabbing"
            : connectionMode === "draw"
              ? connectionSourceId
                ? "copy"
                : CONNECTION_DRAW_CURSOR
              : connectionMode === "cut"
                ? CONNECTION_CUT_CURSOR
            : activeTool === "pan" || spacePanning
              ? "grab"
              : "default",
        }}
      >
        <div
          className={`${styles.canvas}${
            draggedNodeIds.length > 0 ? ` ${styles.canvasDraggingConnections}` : ""
          }`}
          style={{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})` }}
        >
          <div
            className={`${styles.canvasEntityLayer}${
              connectionMode === "cut" ? ` ${styles.canvasEntityLayerCutDim}` : ""
            }`}
          >
          {standaloneEntities.map((entity) => {
            const slot = entity.slots[activeSpaceId] ?? { x: 0, y: 0 };
            const draggedIndex = draggedNodeIds.indexOf(entity.id);
            const dragged = draggedIndex >= 0;
            const dropPreview = dragged && !!hoveredFolderId;
            const selected = selectedNodeIds.includes(entity.id);
            const isConnectionSource = connectionSourceId === entity.id;
            const folderCount =
              entity.kind === "folder"
                ? graph.spaces[entity.childSpaceId]?.entityIds.length ?? 0
                : 0;
            const previewTitles = entity.kind === "folder" ? folderPreviewTitles(entity, graph) : [];
            return (
              <div
                key={entity.id}
                data-node-id={entity.id}
                data-space-id={activeSpaceId}
                data-stack-target={entity.kind === "content" ? "true" : undefined}
                className={`${styles.nodePlacement} ${hoveredStackTargetId === entity.id ? styles.stackDropTarget : ""} ${
                  isConnectionSource ? styles.nodeConnectionSource : ""
                }`}
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
                    tapeVariant={entity.tapeVariant ?? tapeVariantForTheme(entity.theme)}
                    tapeRotation={entity.tapeRotation}
                    bodyHtml={entity.bodyHtml}
                    activeTool={activeTool}
                    dragged={dragged}
                    selected={selected}
                    showTape={!entity.stackId}
                    onBodyCommit={updateNodeBody}
                    onExpand={handleNodeExpand}
                  />
                ) : (
                  <ArchitecturalFolderCard
                    id={entity.id}
                    title={entity.title}
                    itemCount={folderCount}
                    previewTitles={previewTitles}
                    dragOver={hoveredFolderId === entity.id}
                    selected={selected}
                    folderColorScheme={entity.folderColorScheme}
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
                  if (event.button !== 0 || activeTool !== "select" || connectionMode !== "move") return;
                  const target = event.target as HTMLElement;
                  if (target.closest("[data-expand-btn='true']")) return;
                  event.stopPropagation();
                  recordUndoBeforeMutation();
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
                  dragPointerScreenRef.current = { x: event.clientX, y: event.clientY };
                  setMaxZIndex((prev) => prev + 1);
                  stackPointerDragRef.current = {
                    stackId,
                    startX: event.clientX,
                    startY: event.clientY,
                    moved: false,
                  };
                }}
                onClick={(event) => {
                  if (connectionMode !== "move") return;
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
                    data-node-id={entity.id}
                    data-space-id={activeSpaceId}
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
                        tapeVariant={entity.tapeVariant ?? tapeVariantForTheme(entity.theme)}
                        tapeRotation={entity.tapeRotation}
                        bodyHtml={entity.bodyHtml}
                        activeTool={activeTool}
                        dragged={draggingStack}
                        selected={false}
                        showTape={!entity.stackId}
                        onBodyCommit={updateNodeBody}
                        onExpand={handleNodeExpand}
                        bodyEditable={false}
                      />
                    ) : (
                      <ArchitecturalFolderCard
                        id={entity.id}
                        title={entity.title}
                        itemCount={graph.spaces[entity.childSpaceId]?.entityIds.length ?? 0}
                        previewTitles={folderPreviewTitles(entity, graph)}
                        dragOver={false}
                        selected={false}
                        folderColorScheme={entity.folderColorScheme}
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
          <svg className={styles.connectionLayer} viewBox="0 0 10000 10000" aria-hidden>
            {connectionMode === "draw" && connectionSourceId && connectionCursorWorld
              ? (() => {
                  const sourceEntity = graph.entities[connectionSourceId];
                  if (!sourceEntity) return null;
                  const sourcePin = resolveConnectionPin(
                    connectionSourceId,
                    sourceEntity.kind === "folder"
                      ? CONNECTION_PIN_DEFAULT_FOLDER
                      : CONNECTION_PIN_DEFAULT_CONTENT,
                    activeSpaceId,
                    graph,
                    connectionPinView,
                  );
                  if (!sourcePin) return null;
                  const cx = (sourcePin.x + connectionCursorWorld.x) / 2;
                  const cy = (sourcePin.y + connectionCursorWorld.y) / 2;
                  return (
                    <g>
                      <path
                        d={`M ${sourcePin.x} ${sourcePin.y} Q ${cx} ${cy}, ${connectionCursorWorld.x} ${connectionCursorWorld.y}`}
                        className={`${styles.connectionStroke} ${styles.connectionStrokePreview}`}
                        style={{ stroke: connectionColor }}
                      />
                      <circle
                        cx={sourcePin.x}
                        cy={sourcePin.y}
                        r={4.5}
                        className={styles.connectionPin}
                        style={{ fill: connectionColor }}
                      />
                    </g>
                  );
                })()
              : null}
            {visibleConnections.map((connection) => {
              const sourcePin = resolveConnectionPin(
                connection.sourceEntityId,
                connection.sourcePin,
                activeSpaceId,
                graph,
                connectionPinView,
              );
              const targetPin = resolveConnectionPin(
                connection.targetEntityId,
                connection.targetPin,
                activeSpaceId,
                graph,
                connectionPinView,
              );
              if (!sourcePin || !targetPin) return null;
              const pathD = connectionPaths[connection.id] ?? "";
              const isCut = connectionMode === "cut";
              return (
                <g key={connection.id} data-connection-id={connection.id}>
                  {!isCut ? (
                    <path
                      d={pathD}
                      className={styles.connectionHitStroke}
                      data-connection-id={connection.id}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return;
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedConnectionId(connection.id);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedConnectionId(connection.id);
                        setConnectionContextMenu(
                          clampContextMenuPosition(
                            { x: event.clientX, y: event.clientY },
                            { maxWidth: 236, maxHeight: 360, edgePadding: 8 },
                          ),
                        );
                      }}
                    />
                  ) : null}
                  <path
                    d={pathD}
                    className={`${styles.connectionStroke} ${
                      isCut ? styles.connectionStrokeCuttable : ""
                    } ${selectedConnectionId === connection.id ? styles.connectionStrokeSelected : ""}`}
                    style={{ stroke: connection.color }}
                    data-connection-id={connection.id}
                    onMouseDown={(event) => {
                      if (!isCut) return;
                      event.preventDefault();
                      event.stopPropagation();
                      cutConnection(connection.id);
                    }}
                    onClick={(event) => {
                      if (isCut) return;
                      event.preventDefault();
                      event.stopPropagation();
                      setSelectedConnectionId(connection.id);
                    }}
                    onContextMenu={(event) => {
                      if (!isCut) return;
                      event.preventDefault();
                      event.stopPropagation();
                      setSelectedConnectionId(connection.id);
                      setConnectionContextMenu(
                        clampContextMenuPosition(
                          { x: event.clientX, y: event.clientY },
                          { maxWidth: 236, maxHeight: 360, edgePadding: 8 },
                        ),
                      );
                    }}
                  />
                  <circle
                    cx={sourcePin.x}
                    cy={sourcePin.y}
                    r={4.5}
                    className={styles.connectionPin}
                    style={{ fill: connection.color }}
                  />
                  <circle
                    cx={targetPin.x}
                    cy={targetPin.y}
                    r={4.5}
                    className={styles.connectionPin}
                    style={{ fill: connection.color }}
                  />
                </g>
              );
            })}
          </svg>
        </div>
        <div className={styles.chromeLayer}>
        {parentSpaceId ? (
          <ArchitecturalParentExitThreshold
            ref={parentDropRef}
            toolbarBottomPx={parentExitRail.top + parentExitRail.height}
            visible={parentExitStripVisible}
            hovered={parentDropHovered}
            interactive={parentExitInteractive}
            onActivate={moveSelectionToParent}
          />
        ) : null}
        <div ref={shellTopLeftStackRef} className={styles.shellTopLeftStack}>
          <div className={styles.shellTopCluster}>
            <div className={styles.shellTopClusterRow}>
              <ArchitecturalStatusBar
                centerWorldX={centerWorldX}
                centerWorldY={centerWorldY}
                scale={scale}
              />
              <div className={styles.navChrome}>
                <div className={`${styles.glassPanel} ${styles.navPanel} ${styles.shellTopChromePanel}`}>
                  <div className={styles.navRow}>
                    {parentSpaceId ? (
                      <ArchitecturalButton
                        type="button"
                        size="menu"
                        tone="focus-light"
                        className={styles.navBackBtn}
                        leadingIcon={<ArrowLeft size={12} weight="bold" aria-hidden />}
                        onClick={goBack}
                      >
                        Back
                      </ArchitecturalButton>
                    ) : null}
                    <div className={styles.crumbTrail}>
                      {navigationPath.map((spaceId, index) => {
                        const isActive = spaceId === activeSpaceId;
                        const label =
                          spaceId === graph.rootSpaceId
                            ? "Root"
                            : graph.spaces[spaceId]?.name ?? "Unknown";
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
                    <ArchitecturalButton
                      type="button"
                      size="menu"
                      tone="focus-light"
                      leadingIcon={<MagnifyingGlass size={12} weight="bold" aria-hidden />}
                      onClick={() => setPaletteOpen(true)}
                      title={`Search (${modKeyHints.search})`}
                    >
                      Search
                    </ArchitecturalButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!focusOpen && !galleryOpen ? (
          <ArchitecturalBottomDock
            showFormatToolbar={textFormatChromeActive}
            showDocInsertCluster={richDocInsertChromeActive}
            insertDocActions={dockInsertActions}
            formatActions={dockFormatActions}
            activeBlockTag={formatCommandState.blockTag}
            onFormat={runFormat}
            onCreateNode={createNewNode}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            undoLabel={`Undo (${modKeyHints.undo})`}
            redoLabel={`Redo (${modKeyHints.redo})`}
            folderColorPicker={folderColorPickerForDock}
          />
        ) : null}

        <ArchitecturalToolRail
          activeTool={activeTool}
          onSetTool={(tool) => {
            setActiveTool(tool);
            setConnectionMode("move");
            setConnectionSourceId(null);
            setConnectionCursorWorld(null);
            selectionBeforeConnectionModeRef.current = null;
          }}
          connectionMode={connectionMode}
          onSetConnectionMode={(next) => {
            const resolved = connectionMode === next ? "move" : next;
            setConnectionMode(resolved);
            setActiveTool("select");
            setDraggedNodeIds([]);
            draggedNodeIdsRef.current = [];
            lassoStartRef.current = null;
            lassoRectScreenRef.current = null;
            setLassoRectScreen(null);
            if (resolved === "move") {
              const restore = selectionBeforeConnectionModeRef.current;
              if (restore) {
                setSelectedNodeIds(restore.filter((id) => !!graphRef.current.entities[id]));
              }
              selectionBeforeConnectionModeRef.current = null;
            } else {
              if (!selectionBeforeConnectionModeRef.current) {
                selectionBeforeConnectionModeRef.current = [...selectedNodeIdsRef.current];
              }
              setSelectedNodeIds([]);
            }
            if (resolved !== "draw") {
              setConnectionSourceId(null);
              setConnectionCursorWorld(null);
            }
          }}
          connectionColorControl={
            <ArchitecturalFolderColorStrip
              value={connectionColorSchemeId}
              onChange={applyConnectionColorScheme}
              appearance="spool"
              ariaLabel="Connection thread color"
              engaged={connectionMode === "draw"}
            />
          }
          onZoomIn={() => zoomBy(ZOOM_BUTTON_STEP)}
          onZoomOut={() => zoomBy(-ZOOM_BUTTON_STEP)}
          onRecenter={recenterToOrigin}
        />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          currentSpaceId={activeSpaceId}
          items={paletteItems}
          spaces={paletteSpaces}
          actions={paletteActions}
          recentItems={recentItems}
          onRecordRecentItem={pushRecentItem}
          onSelectItem={(id) => focusEntityFromPalette(id)}
          onSelectSpace={(spaceId) => enterSpace(spaceId)}
          onRunAction={runPaletteAction}
        />
      </div>
      </div>

      <ContextMenu
        position={selectionContextMenu}
        onClose={closeSelectionContextMenu}
        items={selectionContextMenuItems}
      />
      <ContextMenu
        position={connectionContextMenu}
        onClose={closeConnectionContextMenu}
        items={connectionContextMenuItems}
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

      {stackModal ? <div className={styles.stackScrim} onClick={closeStackModal} /> : null}
      {stackModal ? (
        <div
          className={styles.stackFanStage}
          data-stack-fan-stage="true"
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
                data-node-id={entity.id}
                data-space-id={activeSpaceId}
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
                  recordUndoBeforeMutation();
                  const visibleHull = stackModal.orderedIds.slice(0, STACK_MODAL_MAX_ITEMS);
                  stackDragHullOrderedIdsRef.current = visibleHull;
                  stackModalOrderedIdsDuringDragRef.current = stackModal.orderedIds.slice();
                  stackEjectTouchedOutsideRef.current = false;
                  stackBlockLiveReorderRef.current = false;
                  lastStackEjectPreviewRef.current = false;
                  const nextStackDrag = {
                    entityId: entity.id,
                    stackId: stackModal.stackId,
                    startX: event.clientX,
                    startY: event.clientY,
                    currentX: event.clientX,
                    currentY: event.clientY,
                    pointerOffsetX: event.clientX - baseX,
                    pointerOffsetY: event.clientY - baseY,
                    intent: "pending" as const,
                  };
                  stackDragRef.current = nextStackDrag;
                  setStackDrag(nextStackDrag);
                }}
              >
                {entity.kind === "content" ? (
                  <ArchitecturalNodeCard
                    id={entity.id}
                    title={entity.title}
                    width={entity.width}
                    theme={entity.theme}
                    tapeVariant={entity.tapeVariant ?? tapeVariantForTheme(entity.theme)}
                    tapeRotation={entity.tapeRotation}
                    bodyHtml={entity.bodyHtml}
                    activeTool={activeTool}
                    dragged={!!drag}
                    selected={false}
                    showTape={!entity.stackId}
                    onBodyCommit={updateNodeBody}
                    onExpand={handleNodeExpand}
                  />
                ) : (
                  <ArchitecturalFolderCard
                    id={entity.id}
                    title={entity.title}
                    itemCount={graph.spaces[entity.childSpaceId]?.entityIds.length ?? 0}
                    previewTitles={folderPreviewTitles(entity, graph)}
                    dragOver={false}
                    selected={false}
                    folderColorScheme={entity.folderColorScheme}
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
      ) : null}
      {stackModal ? (
        <div className={styles.stackModal}>
          <div className={styles.stackModalCloseButtonWrap}>
            <ArchitecturalFocusCloseButton
              dirty={false}
              onDone={closeStackModal}
              onSave={closeStackModal}
              onDiscard={closeStackModal}
            />
          </div>
        </div>
      ) : null}

      {galleryOpen &&
      galleryNodeId &&
      galleryEntity?.kind === "content" &&
      galleryEntity.theme === "media" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="arch-media-gallery-title"
          className={`${styles.focusOverlay} ${styles.focusActive} ${styles.focusEditorDark}`}
        >
          <div className={styles.focusSheet}>
            <div className={styles.focusHeader} style={{ opacity: 1, transform: "none" }}>
              <div className={styles.focusMeta}>
                VIEWING // {galleryNodeId.toUpperCase()}
                {galleryRaster.src ? (
                  <span className={styles.mediaGalleryDimsInline}>
                    &ensp;{galleryDimsLabel}
                  </span>
                ) : null}
              </div>
              <div className={styles.focusHeaderActions}>
                <ArchitecturalButton
                  type="button"
                  size="pill"
                  tone="focus-dark"
                  leadingIcon={<UploadSimple size={16} weight="bold" aria-hidden />}
                  data-architectural-media-upload="true"
                  data-media-owner-id={galleryNodeId}
                >
                  Replace
                </ArchitecturalButton>
                <ArchitecturalFocusCloseButton
                  dirty={galleryDirty}
                  onDone={closeMediaGallery}
                  onSave={saveGalleryAndClose}
                  onDiscard={closeMediaGallery}
                />
              </div>
            </div>
            <div className={styles.focusContent} style={{ opacity: 1, transform: "none" }}>
              <BufferedTextInput
                id="arch-media-gallery-title"
                type="text"
                className={styles.focusTitle}
                value={galleryDraftTitle}
                debounceMs={200}
                onCommit={(next) => setGalleryDraftTitle(next)}
                aria-label="Image title"
                placeholder="Untitled image"
                style={{ opacity: 1, transform: "none" }}
              />
              <div className={styles.mediaGalleryAssetStage}>
                {galleryRaster.src ? (
                  <img
                    key={galleryRaster.src}
                    src={galleryRaster.src}
                    alt={galleryRaster.alt || galleryEntity.title}
                    className={styles.mediaGalleryAsset}
                    draggable={false}
                    onLoad={(e) => {
                      const { naturalWidth, naturalHeight } = e.currentTarget;
                      if (naturalWidth && naturalHeight) {
                        setGalleryDimsLabel(`${naturalWidth} × ${naturalHeight}`);
                      }
                    }}
                  />
                ) : (
                  <div className={styles.mediaGalleryEmpty}>
                    <p className={styles.mediaGalleryEmptyTitle}>No image loaded</p>
                    <p className={styles.mediaGalleryEmptyHint}>
                      Use Replace above or on the card.
                    </p>
                  </div>
                )}
              </div>
              <BufferedContentEditable
                value={galleryDraftNotes}
                className={styles.focusBody}
                spellCheck={false}
                debounceMs={150}
                dataAttribute="data-architectural-media-gallery-notes"
                onCommit={(nextHtml) => setGalleryDraftNotes(nextHtml)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`${styles.focusOverlay} ${focusOpen ? styles.focusActive : ""} ${
          focusOpen && focusCodeTheme ? styles.focusEditorDark : ""
        }`}
        onPointerDownCapture={onFocusOverlayPointerDownCapture}
      >
        <div className={styles.focusSheet}>
          <div className={styles.focusHeader}>
            <div className={styles.focusMeta}>
              EDITING // {activeNodeId ? activeNodeId.toUpperCase() : "NODE"}
            </div>
            <ArchitecturalFocusCloseButton
              dirty={focusDirty}
              onDone={discardFocusAndClose}
              onSave={saveFocusAndClose}
              onDiscard={discardFocusAndClose}
            />
          </div>
          <div className={styles.focusContent}>
            <BufferedTextInput
              type="text"
              className={styles.focusTitle}
              value={focusTitle}
              debounceMs={150}
              onCommit={(next) => setFocusTitle(next)}
              placeholder="Untitled brief"
              data-focus-title-editor="true"
            />
            <BufferedContentEditable
              value={focusBody}
              className={`${styles.focusBody} ${focusCodeTheme ? styles.focusCode : ""}`}
              editable
              spellCheck={false}
              debounceMs={150}
              dataAttribute="data-focus-body-editor"
              onCommit={(nextHtml) =>
                setFocusBody(
                  normalizeChecklistMarkup(nextHtml, {
                    taskItem: styles.taskItem,
                    taskCheckbox: styles.taskCheckbox,
                    taskText: styles.taskText,
                    done: styles.done,
                  }),
                )
              }
            />
          </div>
        </div>
      </div>
      {focusOpen ? (
        <div className={styles.focusBottomDock}>
          <ArchitecturalBottomDock
            variant="editor"
            showFormatToolbar={!focusCodeTheme}
            showDocInsertCluster={!focusCodeTheme}
            showCreateMenu={false}
            insertDocActions={dockInsertActions}
            formatActions={dockFormatActions}
            createDisabled
            activeBlockTag={formatCommandState.blockTag}
            onFormat={runFormat}
            onCreateNode={createNewNode}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            undoLabel={`Undo (${modKeyHints.undo})`}
            redoLabel={`Redo (${modKeyHints.redo})`}
          />
        </div>
      ) : null}

      <input
        ref={mediaFileInputRef}
        type="file"
        className={styles.hiddenFileInput}
        accept="image/*"
        tabIndex={-1}
        aria-hidden
        onChange={onArchitecturalMediaFile}
      />
    </div>
  );
}
