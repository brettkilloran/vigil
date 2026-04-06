"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  ArrowsOut,
  CopySimple,
  DownloadSimple,
  FileText,
  Folder,
  Graph,
  MagnifyingGlass,
  NotePencil,
  SealCheck,
  SignOut,
  Sparkle,
  SquaresFour,
  Stack,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";

import { VigilFlowRevealOverlay } from "@/src/components/transition-experiment/VigilFlowRevealOverlay";

import {
  ArchitecturalLoreReviewPanel,
  type VaultReviewDraft,
  type VaultReviewIssue,
} from "@/src/components/foundation/ArchitecturalLoreReviewPanel";
import { VigilAppBootScreen } from "./VigilAppBootScreen";
import { VigilAppChromeAudioMuteButton } from "./VigilAppChromeAudioMuteButton";
import styles from "./ArchitecturalCanvasApp.module.css";
import { BufferedContentEditable } from "@/src/components/editing/BufferedContentEditable";
import { BufferedTextInput } from "@/src/components/editing/BufferedTextInput";
import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
import { Button } from "@/src/components/ui/Button";
import {
  ArchitecturalBottomDock,
  ArchitecturalFolderColorStrip,
  DEFAULT_CREATE_ACTIONS,
  DEFAULT_DOC_INSERT_ACTIONS,
  DEFAULT_FORMAT_ACTIONS,
  type ConnectionDockMode,
} from "@/src/components/foundation/ArchitecturalBottomDock";
import { ArchitecturalParentExitThreshold } from "@/src/components/foundation/ArchitecturalParentExitThreshold";
import { ArchitecturalFocusCloseButton } from "@/src/components/foundation/ArchitecturalFocusCloseButton";
import { ArchitecturalFolderCard } from "@/src/components/foundation/ArchitecturalFolderCard";
import { ArchitecturalNodeCard } from "@/src/components/foundation/ArchitecturalNodeCard";
import {
  ArchitecturalCanvasEffectsToggle,
  ArchitecturalStatusBar,
  ArchitecturalViewportMetrics,
} from "@/src/components/foundation/ArchitecturalStatusBar";
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
import {
  type BootstrapResponse,
  buildCanvasGraphFromBootstrap,
  buildContentJsonForContentEntity,
  buildContentJsonForFolderEntity,
  canvasItemToEntity,
  htmlToPlainText,
  mergeBootstrapView,
  applyServerCanvasItemToGraph,
  buildContentItemRestorePayload,
  buildFolderItemRestorePayload,
  removeEntitiesFromGraphAfterRemoteDelete,
  topoSortAddedSpacesForRestore,
  architecturalItemType,
  entityGeometryOnSpace,
} from "@/src/components/foundation/architectural-db-bridge";
import { buildArchitecturalSeedGraph } from "@/src/components/foundation/architectural-seed";
import {
  apiCreateItem,
  apiCreateSpace,
  apiDeleteItem,
  apiDeleteSpaceSubtree,
  apiPatchItem,
  apiPatchSpaceName,
  apiPatchSpaceParent,
  fetchBootstrap,
} from "@/src/components/foundation/architectural-neon-api";
import { mergeHydratedDbConnections } from "@/src/lib/architectural-item-link-graph";
import {
  clampLinkMetaSlackMultiplier,
  DEFAULT_LINK_SLACK_MULTIPLIER,
} from "@/src/lib/item-link-meta";
import { LORE_LINK_TYPE_OPTIONS } from "@/src/lib/lore-link-types";
import { validateClarificationAnswersForApply } from "@/src/lib/lore-import-clarifications";
import type {
  ClarificationAnswer,
  LoreImportClarificationItem,
  LoreImportPlan,
} from "@/src/lib/lore-import-plan-types";
import type { LoreImportEntityDraft, LoreImportLinkDraft } from "@/src/lib/lore-import-types";
import {
  getNeonSyncSnapshot,
  getNeonSyncServerSnapshot,
  neonSyncBumpPending,
  neonSyncReportAuxiliaryFailure,
  neonSyncSetCloudEnabled,
  neonSyncUnbumpPending,
  subscribeNeonSync,
} from "@/src/lib/neon-sync-bus";
import { parseJsonBody, syncFailureFromApiResponse } from "@/src/lib/sync-error-diagnostic";
import { playVigilUiSound } from "@/src/lib/vigil-ui-sounds";
import { pointerEventTargetElement } from "@/src/components/foundation/pointer-event-target";
import {
  cloneArchitecturalGraph,
  MAX_ARCHITECTURAL_UNDO,
  type ArchitecturalUndoSnapshot,
} from "@/src/components/foundation/architectural-undo";
import { useModKeyHints } from "@/src/lib/mod-keys";
import { VIGIL_CANVAS_EFFECTS_STORAGE_KEY } from "@/src/lib/vigil-canvas-prefs";
import { readSpaceCamera, writeSpaceCamera } from "@/src/lib/heartgarden-space-camera";
import { useHeartgardenPresenceHeartbeat } from "@/src/hooks/use-heartgarden-presence-heartbeat";
import { useHeartgardenSpaceChangeSync } from "@/src/hooks/use-heartgarden-space-change-sync";
import {
  clearWorkspaceViewCache,
  readWorkspaceViewCache,
  writeWorkspaceViewCache,
  type WorkspaceBootTierTag,
} from "@/src/lib/workspace-view-cache";
import type { CanvasItem } from "@/src/model/canvas-types";
import { defaultCamera } from "@/src/model/canvas-types";
import { useRecentFolders } from "@/src/hooks/use-recent-folders";
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
import { ArchitecturalLinksPanel } from "@/src/components/ui/ArchitecturalLinksPanel";
import { LinkGraphOverlay } from "@/src/components/ui/LinkGraphOverlay";
import { LoreAskPanel } from "@/src/components/ui/LoreAskPanel";
import {
  type CanvasConnectionPin,
  type CanvasContentEntity,
  type CanvasEntity,
  type CanvasFolderEntity,
  type ContentTheme,
  type CanvasGraph,
  type CanvasPinConnection,
  type CanvasSpace,
  type CanvasTool,
  type DockFormatAction,
  type NodeTheme,
  type TapeVariant,
  ROOT_SPACE_DISPLAY_NAME,
} from "@/src/components/foundation/architectural-types";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_BUTTON_STEP = 0.2;
const WHEEL_ZOOM_SENSITIVITY = 0.0012;
/** Scene fade-out / fade-in duration (ms); keep in sync with `.viewportSceneLayer` in ArchitecturalCanvasApp.module.css */
const VIEWPORT_SCENE_FADE_MS = 760;
/** Hold at opacity 0 while flow overlay peaks (between fade-out and fade-in). */
const VIEWPORT_SCENE_PEAK_HOLD_MS = 320;
/**
 * When `navTransitionActive` clears, the entering page fades in — schedule that at the midpoint of
 * fade-out + peak hold + fade-in so fast loads don’t swap content before the outro finishes.
 */
const VIEWPORT_TRANSITION_CENTER_MS = Math.floor(
  (VIEWPORT_SCENE_FADE_MS * 2 + VIEWPORT_SCENE_PEAK_HOLD_MS) / 2,
);
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

function entitySlotsDiffer(a: CanvasEntity, b: CanvasEntity): boolean {
  const keys = new Set([...Object.keys(a.slots), ...Object.keys(b.slots)]);
  for (const k of keys) {
    const sa = a.slots[k];
    const sb = b.slots[k];
    const ax = sa?.x ?? null;
    const ay = sa?.y ?? null;
    const bx = sb?.x ?? null;
    const by = sb?.y ?? null;
    if (ax !== bx || ay !== by) return true;
  }
  return false;
}

/** Content/folder rows whose layout or stack fields differ between snapshots (Neon resync after undo/redo). */
function collectIdsNeedingNeonLayoutResync(from: CanvasGraph, to: CanvasGraph): string[] {
  const out = new Set<string>();
  for (const id of Object.keys(to.entities)) {
    if (!from.entities[id]) continue;
    if (!isUuidLike(id)) continue;
    const a = from.entities[id]!;
    const b = to.entities[id]!;
    if (a.kind !== b.kind) {
      out.add(id);
      continue;
    }
    if (entitySlotsDiffer(a, b)) {
      out.add(id);
      continue;
    }
    if (a.kind === "content" && b.kind === "content") {
      if (a.stackId !== b.stackId || a.stackOrder !== b.stackOrder) {
        out.add(id);
        continue;
      }
      if ((a.width ?? UNIFIED_NODE_WIDTH) !== (b.width ?? UNIFIED_NODE_WIDTH)) {
        out.add(id);
      }
    } else if (a.kind === "folder" && b.kind === "folder") {
      if ((a.width ?? FOLDER_CARD_WIDTH) !== (b.width ?? FOLDER_CARD_WIDTH)) {
        out.add(id);
      }
    }
  }
  return [...out];
}

/** `spaces.parentSpaceId` rows that differ between snapshots (Neon resync after undo/redo). */
function collectSpacesNeedingParentResync(
  from: CanvasGraph,
  to: CanvasGraph,
): { spaceId: string; parentSpaceId: string | null }[] {
  const out: { spaceId: string; parentSpaceId: string | null }[] = [];
  for (const sid of Object.keys(to.spaces)) {
    if (!isUuidLike(sid)) continue;
    const a = from.spaces[sid];
    const b = to.spaces[sid];
    if (!a || !b) continue;
    if (a.parentSpaceId !== b.parentSpaceId) {
      out.push({ spaceId: sid, parentSpaceId: b.parentSpaceId });
    }
  }
  return out;
}

type ArchitecturalCanvasScenario = "default" | "nested" | "corrupt";

type LoreImportDraftState = {
  fileName?: string;
  sourceTitle?: string;
  sourceText: string;
  includeSourceCard: boolean;
  entities: LoreImportEntityDraft[];
  suggestedLinks: LoreImportLinkDraft[];
};

type LoreSmartImportReviewState = {
  plan: LoreImportPlan;
  sourceText: string;
  sourceTitle?: string;
  fileName?: string;
};

function upsertClarificationAnswer(
  prev: ClarificationAnswer[],
  next: ClarificationAnswer,
): ClarificationAnswer[] {
  return [...prev.filter((a) => a.clarificationId !== next.clarificationId), next];
}

function recommendedClarificationOptionId(
  c: LoreImportClarificationItem,
): string | undefined {
  const r = c.options.find((o) => o.recommended);
  return r?.id ?? c.options[0]?.id;
}

function reportItemLinkFailure(
  operation: string,
  res: Response,
  rawText: string,
  body: Record<string, unknown>,
  logicalOk: boolean,
): string {
  const d = syncFailureFromApiResponse(operation, res, rawText, body, logicalOk);
  const msg =
    d?.message ??
    (rawText.trim() ? rawText.trim().slice(0, 200) : `HTTP ${res.status}`);
  if (getNeonSyncSnapshot().cloudEnabled) {
    neonSyncReportAuxiliaryFailure(
      d ?? {
        operation,
        httpStatus: res.status,
        message: msg,
        responseSnippet: rawText.length > 800 ? `${rawText.slice(0, 800)}…` : rawText,
        cause: "http",
      },
    );
  }
  return msg;
}

async function deleteItemLinkByDbId(dbLinkId: string): Promise<void> {
  try {
    await fetch("/api/item-links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dbLinkId }),
    });
  } catch {
    /* keep local graph authoritative */
  }
}

async function postItemLinkFromConnectionSnapshot(
  c: CanvasPinConnection,
  entities: Record<string, CanvasEntity>,
): Promise<{ ok: boolean; dbLinkId: string | null }> {
  const sourceEntity = entities[c.sourceEntityId];
  const targetEntity = entities[c.targetEntityId];
  const sourceItemId = sourceEntity?.persistedItemId ?? sourceEntity?.id ?? null;
  const targetItemId = targetEntity?.persistedItemId ?? targetEntity?.id ?? null;
  if (!isUuidLike(sourceItemId) || !isUuidLike(targetItemId)) {
    return { ok: false, dbLinkId: null };
  }
  try {
    const res = await fetch("/api/item-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceItemId,
        targetItemId,
        linkType: c.linkType ?? "pin",
        color: c.color,
        sourcePin: `${c.sourcePin.anchor}:${c.sourcePin.insetX}:${c.sourcePin.insetY}`,
        targetPin: `${c.targetPin.anchor}:${c.targetPin.insetX}:${c.targetPin.insetY}`,
        meta: {
          sourcePinConfig: c.sourcePin,
          targetPinConfig: c.targetPin,
          slackMultiplier: clampLinkMetaSlackMultiplier(
            c.slackMultiplier ?? DEFAULT_LINK_SLACK_MULTIPLIER,
          ),
        },
      }),
    });
    const rawText = await res.text();
    const body = parseJsonBody(rawText) as {
      ok?: boolean;
      link?: { id?: string };
      deduped?: boolean;
    };
    const logicalOk = res.ok && body.ok === true;
    if (!logicalOk) {
      reportItemLinkFailure("POST /api/item-links (history)", res, rawText, body, logicalOk);
      return { ok: false, dbLinkId: null };
    }
    return { ok: true, dbLinkId: body.link?.id ?? null };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to persist link";
    if (getNeonSyncSnapshot().cloudEnabled) {
      neonSyncReportAuxiliaryFailure({
        operation: "POST /api/item-links (history)",
        message: msg,
        cause: "network",
      });
    }
    return { ok: false, dbLinkId: null };
  }
}

function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ROOT_SPACE_ID = "root";

/** Empty graph for `scenario === "default"` until bootstrap (and optional seed materialize) finishes — avoids seed → DB entity-id swap flashing. */
function createBootstrapPendingGraph(): CanvasGraph {
  return {
    rootSpaceId: ROOT_SPACE_ID,
    spaces: {
      [ROOT_SPACE_ID]: {
        id: ROOT_SPACE_ID,
        name: ROOT_SPACE_DISPLAY_NAME,
        parentSpaceId: null,
        entityIds: [],
      },
    },
    entities: {},
    connections: {},
  };
}

/** Stable fallback so `useMemo` deps do not churn when a space row has no `entityIds` yet. */
const EMPTY_ENTITY_IDS: readonly string[] = [];

/** True when lengths match and each index is `===` (for selection / id-list no-op updates). */
function sameOrderedStringIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
/** Stable `collapsedStacks` when there are no multi-card stacks (avoids effect loops on new `[]` each render). */
const EMPTY_COLLAPSED_STACKS: { stackId: string; entities: CanvasEntity[]; top: CanvasEntity }[] = [];
const EMPTY_STACK_BOUNDS: Record<string, { left: number; top: number; width: number; height: number }> =
  {};

/** Integer px so JSON compare in stack bounds effects does not churn on subpixel rect noise (infinite re-renders). */
function snapStackBoundsRect(r: {
  left: number;
  top: number;
  width: number;
  height: number;
}): { left: number; top: number; width: number; height: number } {
  return {
    left: Math.round(r.left),
    top: Math.round(r.top),
    width: Math.round(r.width),
    height: Math.round(r.height),
  };
}

/** Avoid setState loops: layout can still jitter by 1px between frames after rounding. */
function stackBoundsRecordsVisuallyEqual(
  prev: Record<string, { left: number; top: number; width: number; height: number }>,
  next: Record<string, { left: number; top: number; width: number; height: number }>,
  tolPx: number,
): boolean {
  const pk = Object.keys(prev).sort();
  const nk = Object.keys(next).sort();
  if (pk.length !== nk.length) return false;
  for (let i = 0; i < pk.length; i++) {
    if (pk[i] !== nk[i]) return false;
  }
  for (const k of pk) {
    const a = prev[k]!;
    const b = next[k]!;
    if (
      Math.abs(a.left - b.left) > tolPx ||
      Math.abs(a.top - b.top) > tolPx ||
      Math.abs(a.width - b.width) > tolPx ||
      Math.abs(a.height - b.height) > tolPx
    ) {
      return false;
    }
  }
  return true;
}

const STACK_BOUNDS_EQ_TOL_PX = 2;

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

function collectDeletionClosure(
  graph: CanvasGraph,
  roots: string[],
): { entityIds: string[]; spaceIds: string[] } {
  const entityIdsToDelete = new Set<string>();
  const spaceIdsToDelete = new Set<string>();

  const markEntity = (entityId: string) => {
    if (entityIdsToDelete.has(entityId)) return;
    const entity = graph.entities[entityId];
    if (!entity) return;
    entityIdsToDelete.add(entityId);

    if (entity.kind !== "folder") return;
    const stack = [entity.childSpaceId];
    while (stack.length > 0) {
      const spaceId = stack.pop();
      if (!spaceId || spaceIdsToDelete.has(spaceId)) continue;
      const space = graph.spaces[spaceId];
      if (!space) continue;
      spaceIdsToDelete.add(spaceId);
      space.entityIds.forEach(markEntity);
      Object.values(graph.spaces).forEach((candidate) => {
        if (candidate.parentSpaceId === spaceId) {
          stack.push(candidate.id);
        }
      });
    }
  };

  roots.forEach((id) => markEntity(id));
  const rootSpaceId = graph.rootSpaceId;
  const spaceIds = [...spaceIdsToDelete].filter((id) => id !== rootSpaceId);
  return { entityIds: [...entityIdsToDelete], spaceIds };
}

/** Spaces to delete remotely: each root of a subtree within `spaceIds` (avoid duplicate DELETE calls). */
function filterSpaceDeletionRoots(spaceIds: string[], graph: CanvasGraph): string[] {
  const set = new Set(spaceIds.filter((id) => id !== graph.rootSpaceId));
  return [...set].filter((id) => {
    const p = graph.spaces[id]?.parentSpaceId ?? null;
    return !p || !set.has(p);
  });
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

function patchTouchesItemContent(patch: Record<string, unknown>): boolean {
  return (
    patch.title !== undefined ||
    patch.contentText !== undefined ||
    patch.contentJson !== undefined
  );
}

/** Flatten one multi-card stack in `spaceId` (shared undo step when called in a loop). */
function applyUnstackStackInSpace(
  snapshot: CanvasGraph,
  stackId: string,
  spaceId: string,
): CanvasGraph {
  const next = shallowCloneGraph(snapshot);
  const members = Object.values(next.entities)
    .filter(
      (entity): entity is Extract<CanvasEntity, { kind: "content" }> =>
        entity.kind === "content" && entity.stackId === stackId,
    )
    .sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0));
  if (members.length === 0) return next;

  const anchor =
    members[members.length - 1]?.slots[spaceId] ??
    members[0]?.slots[spaceId] ?? { x: 0, y: 0 };
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
        [spaceId]: {
          x: Math.round(anchor.x + centeredCol * spacingX),
          y: Math.round(anchor.y + row * spacingY),
        },
      },
    };
  });
  return next;
}

function buildStackGroupsForActiveSpace(
  graph: CanvasGraph,
  activeSpaceEntityIds: readonly string[],
): Map<string, CanvasEntity[]> {
  const groups = new Map<string, CanvasEntity[]>();
  for (const id of activeSpaceEntityIds) {
    const entity = graph.entities[id];
    if (!entity?.stackId) continue;
    const arr = groups.get(entity.stackId) ?? [];
    arr.push(entity);
    groups.set(entity.stackId, arr);
  }
  groups.forEach((arr, key) => {
    groups.set(
      key,
      [...arr].sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0)),
    );
  });
  return groups;
}

/** Derive merge/unstack affordances from current graph + selection (safe to call from refs on pointer events). */
function getStackSelectionState(
  graph: CanvasGraph,
  activeSpaceId: string,
  selectedNodeIds: readonly string[],
) {
  const activeSpaceEntityIds = graph.spaces[activeSpaceId]?.entityIds ?? [];

  const selectedVisibleDeduped: string[] = [];
  const seenVis = new Set<string>();
  for (const id of selectedNodeIds) {
    if (!activeSpaceEntityIds.includes(id)) continue;
    if (seenVis.has(id)) continue;
    seenVis.add(id);
    selectedVisibleDeduped.push(id);
  }

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of selectedVisibleDeduped) {
    const e = graph.entities[id];
    if (e?.kind !== "content") continue;
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  const selectedContentSet = new Set(ordered);

  const stackGroups = buildStackGroupsForActiveSpace(graph, activeSpaceEntityIds);

  const whollySelectedStackIds: string[] = [];
  stackGroups.forEach((members, stackId) => {
    if (members.length < 2) return;
    if (members.every((m) => selectedContentSet.has(m.id))) whollySelectedStackIds.push(stackId);
  });

  const union = new Set<string>();
  whollySelectedStackIds.forEach((sid) => {
    stackGroups.get(sid)?.forEach((m) => union.add(m.id));
  });
  const isUnionOfWhollySelectedStacks =
    whollySelectedStackIds.length >= 1 &&
    selectedVisibleDeduped.length === union.size &&
    selectedVisibleDeduped.every((id) => union.has(id));

  const isExactlyOneFullStack =
    whollySelectedStackIds.length === 1 && isUnionOfWhollySelectedStacks;

  const canMergeStacks = ordered.length >= 2 && !isExactlyOneFullStack;
  const canUnstackWhollySelected = isUnionOfWhollySelectedStacks;

  return {
    orderedContentIds: ordered,
    whollySelectedStackIds,
    canMergeStacks,
    canUnstackWhollySelected,
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
  target: Element,
  viewportEl: HTMLElement | null,
  canvasClassName: string,
  activeTool: CanvasTool,
  spacePanning: boolean,
): boolean {
  // Toolbars use Phosphor (svg/path) glyphs. Those must not count as the canvas surface or we start
  // lasso/pan on icon mousedown; a tiny mouseup then clears selection (lasso “click” path).
  if (
    target.closest(
      "button, a, input, textarea, select, [role='button'], [data-hg-chrome]",
    )
  ) {
    return false;
  }
  if (activeTool === "pan" || spacePanning) return true;
  if (
    target.closest("[data-node-id]") ||
    target.closest("[data-stack-container='true']") ||
    target.closest("[data-connection-id]")
  ) {
    return false;
  }
  if (target === viewportEl) return true;
  /* Scene layer is an ancestor of `.canvas`, not inside it — `closest(canvas)` misses hits on this div. */
  if (target.closest("[data-vigil-scene-layer='true']")) return true;
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

  for (const cols of candidates) {
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
  }

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

/** Map a screen point to canvas world coords (matches node `slots` space) using the transformed `.canvas` rect. */
function clientPointToCanvasWorld(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect | undefined,
  tx: number,
  ty: number,
  scale: number,
): { x: number; y: number } {
  if (!Number.isFinite(scale) || scale === 0) {
    return { x: 0, y: 0 };
  }
  if (!canvasRect?.width) {
    return { x: (clientX - tx) / scale, y: (clientY - ty) / scale };
  }
  const localX = clientX - canvasRect.left;
  const localY = clientY - canvasRect.top;
  return { x: (localX - tx) / scale, y: (localY - ty) / scale };
}

/** Plain text for clipboard / support when bootstrap cannot reach Postgres. */
const WORKSPACE_BOOTSTRAP_ERROR_COPY = `Heartgarden — Could not load workspace

No account data was deleted. This browser session could not open a Postgres workspace.

Fix:
1. Add NEON_DATABASE_URL or DATABASE_URL to vigil/.env.local (your Neon connection string).
2. Restart the dev server from the vigil folder: npm run dev
3. Reload this page.

After one successful load, Heartgarden keeps a local snapshot in this browser so short outages still show your garden.`;

function WorkspaceBootstrapErrorPanel() {
  const [copied, setCopied] = useState(false);

  const onCopyDetails = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(WORKSPACE_BOOTSTRAP_ERROR_COPY);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = WORKSPACE_BOOTSTRAP_ERROR_COPY;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      } catch {
        window.alert("Could not copy automatically — select the text in the box and press Ctrl+C (⌘C on Mac).");
      }
    }
  }, []);

  return (
    <div
      className={styles.neonWorkspaceUnavailableOverlay}
      role="alert"
      aria-live="assertive"
      data-workspace-blocking-no-snapshot="true"
    >
      <div className={`${styles.glassPanel} ${styles.neonWorkspaceUnavailablePanel}`}>
        <h2 className={styles.neonWorkspaceUnavailableTitle}>
          <WarningCircle
            className={styles.neonWorkspaceUnavailableIcon}
            size={22}
            weight="bold"
            aria-hidden
          />
          Could not load workspace
        </h2>
        <p className={styles.neonWorkspaceUnavailableLead}>
          Nothing was removed from your account — we could not open a database-backed workspace from
          this session. Use the message below for setup or support.
        </p>
        <div className={styles.neonWorkspaceUnavailableCopySection}>
          <div className={styles.neonWorkspaceUnavailableCopyToolbar}>
            <span id="hg-ws-err-copy-label" className={styles.neonWorkspaceUnavailableCopyLabel}>
              Full message
            </span>
            <ArchitecturalButton
              type="button"
              size="menu"
              tone="glass"
              leadingIcon={<CopySimple size={16} weight="bold" aria-hidden />}
              onClick={onCopyDetails}
              aria-labelledby="hg-ws-err-copy-label"
            >
              {copied ? "Copied" : "Copy"}
            </ArchitecturalButton>
          </div>
          <pre className={styles.neonWorkspaceUnavailablePre} tabIndex={0}>
            {WORKSPACE_BOOTSTRAP_ERROR_COPY}
          </pre>
        </div>
        <p className={styles.neonWorkspaceUnavailableFoot}>
          Both <span className={styles.monoSmall}>NEON_DATABASE_URL</span> and{" "}
          <span className={styles.monoSmall}>DATABASE_URL</span> are read from{" "}
          <span className={styles.monoSmall}>vigil/.env.local</span>.
        </p>
      </div>
    </div>
  );
}

type HeartgardenBootStatusJson = {
  gateEnabled?: boolean;
  sessionValid?: boolean;
  sessionTier?: unknown;
  playerLayerMisconfigured?: boolean;
};

export type HeartgardenBootApiState = {
  loaded: boolean;
  gateEnabled: boolean;
  sessionValid: boolean;
  sessionTier: "access" | "visitor" | "demo" | null;
  playerLayerMisconfigured: boolean;
};

function parseHeartgardenBootStatus(d: HeartgardenBootStatusJson): HeartgardenBootApiState {
  const st = d.sessionTier;
  const tier = st === "access" || st === "visitor" || st === "demo" ? st : null;
  return {
    loaded: true,
    gateEnabled: Boolean(d.gateEnabled),
    sessionValid: Boolean(d.sessionValid),
    sessionTier: tier,
    playerLayerMisconfigured: Boolean(d.gateEnabled && d.playerLayerMisconfigured),
  };
}

/** Local-only demo canvas (no Neon); same showcase as nested scenario seed. */
function buildHeartgardenNestedDemoGraph() {
  return buildArchitecturalSeedGraph(
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
    "nested",
  );
}

function workspaceCacheTierForNeonSession(b: HeartgardenBootApiState): WorkspaceBootTierTag {
  if (!b.gateEnabled) return "open";
  if (b.sessionTier === "access") return "access";
  if (b.sessionTier === "visitor") return "visitor";
  return "open";
}

export function ArchitecturalCanvasApp({
  scenario = "default",
}: {
  scenario?: ArchitecturalCanvasScenario;
}) {
  const [graph, setGraph] = useState<CanvasGraph>(() =>
    scenario === "default"
      ? createBootstrapPendingGraph()
      : buildArchitecturalSeedGraph(
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
  const connectionModeSoundPrevRef = useRef<ConnectionDockMode>("move");
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [connectionColor, setConnectionColor] = useState(CONNECTION_DEFAULT_COLOR);
  const [connectionCursorWorld, setConnectionCursorWorld] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [lassoRectScreen, setLassoRectScreen] = useState<LassoRectScreen | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  /** After fonts + layout frame; drives viewport fade-in and avoids first-paint hiccups. */
  const [canvasSurfaceReady, setCanvasSurfaceReady] = useState(false);
  /** For app route: hide canvas content until bootstrap resolves (single graph + camera commit). */
  const [canvasBootstrapResolved, setCanvasBootstrapResolved] = useState(() => scenario !== "default");
  /**
   * Default route only: null while bootstrap in flight; true when Neon returned a real workspace;
   * false when offline / demo bootstrap (no DB or failed request).
   */
  const [neonWorkspaceOk, setNeonWorkspaceOk] = useState<boolean | null>(() =>
    scenario === "default" ? null : true,
  );
  /** True when the canvas is hydrated from localStorage because live bootstrap failed (still looks “loaded”). */
  const [workspaceViewFromCache, setWorkspaceViewFromCache] = useState(false);
  const [navTransitionActive, setNavTransitionActive] = useState(false);
  const [itemConflictQueue, setItemConflictQueue] = useState<CanvasItem[]>([]);
  const itemConflictQueueRef = useRef<CanvasItem[]>([]);
  const [presencePeerCount, setPresencePeerCount] = useState(0);
  const [canvasEffectsEnabled, setCanvasEffectsEnabled] = useState(true);
  const canvasEffectsEnabledRef = useRef(true);
  const canvasEffectsSoundInitRef = useRef(false);
  const canvasEffectsSoundPrevRef = useRef(true);
  /** Canvas effects toggle: dedupe so boot + chrome surfaces do not fight React state. */
  const handleCanvasEffectsEnabledChange = useCallback((next: boolean) => {
    setCanvasEffectsEnabled((prev) => (prev === next ? prev : next));
  }, []);

  /** Default route: user must click Activate; flow runs 0→1 only then. Nested/corrupt: no gate. */
  const [canvasSessionActivated, setCanvasSessionActivated] = useState(false);
  /** Bumps on each “Enter the garden” (and once for non-default scenarios) so chrome keyframes replay. */
  const [chromeEnterEpoch, setChromeEnterEpoch] = useState(0);
  /** One celebration SFX per boot stay (reset on log out). */
  const bootCelebrationPlayedRef = useRef(false);
  const neonUiSoundRef = useRef<{
    lastError: string | null;
    busy: boolean;
    idleTimer: ReturnType<typeof setTimeout> | null;
  }>({ lastError: null, busy: false, idleTimer: null });
  /** Boot UI removed after exit animation (or immediately if reduced motion). */
  const [bootLayerDismissed, setBootLayerDismissed] = useState(() => scenario !== "default");
  /** Lets reduced-motion users see the auth splash again after explicit Log out. */
  const [bootAfterLogout, setBootAfterLogout] = useState(false);
  /** GET /api/heartgarden/boot — gate + cookie session (no secrets in state). */
  const [heartgardenBootApi, setHeartgardenBootApi] = useState<HeartgardenBootApiState>({
    loaded: false,
    gateEnabled: false,
    sessionValid: false,
    sessionTier: null,
    playerLayerMisconfigured: false,
  });
  /** Players PIN + `HEARTGARDEN_PLAYER_SPACE_ID`: scoped notes layer (server-enforced). */
  const isPlayersTier = useMemo(
    () =>
      heartgardenBootApi.loaded &&
      heartgardenBootApi.gateEnabled &&
      heartgardenBootApi.sessionTier === "visitor",
    [
      heartgardenBootApi.loaded,
      heartgardenBootApi.gateEnabled,
      heartgardenBootApi.sessionTier,
    ],
  );
  const isDemoTier = useMemo(
    () =>
      heartgardenBootApi.loaded &&
      heartgardenBootApi.gateEnabled &&
      heartgardenBootApi.sessionTier === "demo",
    [heartgardenBootApi.loaded, heartgardenBootApi.gateEnabled, heartgardenBootApi.sessionTier],
  );
  /** Hide GM-only affordances (Players + Demo local canvas). */
  const isRestrictedLayer = isPlayersTier || isDemoTier;
  const heartgardenBootApiRef = useRef(heartgardenBootApi);
  heartgardenBootApiRef.current = heartgardenBootApi;

  const bootServerConfigurationError = useMemo(
    () =>
      heartgardenBootApi.loaded &&
      heartgardenBootApi.gateEnabled &&
      heartgardenBootApi.playerLayerMisconfigured
        ? "The Players access layer is misconfigured (missing or invalid HEARTGARDEN_PLAYER_SPACE_ID). Contact the operator."
        : null,
    [
      heartgardenBootApi.loaded,
      heartgardenBootApi.gateEnabled,
      heartgardenBootApi.playerLayerMisconfigured,
    ],
  );

  /** Bumps when returning to auth so boot ambient remounts and can play again after tear-down. */
  const [bootAmbientEpoch, setBootAmbientEpoch] = useState(0);
  /** Populated by `VigilBootAmbientAudio`; log-out handler calls after `flushSync` (same gesture as click). */
  const bootAmbientPrimePlaybackRef = useRef<(() => void) | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const [focusOpen, setFocusOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteOpenSoundPrevRef = useRef(false);
  const [lorePanelOpen, setLorePanelOpen] = useState(false);
  const lorePanelOpenRef = useRef(false);
  const lorePanelOpenSoundPrevRef = useRef(false);
  const [graphOverlayOpen, setGraphOverlayOpen] = useState(false);
  const graphOverlayOpenSoundPrevRef = useRef(false);
  const [loreImportDraft, setLoreImportDraft] = useState<LoreImportDraftState | null>(null);
  const [loreSmartReview, setLoreSmartReview] = useState<LoreSmartImportReviewState | null>(null);
  const [loreSmartTab, setLoreSmartTab] = useState<"structure" | "merges" | "questions">(
    "structure",
  );
  const [loreSmartPlanning, setLoreSmartPlanning] = useState(false);
  const [loreSmartIncludeSource, setLoreSmartIncludeSource] = useState(true);
  const [loreSmartAcceptedMergeIds, setLoreSmartAcceptedMergeIds] = useState<Record<string, boolean>>(
    {},
  );
  const [loreSmartClarificationAnswers, setLoreSmartClarificationAnswers] = useState<
    ClarificationAnswer[]
  >([]);
  const loreSmartClarificationsOk = useMemo(() => {
    if (!loreSmartReview) return true;
    return validateClarificationAnswersForApply(
      loreSmartReview.plan,
      loreSmartClarificationAnswers,
    ).ok;
  }, [loreSmartReview, loreSmartClarificationAnswers]);
  const [loreReviewPanelOpen, setLoreReviewPanelOpen] = useState(false);
  const [loreReviewLoading, setLoreReviewLoading] = useState(false);
  const [loreReviewError, setLoreReviewError] = useState<string | null>(null);
  const [loreReviewIssues, setLoreReviewIssues] = useState<VaultReviewIssue[]>([]);
  const [loreReviewSuggestedTags, setLoreReviewSuggestedTags] = useState<string[]>([]);
  const [loreReviewSemanticSummary, setLoreReviewSemanticSummary] = useState<string | null>(null);
  const [loreImportCommitting, setLoreImportCommitting] = useState(false);
  const loreImportDraftRef = useRef<LoreImportDraftState | null>(null);
  const [cloudLinksBar, setCloudLinksBar] = useState(() => getNeonSyncSnapshot().cloudEnabled);
  const neonSyncSnapshot = useSyncExternalStore(
    subscribeNeonSync,
    getNeonSyncSnapshot,
    getNeonSyncServerSnapshot,
  );
  const dockCreateDisabledBySyncError = useMemo(() => {
    if (isRestrictedLayer || !isUuidLike(activeSpaceId)) return false;
    if (!cloudLinksBar) return false;
    return Boolean(neonSyncSnapshot.lastError?.trim());
  }, [activeSpaceId, cloudLinksBar, isRestrictedLayer, neonSyncSnapshot.lastError]);
  const dockCreateSyncDisabledHint = useMemo(
    () =>
      dockCreateDisabledBySyncError
        ? "Cannot save new items while database sync shows an error — open the top-left status control for details"
        : null,
    [dockCreateDisabledBySyncError],
  );
  const loreImportFileInputRef = useRef<HTMLInputElement | null>(null);
  const [galleryNodeId, setGalleryNodeId] = useState<string | null>(null);
  const galleryNodeIdRef = useRef<string | null>(null);
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

  useEffect(() => {
    loreImportDraftRef.current = loreImportDraft;
  }, [loreImportDraft]);

  /** `orderedIds`: front-to-back (top-of-stack / foremost card first) for layout and expanded grid. */
  const [stackModal, setStackModal] = useState<{
    stackId: string;
    orderedIds: string[];
    originX: number;
    originY: number;
    /** Collapsed stack anchor in canvas world (matches container `left`/`top`). */
    anchorWorld: { x: number; y: number };
    /** Screen-space top-left of the stack container when the modal opened (for eject math). */
    stackScreenLeft: number;
    stackScreenTop: number;
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
  /** Frozen active-space entity ids for eject hull during a stack drag (layout swaps won’t shrink/grow the drop zone). */
  const stackDragHullOrderedIdsRef = useRef<string[] | null>(null);
  /** Latest stack order during an active stack drag (synced before React re-render). */
  const stackModalOrderedIdsDuringDragRef = useRef<string[] | null>(null);
  /** Baseline order at stack drag start (for reorder vs eject SFX). */
  const stackModalDragStartOrderedIdsRef = useRef<string[] | null>(null);
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
  const [bootFlowerPortalHost, setBootFlowerPortalHost] = useState<HTMLDivElement | null>(null);
  const setViewportNode = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
  }, []);

  const setBootFlowerPortalNode = useCallback((node: HTMLDivElement | null) => {
    setBootFlowerPortalHost(node);
  }, []);
  /** Element with `transform: translate scale` — used for stack eject screen→world. */
  const canvasTransformRef = useRef<HTMLDivElement | null>(null);
  /** Lasso hit-test scope: canvas nodes only (excludes stack modal fan, chrome, etc.). */
  const canvasEntityLayerRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const ropeRuntimeRef = useRef<Record<string, RopeRuntime>>({});
  /** Rope paths update every frame via `setAttribute`; avoid `setState` in rAF (re-render storms / max depth). */
  const connectionLayerSvgRef = useRef<SVGSVGElement | null>(null);
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
  /** `pointerId` that started the active lasso; ignore other pointers until release. */
  const lassoPointerIdRef = useRef<number | null>(null);
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
  const alignSelectedInGridRef = useRef<() => void>(() => {});
  const undoPastRef = useRef<ArchitecturalUndoSnapshot[]>([]);
  const undoFutureRef = useRef<ArchitecturalUndoSnapshot[]>([]);
  const isApplyingHistoryRef = useRef(false);
  const focusOpenRef = useRef(focusOpen);
  const galleryOpenRef = useRef(galleryOpen);
  const paletteOpenRef = useRef(false);
  const activeNodeIdRef = useRef(activeNodeId);
  const pendingMediaUploadRef = useRef<{ mode: "focus" | "canvas"; id: string } | null>(null);
  const persistNeonRef = useRef(false);
  const itemContentPatchTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const cameraPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemServerUpdatedAtRef = useRef<Map<string, string>>(new Map());
  /** While undo restores a deleted row, collab merge must not tombstone it before POST /items completes. */
  const remoteTombstoneExemptIdsRef = useRef<Set<string>>(new Set());
  const syncCursorRef = useRef<string>(new Date(0).toISOString());
  const focusDirtyRef = useRef(false);
  const inlineContentDirtyIdsRef = useRef<Set<string>>(new Set());
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastFormatRangeRef = useRef<Range | null>(null);
  const [historyEpoch, setHistoryEpoch] = useState(0);

  graphRef.current = graph;
  viewRef.current = { scale, tx: translateX, ty: translateY };
  maxZIndexRef.current = maxZIndex;
  stackModalRef.current = stackModal;
  stackDragRef.current = stackDrag;
  stackModalCardHeightsRef.current = stackModalCardHeights;
  activeSpaceIdRef.current = activeSpaceId;
  navigationPathRef.current = navigationPath;
  selectedNodeIdsRef.current = selectedNodeIds;
  focusOpenRef.current = focusOpen;
  galleryOpenRef.current = galleryOpen;
  paletteOpenRef.current = paletteOpen;
  lorePanelOpenRef.current = lorePanelOpen;
  activeNodeIdRef.current = activeNodeId;
  galleryNodeIdRef.current = galleryNodeId;
  itemConflictQueueRef.current = itemConflictQueue;

  const modKeyHints = useModKeyHints();
  const { items: recentItems, push: pushRecentItem, pruneIds: pruneRecentItems } =
    useRecentItems();
  const { items: recentFolders, push: pushRecentFolder, pruneIds: pruneRecentFolders } =
    useRecentFolders();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (lorePanelOpenRef.current) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setPaletteOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const createId = useCallback(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    idCounterRef.current += 1;
    return `hg-${Date.now()}-${idCounterRef.current}`;
  }, []);

  useEffect(() => subscribeNeonSync(() => setCloudLinksBar(getNeonSyncSnapshot().cloudEnabled)), []);

  useEffect(() => {
    const snap0 = getNeonSyncSnapshot();
    const r0 = neonUiSoundRef.current;
    r0.lastError = snap0.lastError;
    r0.busy = snap0.pending > 0 || snap0.inFlight > 0;
  }, []);

  useEffect(() => {
    return subscribeNeonSync(() => {
      const sync = getNeonSyncSnapshot();
      const r = neonUiSoundRef.current;
      if (!sync.cloudEnabled) {
        r.lastError = sync.lastError;
        r.busy = sync.pending > 0 || sync.inFlight > 0;
        if (r.idleTimer) {
          clearTimeout(r.idleTimer);
          r.idleTimer = null;
        }
        return;
      }
      const err = sync.lastError;
      if (!r.lastError && err) playVigilUiSound("caution");
      if (r.lastError && !err) playVigilUiSound("notification");
      const busy = sync.pending > 0 || sync.inFlight > 0;
      if (r.busy && !busy && !err) {
        if (r.idleTimer) clearTimeout(r.idleTimer);
        r.idleTimer = setTimeout(() => {
          playVigilUiSound("notification");
          neonUiSoundRef.current.idleTimer = null;
        }, 420);
      }
      if (busy && r.idleTimer) {
        clearTimeout(r.idleTimer);
        r.idleTimer = null;
      }
      r.lastError = err;
      r.busy = busy;
    });
  }, []);

  useEffect(() => {
    const prev = paletteOpenSoundPrevRef.current;
    paletteOpenSoundPrevRef.current = paletteOpen;
    if (prev !== paletteOpen) playVigilUiSound("tap");
  }, [paletteOpen]);

  useEffect(() => {
    if (lorePanelOpenSoundPrevRef.current && !lorePanelOpen) playVigilUiSound("tap");
    lorePanelOpenSoundPrevRef.current = lorePanelOpen;
  }, [lorePanelOpen]);

  useEffect(() => {
    if (graphOverlayOpenSoundPrevRef.current && !graphOverlayOpen) playVigilUiSound("tap");
    graphOverlayOpenSoundPrevRef.current = graphOverlayOpen;
  }, [graphOverlayOpen]);

  useEffect(() => {
    const prev = connectionModeSoundPrevRef.current;
    connectionModeSoundPrevRef.current = connectionMode;
    if (prev === connectionMode) return;
    if (prev === "move" && connectionMode !== "move") playVigilUiSound("toggle_on");
    else if (prev !== "move" && connectionMode === "move") playVigilUiSound("toggle_off");
    else playVigilUiSound("select");
  }, [connectionMode]);

  useEffect(() => {
    if (!canvasEffectsSoundInitRef.current) {
      canvasEffectsSoundInitRef.current = true;
      canvasEffectsSoundPrevRef.current = canvasEffectsEnabled;
      return;
    }
    if (canvasEffectsSoundPrevRef.current !== canvasEffectsEnabled) {
      playVigilUiSound(canvasEffectsEnabled ? "toggle_on" : "toggle_off");
      canvasEffectsSoundPrevRef.current = canvasEffectsEnabled;
    }
  }, [canvasEffectsEnabled]);

  const enqueueItemConflict = useCallback((item: CanvasItem) => {
    setItemConflictQueue((q) => {
      const deduped = q.filter((i) => i.id !== item.id);
      return [...deduped, item].slice(-8);
    });
  }, []);

  const patchItemWithVersion = useCallback(
    async (itemId: string, patch: Record<string, unknown>) => {
      const base = itemServerUpdatedAtRef.current.get(itemId);
      const body: Record<string, unknown> = base ? { ...patch, baseUpdatedAt: base } : { ...patch };
      const r = await apiPatchItem(itemId, body);
      if (r.ok) {
        if (r.item.updatedAt) itemServerUpdatedAtRef.current.set(itemId, r.item.updatedAt);
        return true;
      }
      if (!r.ok && "gone" in r && r.gone) {
        itemServerUpdatedAtRef.current.delete(itemId);
        const prevT = itemContentPatchTimersRef.current.get(itemId);
        if (prevT) {
          clearTimeout(prevT);
          itemContentPatchTimersRef.current.delete(itemId);
          neonSyncUnbumpPending();
        }
        inlineContentDirtyIdsRef.current.delete(itemId);
        setItemConflictQueue((q) => q.filter((i) => i.id !== itemId));
        setGraph((prev) => removeEntitiesFromGraphAfterRemoteDelete(prev, [itemId]));
        pruneRecentItems(new Set([itemId]));
        pruneRecentFolders(new Set([itemId]));
        setSelectedNodeIds((p) => p.filter((id) => id !== itemId));
        if (activeNodeIdRef.current === itemId) {
          setFocusOpen(false);
          setActiveNodeId(null);
        }
        if (galleryNodeIdRef.current === itemId) {
          setGalleryOpen(false);
          setGalleryNodeId(null);
          setGalleryDraftTitle("");
          setGalleryDraftNotes("");
          setGalleryBaselineTitle("");
          setGalleryBaselineNotes("");
        }
        return false;
      }
      if (!r.ok && "conflict" in r && r.conflict) {
        if (!patchTouchesItemContent(patch)) {
          setGraph((prev) => applyServerCanvasItemToGraph(prev, r.item));
          if (r.item.updatedAt) itemServerUpdatedAtRef.current.set(r.item.id, r.item.updatedAt);
          return false;
        }
        const serverAt = r.item.updatedAt;
        if (typeof serverAt === "string" && serverAt.length > 0) {
          itemServerUpdatedAtRef.current.set(itemId, serverAt);
          const r2 = await apiPatchItem(itemId, { ...patch, baseUpdatedAt: serverAt });
          if (r2.ok) {
            if (r2.item.updatedAt) itemServerUpdatedAtRef.current.set(itemId, r2.item.updatedAt);
            return true;
          }
          if (!r2.ok && "conflict" in r2 && r2.conflict) {
            enqueueItemConflict(r2.item);
            return false;
          }
        }
        enqueueItemConflict(r.item);
      }
      return false;
    },
    [enqueueItemConflict, pruneRecentFolders, pruneRecentItems],
  );

  const applyItemConflictFromServer = useCallback(() => {
    const it = itemConflictQueueRef.current[0];
    if (!it) return;
    setGraph((prev) => applyServerCanvasItemToGraph(prev, it));
    if (it.updatedAt) itemServerUpdatedAtRef.current.set(it.id, it.updatedAt);
    queueMicrotask(() => {
      const e = graphRef.current.entities[it.id];
      if (e && e.kind === "content" && activeNodeIdRef.current === it.id) {
        setFocusBody(e.bodyHtml);
        setFocusBaselineBody(e.bodyHtml);
        setFocusTitle(e.title);
        setFocusBaselineTitle(e.title);
      }
    });
    setItemConflictQueue((q) => q.slice(1));
  }, []);

  const dismissConflictHead = useCallback(() => {
    setItemConflictQueue((q) => q.slice(1));
  }, []);

  const schedulePersistContentBody = useCallback(
    (entityId: string, bodyHtml: string) => {
      if (!persistNeonRef.current || !isUuidLike(entityId)) return;
      const prevT = itemContentPatchTimersRef.current.get(entityId);
      const isFirstTimerForEntity = !prevT;
      if (prevT) clearTimeout(prevT);
      if (isFirstTimerForEntity) neonSyncBumpPending();
      const t = setTimeout(() => {
        itemContentPatchTimersRef.current.delete(entityId);
        neonSyncUnbumpPending();
        const ent = graphRef.current.entities[entityId];
        if (!ent || ent.kind !== "content") return;
        const contentJson = buildContentJsonForContentEntity({ ...ent, bodyHtml });
        void patchItemWithVersion(entityId, {
          contentText: htmlToPlainText(bodyHtml),
          contentJson,
        });
      }, 450);
      itemContentPatchTimersRef.current.set(entityId, t);
    },
    [patchItemWithVersion],
  );

  /** After item layout PATCH, align each folder's inner `spaces.parent_space_id` with the space that holds the folder card. */
  const persistNeonFolderInnerSpaceParentsAfterLayout = useCallback(
    (ids: string[], graphSnapshot?: CanvasGraph) => {
      if (!persistNeonRef.current) return;
      const g = graphSnapshot ?? graphRef.current;
      const active = activeSpaceIdRef.current;
      for (const id of ids) {
        if (!isUuidLike(id)) continue;
        const e = g.entities[id];
        if (!e || e.kind !== "folder") continue;
        if (!isUuidLike(e.childSpaceId)) continue;
        const holders = Object.values(g.spaces).filter((s) => s.entityIds.includes(id));
        if (holders.length === 0) continue;
        const primary =
          holders.length === 1
            ? holders[0]!.id
            : holders.find((s) => s.id === active)?.id ?? holders[0]!.id;
        if (!isUuidLike(primary)) continue;
        void apiPatchSpaceParent(e.childSpaceId, primary);
      }
    },
    [],
  );

  /** Persist geometry and `items.spaceId` from whichever space currently owns each entity in the graph. */
  const persistNeonItemsLayout = useCallback((ids: string[], graphSnapshot?: CanvasGraph) => {
    if (!persistNeonRef.current) return;
    const g = graphSnapshot ?? graphRef.current;
    const active = activeSpaceIdRef.current;
    for (const id of ids) {
      if (!isUuidLike(id)) continue;
      const e = g.entities[id];
      if (!e) continue;
      const holders = Object.values(g.spaces).filter((s) => s.entityIds.includes(id));
      if (holders.length === 0) continue;
      const primary =
        holders.length === 1
          ? holders[0]!.id
          : holders.find((s) => s.id === active)?.id ?? holders[0]!.id;
      const geo = entityGeometryOnSpace(e, primary);
      const patch: Record<string, unknown> = {
        spaceId: primary,
        x: geo.x,
        y: geo.y,
        width: geo.width,
        height: geo.height,
      };
      if (e.kind === "content") {
        if (!e.stackId) {
          patch.stackId = null;
          patch.stackOrder = null;
        } else if (isUuidLike(e.stackId)) {
          patch.stackId = e.stackId;
          patch.stackOrder = e.stackOrder ?? null;
        }
      }
      void patchItemWithVersion(id, patch);
    }
    persistNeonFolderInnerSpaceParentsAfterLayout(ids, g);
  }, [patchItemWithVersion, persistNeonFolderInnerSpaceParentsAfterLayout]);

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
    stackModalRef.current = null;
    setStackModalEjectPreview(false);
    setHoveredStackTargetId(null);
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

  const syncNeonAfterHistoryTransition = useCallback(
    async (from: CanvasGraph, to: CanvasGraph) => {
      if (!persistNeonRef.current) return;

      const fromConnIds = new Set(Object.keys(from.connections));
      const toConnIds = new Set(Object.keys(to.connections));
      for (const cid of fromConnIds) {
        if (toConnIds.has(cid)) continue;
        const c = from.connections[cid];
        if (c?.dbLinkId && isUuidLike(c.dbLinkId)) {
          void deleteItemLinkByDbId(c.dbLinkId);
        }
      }

      const fromIds = new Set(Object.keys(from.entities));
      const toIds = new Set(Object.keys(to.entities));
      const added = [...toIds].filter((id) => !fromIds.has(id) && isUuidLike(id));
      const removed = [...fromIds].filter((id) => !toIds.has(id) && isUuidLike(id));

      if (removed.length > 0) {
        const { entityIds: idsToRemove, spaceIds } = collectDeletionClosure(from, removed);
        const spaceRoots = filterSpaceDeletionRoots(spaceIds, from);
        for (const id of idsToRemove) {
          if (isUuidLike(id)) void apiDeleteItem(id);
        }
        for (const sid of spaceRoots) {
          if (isUuidLike(sid)) void apiDeleteSpaceSubtree(sid);
        }
      }

      const addedSpaceIds = new Set(
        Object.keys(to.spaces).filter(
          (sid) => !from.spaces[sid] && isUuidLike(sid) && sid !== to.rootSpaceId,
        ),
      );
      if (addedSpaceIds.size > 0) {
        const spaceOrder = topoSortAddedSpacesForRestore(addedSpaceIds, to.spaces);
        for (const sid of spaceOrder) {
          const row = to.spaces[sid];
          if (!row) continue;
          await apiCreateSpace(row.name?.trim() || "Folder", row.parentSpaceId ?? null, { id: sid });
        }
      }

      for (const id of added) {
        const ent = to.entities[id];
        if (!ent) continue;

        remoteTombstoneExemptIdsRef.current.add(id);
        const payload =
          ent.kind === "folder"
            ? buildFolderItemRestorePayload(to, id, ent)
            : buildContentItemRestorePayload(to, id, ent);
        if (!payload) {
          remoteTombstoneExemptIdsRef.current.delete(id);
          continue;
        }
        try {
          const res = await apiCreateItem(payload.spaceId, payload.body);
          if (res.ok && res.item?.updatedAt) {
            itemServerUpdatedAtRef.current.set(id, res.item.updatedAt);
          }
        } finally {
          remoteTombstoneExemptIdsRef.current.delete(id);
        }
      }

      for (const cid of toConnIds) {
        if (fromConnIds.has(cid)) continue;
        const c = to.connections[cid];
        if (!c) continue;
        const result = await postItemLinkFromConnectionSnapshot(c, to.entities);
        if (result.ok && result.dbLinkId && isUuidLike(result.dbLinkId)) {
          setGraph((prev) => {
            const cur = prev.connections[cid];
            if (!cur) return prev;
            const next = shallowCloneGraph(prev);
            next.connections[cid] = {
              ...cur,
              dbLinkId: result.dbLinkId,
              syncState: "synced",
              syncError: null,
            };
            return next;
          });
        } else if (result.ok) {
          setGraph((prev) => {
            const cur = prev.connections[cid];
            if (!cur) return prev;
            const next = shallowCloneGraph(prev);
            next.connections[cid] = {
              ...cur,
              syncState: "error",
              syncError: "Thread restored but server returned no link id",
            };
            return next;
          });
        } else if (!result.ok) {
          setGraph((prev) => {
            const cur = prev.connections[cid];
            if (!cur) return prev;
            const next = shallowCloneGraph(prev);
            next.connections[cid] = {
              ...cur,
              syncState: "error",
              syncError: "Could not restore thread on server",
            };
            return next;
          });
        }
      }

      const layoutIds = collectIdsNeedingNeonLayoutResync(from, to);
      if (layoutIds.length > 0) {
        persistNeonItemsLayout(layoutIds, to);
      }
      for (const { spaceId, parentSpaceId } of collectSpacesNeedingParentResync(from, to)) {
        if (!isUuidLike(spaceId)) continue;
        if (parentSpaceId !== null && !isUuidLike(parentSpaceId)) continue;
        void apiPatchSpaceParent(spaceId, parentSpaceId);
      }
    },
    [persistNeonItemsLayout, setGraph],
  );

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
    if (persistNeonRef.current) {
      void syncNeonAfterHistoryTransition(current.graph, rGraph);
    }
    requestAnimationFrame(() => {
      isApplyingHistoryRef.current = false;
    });
    setHistoryEpoch((n) => n + 1);
  }, [closeStackModal, syncNeonAfterHistoryTransition]);

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
    if (persistNeonRef.current) {
      void syncNeonAfterHistoryTransition(current.graph, rGraph);
    }
    requestAnimationFrame(() => {
      isApplyingHistoryRef.current = false;
    });
    setHistoryEpoch((n) => n + 1);
  }, [closeStackModal, syncNeonAfterHistoryTransition]);

  const undoFromDock = useCallback(() => {
    if (undoPastRef.current.length === 0) return;
    undo();
    playVigilUiSound("tap");
  }, [undo]);

  const redoFromDock = useCallback(() => {
    if (undoFutureRef.current.length === 0) return;
    redo();
    playVigilUiSound("tap");
  }, [redo]);

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
    const timers = commitTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
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
            linkType: snap.linkType ?? "pin",
            color: snap.color,
            sourcePin: `${snap.sourcePin.anchor}:${snap.sourcePin.insetX}:${snap.sourcePin.insetY}`,
            targetPin: `${snap.targetPin.anchor}:${snap.targetPin.insetX}:${snap.targetPin.insetY}`,
            meta: {
              sourcePinConfig: snap.sourcePin,
              targetPinConfig: snap.targetPin,
              slackMultiplier: clampLinkMetaSlackMultiplier(
                snap.slackMultiplier ?? DEFAULT_LINK_SLACK_MULTIPLIER,
              ),
            },
          }),
        });
        const rawText = await res.text();
        const body = parseJsonBody(rawText) as {
          ok?: boolean;
          link?: { id?: string };
          deduped?: boolean;
        };
        const logicalOk = res.ok && body.ok === true;
        if (!logicalOk) {
          const msg = reportItemLinkFailure("POST /api/item-links", res, rawText, body, logicalOk);
          setConnectionSyncPatch(connectionId, { syncState: "error", syncError: msg });
          return;
        }
        setConnectionSyncPatch(connectionId, {
          syncState: "synced",
          dbLinkId: body.link?.id ?? snap.dbLinkId ?? null,
          syncError: null,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to persist link";
        setConnectionSyncPatch(connectionId, {
          syncState: "error",
          syncError: msg,
        });
        if (getNeonSyncSnapshot().cloudEnabled) {
          neonSyncReportAuxiliaryFailure({
            operation: "POST /api/item-links",
            message: msg,
            cause: "network",
          });
        }
      }
    },
    [setConnectionSyncPatch],
  );

  const syncConnectionSlack = useCallback(
    async (connectionId: string, slackMultiplier: number) => {
      const snap = graphRef.current.connections[connectionId];
      if (!snap?.dbLinkId || !isUuidLike(snap.dbLinkId)) return;
      try {
        const res = await fetch("/api/item-links", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: snap.dbLinkId,
            meta: { slackMultiplier: clampLinkMetaSlackMultiplier(slackMultiplier) },
          }),
        });
        const rawText = await res.text();
        const body = parseJsonBody(rawText) as { ok?: boolean; error?: string };
        const logicalOk = res.ok && body.ok === true;
        if (!logicalOk) {
          const msg = reportItemLinkFailure(
            "PATCH /api/item-links (slack)",
            res,
            rawText,
            body,
            logicalOk,
          );
          setConnectionSyncPatch(connectionId, { syncState: "error", syncError: msg });
          return;
        }
        setConnectionSyncPatch(connectionId, { syncState: "synced", syncError: null });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to sync thread slack";
        setConnectionSyncPatch(connectionId, {
          syncState: "error",
          syncError: msg,
        });
        if (getNeonSyncSnapshot().cloudEnabled) {
          neonSyncReportAuxiliaryFailure({
            operation: "PATCH /api/item-links (slack)",
            message: msg,
            cause: "network",
          });
        }
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
        const res = await fetch("/api/item-links", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: snap.dbLinkId, color }),
        });
        const rawText = await res.text();
        const body = parseJsonBody(rawText) as { ok?: boolean; error?: string };
        const logicalOk = res.ok && body.ok === true;
        if (!logicalOk) {
          const msg = reportItemLinkFailure(
            "PATCH /api/item-links (color)",
            res,
            rawText,
            body,
            logicalOk,
          );
          setConnectionSyncPatch(connectionId, { syncState: "error", syncError: msg });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to sync connection color";
        setConnectionSyncPatch(connectionId, {
          syncState: "error",
          syncError: msg,
        });
        if (getNeonSyncSnapshot().cloudEnabled) {
          neonSyncReportAuxiliaryFailure({
            operation: "PATCH /api/item-links (color)",
            message: msg,
            cause: "network",
          });
        }
      }
    },
    [setConnectionSyncPatch],
  );

  const syncLinkTypeConnection = useCallback(
    async (connectionId: string, linkType: string) => {
      const snap = graphRef.current.connections[connectionId];
      if (!snap?.dbLinkId || !isUuidLike(snap.dbLinkId)) return;
      try {
        const res = await fetch("/api/item-links", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: snap.dbLinkId, linkType }),
        });
        const rawText = await res.text();
        const body = parseJsonBody(rawText) as { ok?: boolean; error?: string };
        const logicalOk = res.ok && body.ok === true;
        if (!logicalOk) {
          const msg = reportItemLinkFailure(
            "PATCH /api/item-links (linkType)",
            res,
            rawText,
            body,
            logicalOk,
          );
          setConnectionSyncPatch(connectionId, { syncState: "error", syncError: msg });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to sync link type";
        setConnectionSyncPatch(connectionId, {
          syncState: "error",
          syncError: msg,
        });
        if (getNeonSyncSnapshot().cloudEnabled) {
          neonSyncReportAuxiliaryFailure({
            operation: "PATCH /api/item-links (linkType)",
            message: msg,
            cause: "network",
          });
        }
      }
    },
    [setConnectionSyncPatch],
  );

  const setConnectionLinkType = useCallback(
    (connectionId: string, linkType: string) => {
      const cur = graphRef.current.connections[connectionId];
      if (!cur || (cur.linkType ?? "pin") === linkType) return;
      recordUndoBeforeMutation();
      setConnectionSyncPatch(connectionId, { linkType });
      void syncLinkTypeConnection(connectionId, linkType);
    },
    [recordUndoBeforeMutation, setConnectionSyncPatch, syncLinkTypeConnection],
  );

  const createConnection = useCallback(
    (sourceEntityId: string, targetEntityId: string) => {
      const connectionId = createId();
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
          linkType: "pin",
          slackMultiplier: DEFAULT_LINK_SLACK_MULTIPLIER,
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
      const clamped = clampLinkMetaSlackMultiplier(nextSlack);
      if (Math.abs((current.slackMultiplier ?? DEFAULT_LINK_SLACK_MULTIPLIER) - clamped) < 0.001)
        return;
      recordUndoBeforeMutation();
      setConnectionSyncPatch(connectionId, { slackMultiplier: clamped });
      void syncConnectionSlack(connectionId, clamped);
    },
    [recordUndoBeforeMutation, setConnectionSyncPatch, syncConnectionSlack],
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

  const activeSpace = graph.spaces[activeSpaceId] ?? graph.spaces[graph.rootSpaceId];
  const activeSpaceEntityIdsRaw = activeSpace?.entityIds ?? EMPTY_ENTITY_IDS;
  /**
   * Space id + ordered ids so memo identity cannot collide across spaces with the same id set.
   * Join delimiter must not appear in ids (heartgarden entity ids are UUIDs).
   */
  const activeSpaceEntityIdsFingerprint = `${activeSpaceId}\u0001${activeSpaceEntityIdsRaw.join("\u0001")}`;
  const activeSpaceEntityIds = useMemo(
    () => activeSpaceEntityIdsRaw,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fingerprint captures space + ordered ids; raw array ref churns on graph clone
    [activeSpaceEntityIdsFingerprint],
  );
  const activeSpaceEntities = useMemo(
    () =>
      activeSpaceEntityIds
        .map((id) => graph.entities[id])
        .filter((entity): entity is CanvasEntity => !!entity),
    [graph.entities, activeSpaceEntityIds],
  );
  const activeSpaceConnections = useMemo(
    () =>
      Object.values(graph.connections).filter((connection) => {
        const source = graph.entities[connection.sourceEntityId];
        const target = graph.entities[connection.targetEntityId];
        if (!source || !target) return false;
        return !!source.slots[activeSpaceId] && !!target.slots[activeSpaceId];
      }),
    [activeSpaceId, graph.connections, graph.entities],
  );
  const activeSpacePinConnectionCount = activeSpaceConnections.length;

  useEffect(() => {
    if (activeSpacePinConnectionCount === 0) return;
    let frame = 0;
    let cancelled = false;

    const step = () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") {
        frame = 0;
        return;
      }
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
        const slackMultiplier = connection.slackMultiplier ?? DEFAULT_LINK_SLACK_MULTIPLIER;
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
      const svgRoot = connectionLayerSvgRef.current;
      if (svgRoot) {
        svgRoot.querySelectorAll<SVGPathElement>("path[data-connection-id]").forEach((pathEl) => {
          const id = pathEl.getAttribute("data-connection-id");
          if (!id) return;
          const d = nextPaths[id] ?? "";
          pathEl.setAttribute("d", d);
        });
      }
      frame = window.requestAnimationFrame(step);
    };

    const onVisibility = () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        if (frame === 0) {
          frame = window.requestAnimationFrame(step);
        }
      } else if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    frame = window.requestAnimationFrame(step);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [activeSpacePinConnectionCount]);

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
        .map((id) =>
          id === graph.rootSpaceId ? ROOT_SPACE_DISPLAY_NAME : graph.spaces[id]?.name ?? "Unknown",
        )
        .join(" / ");
      return { id: space.id, name: space.name, pathLabel: path };
    });
  }, [graph.rootSpaceId, graph.spaces]);

  const nodeZ = useMemo(() => {
    const zMap = new Map<string, number>();
    activeSpaceEntities.forEach((entity, index) => zMap.set(entity.id, index + 1));
    return zMap;
  }, [activeSpaceEntities]);
  const stackGroups = useMemo(() => {
    const groups = new Map<string, CanvasEntity[]>();
    activeSpaceEntities.forEach((entity) => {
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
  }, [activeSpaceEntities]);
  const standaloneEntities = useMemo(
    () =>
      activeSpaceEntities.filter((entity) => {
        if (!entity.stackId) return true;
        const group = stackGroups.get(entity.stackId);
        return !group || group.length <= 1;
      }),
    [stackGroups, activeSpaceEntities],
  );
  const collapsedStacks = useMemo(() => {
    const out = Array.from(stackGroups.entries())
      .filter(([, arr]) => arr.length > 1)
      .map(([stackId, arr]) => ({ stackId, entities: arr, top: arr[arr.length - 1]! }));
    return out.length === 0 ? EMPTY_COLLAPSED_STACKS : out;
  }, [stackGroups]);

  /** Stable primitive keys so stack-bounds effects do not re-run when `collapsedStacks` is a new array ref with the same logical stacks. */
  const stackModalLayoutKey = useMemo(() => {
    if (!stackModal) return "0";
    return `${stackModal.stackId}:${stackModal.orderedIds.join(",")}`;
  }, [stackModal]);

  const stackFocusBoundsEffectKey = useMemo(() => {
    if (collapsedStacks.length === 0) return "empty";
    const stackPart = collapsedStacks
      .map(({ stackId, entities }) => {
        const sel = entities.some((e) => selectedNodeIds.includes(e.id)) ? "1" : "0";
        const ids = entities.map((e) => e.id).join(",");
        return `${stackId}:${sel}:${ids}`;
      })
      .sort()
      .join("|");
    const selPart = [...selectedNodeIds].sort().join(",");
    const viewPart = `${scale.toFixed(4)}_${Math.round(translateX)}_${Math.round(translateY)}`;
    return `${stackPart}#${selPart}#${stackModalLayoutKey}#${viewPart}`;
  }, [
    collapsedStacks,
    selectedNodeIds,
    stackModalLayoutKey,
    scale,
    translateX,
    translateY,
  ]);

  const stackHoverBoundsEffectKey = useMemo(() => {
    if (collapsedStacks.length === 0) return "empty";
    const stackPart = collapsedStacks
      .map(({ stackId, entities }) => {
        const ids = entities.map((e) => e.id).join(",");
        return `${stackId}:${ids}`;
      })
      .sort()
      .join("|");
    const viewPart = `${scale.toFixed(4)}_${Math.round(translateX)}_${Math.round(translateY)}`;
    return `${stackPart}#${stackModalLayoutKey}#${viewPart}`;
  }, [collapsedStacks, stackModalLayoutKey, scale, translateX, translateY]);

  useEffect(() => {
    if (collapsedStacks.length === 0) {
      setStackFocusBoundsById((prev) =>
        Object.keys(prev).length === 0 ? prev : EMPTY_STACK_BOUNDS,
      );
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
      next[stackId] = snapStackBoundsRect({
        left: minX - containerRect.left - pad,
        top: minY - containerRect.top - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
      });
    });
    setStackFocusBoundsById((prev) =>
      stackBoundsRecordsVisuallyEqual(prev, next, STACK_BOUNDS_EQ_TOL_PX) ? prev : next,
    );
    // `stackFocusBoundsEffectKey` encodes collapsed stacks, selection, modal layout, and pan/zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-running on `collapsedStacks` ref churn
  }, [stackFocusBoundsEffectKey]);

  useEffect(() => {
    if (collapsedStacks.length === 0) {
      setStackHoverBoundsById((prev) =>
        Object.keys(prev).length === 0 ? prev : EMPTY_STACK_BOUNDS,
      );
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
      next[stackId] = snapStackBoundsRect({
        left: minX - containerRect.left - pad,
        top: minY - containerRect.top - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
      });
    });
    setStackHoverBoundsById((prev) =>
      stackBoundsRecordsVisuallyEqual(prev, next, STACK_BOUNDS_EQ_TOL_PX) ? prev : next,
    );
    // `stackHoverBoundsEffectKey` encodes collapsed stacks, modal layout, and pan/zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-running on `collapsedStacks` ref churn
  }, [stackHoverBoundsEffectKey]);
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
          schedulePersistContentBody(id, normalizedHtml);
        },
        options?.immediate ? 0 : 120,
      );
    },
    [queueGraphCommit, recordUndoBeforeMutation, schedulePersistContentBody],
  );

  const setInlineBodyDraftDirty = useCallback((entityId: string, dirty: boolean) => {
    const s = inlineContentDirtyIdsRef.current;
    if (dirty) s.add(entityId);
    else s.delete(entityId);
  }, []);

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
      } else if (nodeHost instanceof HTMLElement && nodeHost.dataset.nodeId) {
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
      if (persistNeonRef.current && isUuidLike(galleryNodeId)) {
        const gid = galleryNodeId;
        const nextBody = setArchitecturalMediaNotes(entity.bodyHtml, galleryDraftNotes);
        queueMicrotask(() => {
          const ent = graphRef.current.entities[gid];
          if (!ent || ent.kind !== "content") return;
          void patchItemWithVersion(gid, {
            title: nextTitle,
            contentText: htmlToPlainText(nextBody),
            contentJson: buildContentJsonForContentEntity({
              ...ent,
              title: nextTitle,
              bodyHtml: nextBody,
            }),
          });
        });
      }
    closeMediaGallery();
  }, [
    closeMediaGallery,
    galleryDraftNotes,
    galleryDraftTitle,
    galleryNodeId,
    patchItemWithVersion,
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
      if (persistNeonRef.current && isUuidLike(activeNodeId)) {
        const aid = activeNodeId;
        const nextTitle = focusTitle.trim() || "Untitled";
        queueMicrotask(() => {
          const ent = graphRef.current.entities[aid];
          if (!ent || ent.kind !== "content") return;
          void patchItemWithVersion(aid, {
            title: nextTitle,
            contentText: htmlToPlainText(normalizedFocusBody),
            contentJson: buildContentJsonForContentEntity({
              ...ent,
              title: nextTitle,
              bodyHtml: normalizedFocusBody,
            }),
          });
        });
      }
    }
    setFocusOpen(false);
    setActiveNodeId(null);
  }, [activeNodeId, focusBody, focusTitle, patchItemWithVersion, recordUndoBeforeMutation]);

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

  useEffect(() => {
    focusDirtyRef.current = focusDirty;
  }, [focusDirty]);

  const collabNeonActive =
    scenario === "default" &&
    canvasBootstrapResolved &&
    persistNeonRef.current &&
    isUuidLike(activeSpaceId);

  useHeartgardenSpaceChangeSync({
    enabled: collabNeonActive,
    activeSpaceId,
    graphRef,
    syncCursorRef,
    focusOpenRef,
    focusDirtyRef,
    activeNodeIdRef,
    inlineContentDirtyIdsRef,
    remoteTombstoneExemptIdsRef,
    setGraph,
    itemServerUpdatedAtRef,
  });

  useHeartgardenPresenceHeartbeat({
    enabled: collabNeonActive,
    activeSpaceId,
    setPresencePeerCount,
  });

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
    if (!isUuidLike(activeSpaceId)) return;
    if (cameraPersistTimerRef.current) clearTimeout(cameraPersistTimerRef.current);
    cameraPersistTimerRef.current = setTimeout(() => {
      cameraPersistTimerRef.current = null;
      writeSpaceCamera(activeSpaceId, { x: translateX, y: translateY, zoom: scale });
    }, 700);
    return () => {
      if (cameraPersistTimerRef.current) clearTimeout(cameraPersistTimerRef.current);
    };
  }, [activeSpaceId, scale, translateX, translateY]);

  useEffect(() => {
    if (scenario !== "default" || !canvasBootstrapResolved) return;
    if (!persistNeonRef.current) return;
    if (!isUuidLike(activeSpaceId)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/spaces/${encodeURIComponent(activeSpaceId)}/graph`);
        const data = (await res.json()) as {
          ok?: boolean;
          edges?: import("@/src/lib/graph-types").GraphEdge[];
        };
        if (cancelled || !data?.ok || !data.edges) return;
        setGraph((prev) =>
          mergeHydratedDbConnections(prev, data.edges!, {
            defaultFolderPin: CONNECTION_PIN_DEFAULT_FOLDER,
            defaultContentPin: CONNECTION_PIN_DEFAULT_CONTENT,
            fallbackColor: CONNECTION_DEFAULT_COLOR,
          }),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSpaceId, canvasBootstrapResolved, scenario]);

  const connectionPinView = useMemo<ConnectionPinViewContext>(
    () => ({ tx: translateX, ty: translateY, scale }),
    [translateX, translateY, scale],
  );

  const applyBootstrapData = useCallback((data: BootstrapResponse, maxZi: number) => {
    if (!data.spaceId) return;
    const nextGraph = buildCanvasGraphFromBootstrap(data);
    setGraph(nextGraph);
    setActiveSpaceId(data.spaceId);
    setNavigationPath(buildPathToSpace(data.spaceId, nextGraph.spaces, nextGraph.rootSpaceId));
    const m = itemServerUpdatedAtRef.current;
    m.clear();
    let maxMs = 0;
    for (const it of data.items) {
      if (it.updatedAt) {
        m.set(it.id, it.updatedAt);
        const t = Date.parse(it.updatedAt);
        if (Number.isFinite(t) && t > maxMs) maxMs = t;
      }
    }
    syncCursorRef.current = maxMs > 0 ? new Date(maxMs).toISOString() : new Date(0).toISOString();
    const cam = readSpaceCamera(data.spaceId) ?? defaultCamera();
    setTranslateX(cam.x);
    setTranslateY(cam.y);
    setScale(cam.zoom);
    setMaxZIndex(maxZi);
  }, []);
  const applyBootstrapDataRef = useRef(applyBootstrapData);
  applyBootstrapDataRef.current = applyBootstrapData;

  const ingestLiveBootstrap = useCallback(
    (data: BootstrapResponse) => {
      if (!data.spaceId || data.demo !== false) return;
      const maxZi =
        data.items.length > 0 ? Math.max(...data.items.map((i) => i.zIndex), 100) : 100;
      const cacheTier = workspaceCacheTierForNeonSession(heartgardenBootApiRef.current);
      writeWorkspaceViewCache(data, maxZi, cacheTier);
      setNeonWorkspaceOk(true);
      setWorkspaceViewFromCache(false);
      persistNeonRef.current = true;
      neonSyncSetCloudEnabled(true);
      applyBootstrapData(data, maxZi);
    },
    [applyBootstrapData],
  );

  const applyDemoLocalCanvas = useCallback(() => {
    setNeonWorkspaceOk(true);
    setWorkspaceViewFromCache(false);
    persistNeonRef.current = false;
    neonSyncSetCloudEnabled(false);
    const freshGraph = buildHeartgardenNestedDemoGraph();
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
    setCanvasBootstrapResolved(true);
  }, []);

  useEffect(() => {
    if (scenario !== "default") {
      const tokens = {
        taskItem: styles.taskItem,
        done: styles.done,
        taskCheckbox: styles.taskCheckbox,
        taskText: styles.taskText,
        mediaFrame: styles.mediaFrame,
        mediaImage: styles.mediaImage,
        mediaImageActions: styles.mediaImageActions,
        mediaUploadBtn: styles.mediaUploadBtn,
      };
      setNeonWorkspaceOk(true);
      setWorkspaceViewFromCache(false);
      persistNeonRef.current = false;
      neonSyncSetCloudEnabled(false);
      setCanvasBootstrapResolved(true);
      const freshGraph = buildArchitecturalSeedGraph(tokens, scenario);
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
      return;
    }

    const boot = heartgardenBootApi;
    if (!boot.loaded) {
      setCanvasBootstrapResolved(false);
      setNeonWorkspaceOk(null);
      setWorkspaceViewFromCache(false);
      setGraph(createBootstrapPendingGraph());
      setActiveSpaceId(ROOT_SPACE_ID);
      setNavigationPath([ROOT_SPACE_ID]);
      return;
    }

    if (boot.gateEnabled && boot.sessionValid && boot.sessionTier === "demo") {
      applyDemoLocalCanvas();
      return;
    }

    if (boot.gateEnabled && !boot.sessionValid) {
      setCanvasBootstrapResolved(true);
      setNeonWorkspaceOk(null);
      setWorkspaceViewFromCache(false);
      persistNeonRef.current = false;
      neonSyncSetCloudEnabled(false);
      setGraph(createBootstrapPendingGraph());
      setActiveSpaceId(ROOT_SPACE_ID);
      setNavigationPath([ROOT_SPACE_ID]);
      setSelectedNodeIds([]);
      setConnectionSourceId(null);
      setConnectionMode("move");
      setFocusOpen(false);
      setActiveNodeId(null);
      undoPastRef.current = [];
      undoFutureRef.current = [];
      setHistoryEpoch((n) => n + 1);
      return;
    }

    setCanvasBootstrapResolved(false);
    setNeonWorkspaceOk(null);
    setWorkspaceViewFromCache(false);
    setGraph(createBootstrapPendingGraph());
    setActiveSpaceId(ROOT_SPACE_ID);
    setNavigationPath([ROOT_SPACE_ID]);

    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchBootstrap();
        if (cancelled || !data || data.demo !== false || !data.spaceId) {
          throw new Error("demo");
        }
        ingestLiveBootstrap(data);
      } catch {
        if (cancelled) return;
        const b = heartgardenBootApiRef.current;
        const skipCache =
          !b.loaded ||
          (b.gateEnabled && !b.sessionValid) ||
          (b.gateEnabled && b.sessionTier === "demo");
        if (skipCache) {
          setNeonWorkspaceOk(false);
          setWorkspaceViewFromCache(false);
          persistNeonRef.current = false;
          neonSyncSetCloudEnabled(false);
          setGraph(createBootstrapPendingGraph());
          setActiveSpaceId(ROOT_SPACE_ID);
          setNavigationPath([ROOT_SPACE_ID]);
          setTranslateX(window.innerWidth / 2);
          setTranslateY(window.innerHeight / 2);
          setScale(1);
        } else {
          const tier = workspaceCacheTierForNeonSession(b);
          const cached = readWorkspaceViewCache(tier);
          if (cached?.bootstrap?.spaceId) {
            setNeonWorkspaceOk(false);
            setWorkspaceViewFromCache(true);
            persistNeonRef.current = false;
            neonSyncSetCloudEnabled(false);
            applyBootstrapDataRef.current(cached.bootstrap, cached.maxZIndex);
          } else {
            setNeonWorkspaceOk(false);
            setWorkspaceViewFromCache(false);
            persistNeonRef.current = false;
            neonSyncSetCloudEnabled(false);
            setGraph(createBootstrapPendingGraph());
            setActiveSpaceId(ROOT_SPACE_ID);
            setNavigationPath([ROOT_SPACE_ID]);
            setTranslateX(window.innerWidth / 2);
            setTranslateY(window.innerHeight / 2);
            setScale(1);
          }
        }
      }
      if (cancelled) return;
      setCanvasBootstrapResolved(true);
      setSelectedNodeIds([]);
      setConnectionSourceId(null);
      setConnectionMode("move");
      setFocusOpen(false);
      setActiveNodeId(null);
      undoPastRef.current = [];
      undoFutureRef.current = [];
      setHistoryEpoch((n) => n + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, [scenario, ingestLiveBootstrap, applyDemoLocalCanvas, heartgardenBootApi]);

  useEffect(() => {
    if (scenario !== "default" || !workspaceViewFromCache) return;
    const b = heartgardenBootApiRef.current;
    if (!b.loaded) return;
    if (b.gateEnabled && (!b.sessionValid || b.sessionTier === "demo")) return;

    let cancelled = false;
    const tryReconnect = async () => {
      try {
        const data = await fetchBootstrap();
        if (cancelled || !data || data.demo !== false || !data.spaceId) return;
        ingestLiveBootstrap(data);
      } catch {
        /* keep cached view */
      }
    };
    void tryReconnect();
    const onOnline = () => void tryReconnect();
    window.addEventListener("online", onOnline);
    const interval = window.setInterval(tryReconnect, 45_000);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
    };
  }, [scenario, workspaceViewFromCache, ingestLiveBootstrap, heartgardenBootApi]);

  useLayoutEffect(() => {
    setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    // Default scenario: camera comes from bootstrap in one batch (avoids center → server camera jump).
    if (scenario !== "default") {
      setTranslateX(window.innerWidth / 2);
      setTranslateY(window.innerHeight / 2);
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCanvasSurfaceReady(true);
    }

    const onResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [scenario]);

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

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(VIGIL_CANVAS_EFFECTS_STORAGE_KEY) === "0") {
        setCanvasEffectsEnabled(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(VIGIL_CANVAS_EFFECTS_STORAGE_KEY, canvasEffectsEnabled ? "1" : "0");
    } catch {
      /* ignore */
    }
    canvasEffectsEnabledRef.current = canvasEffectsEnabled;
  }, [canvasEffectsEnabled]);

  useEffect(() => {
    if (!canvasEffectsEnabled && navTransitionActive) {
      setNavTransitionActive(false);
    }
  }, [canvasEffectsEnabled, navTransitionActive]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => {
    if (prefersReducedMotion || scenario === "default") return;
    setChromeEnterEpoch((e) => (e >= 1 ? e : 1));
  }, [scenario, prefersReducedMotion]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/heartgarden/boot", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error("boot status");
        return r.json() as Promise<HeartgardenBootStatusJson>;
      })
      .then((d) => {
        if (cancelled) return;
        setHeartgardenBootApi(parseHeartgardenBootStatus(d));
      })
      .catch(() => {
        if (cancelled) return;
        setHeartgardenBootApi({
          loaded: true,
          gateEnabled: false,
          sessionValid: false,
          sessionTier: null,
          playerLayerMisconfigured: false,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isRestrictedLayer) return;
    setLorePanelOpen(false);
    setGraphOverlayOpen(false);
    setLoreImportDraft(null);
    setLoreSmartReview(null);
    setLoreReviewPanelOpen(false);
  }, [isRestrictedLayer]);

  useLayoutEffect(() => {
    if (scenario !== "default") return;
    if (!heartgardenBootApi.loaded) return;
    /* Do not dismiss boot while showing the post–log out splash (same deps can re-run after logout). */
    if (bootAfterLogout) return;
    if (heartgardenBootApi.gateEnabled) {
      if (heartgardenBootApi.sessionValid) {
        if (!bootCelebrationPlayedRef.current) {
          bootCelebrationPlayedRef.current = true;
          playVigilUiSound("celebration");
        }
        if (!prefersReducedMotion) {
          setChromeEnterEpoch((e) => e + 1);
        }
        setCanvasSessionActivated(true);
        setBootLayerDismissed(true);
      }
      return;
    }
    if (!prefersReducedMotion) return;
    setCanvasSessionActivated(true);
    setBootLayerDismissed(true);
  }, [
    scenario,
    prefersReducedMotion,
    bootAfterLogout,
    heartgardenBootApi.loaded,
    heartgardenBootApi.gateEnabled,
    heartgardenBootApi.sessionValid,
  ]);

  const handleLogOutToAuth = useCallback(() => {
    if (scenario !== "default") return;
    /* Synchronous commit so boot ambient layoutEffects run while the log-out click still counts as user gesture (autoplay). */
    flushSync(() => {
      clearWorkspaceViewCache();
      bootCelebrationPlayedRef.current = false;
      setFocusOpen(false);
      setGalleryOpen(false);
      setPaletteOpen(false);
      setLorePanelOpen(false);
      setGraphOverlayOpen(false);
      setStackModal(null);
      setCanvasSessionActivated(false);
      setBootLayerDismissed(false);
      setBootAmbientEpoch((e) => e + 1);
      /*
       * Always set — the boot auto-enter effect keys off `heartgardenBootApi.sessionValid`, which stays true
       * until DELETE + refetch complete; without this flag it immediately re-dismisses boot for motion users.
       */
      setBootAfterLogout(true);
    });
    /* Same synchronous stack as log-out click: Web Audio + media element play() must run here for autoplay. */
    bootAmbientPrimePlaybackRef.current?.();
    void (async () => {
      try {
        const res = await fetch("/api/heartgarden/boot", { method: "DELETE", credentials: "include" });
        if (!res.ok) return;
        setHeartgardenBootApi((prev) =>
          prev.loaded
            ? { ...prev, sessionValid: false, sessionTier: null }
            : prev,
        );
      } catch {
        /* ignore */
      }
    })();
  }, [scenario]);

  const centerCoords = useCallback(() => {
    return {
      x: (window.innerWidth / 2 - translateX) / scale,
      y: (window.innerHeight / 2 - translateY) / scale,
    };
  }, [scale, translateX, translateY]);

  const commitLoreImport = useCallback(async () => {
    const d = loreImportDraftRef.current;
    if (!d) return;
    if (!persistNeonRef.current || !isUuidLike(activeSpaceId)) {
      window.alert("Importing to the canvas requires a connected Neon space (not local demo mode).");
      return;
    }
    const trimmedEntities = d.entities
      .map((e) => ({
        name: e.name.trim(),
        kind: e.kind.trim() || "lore",
        summary: e.summary.trim(),
      }))
      .filter((e) => e.name.length > 0);
    const hasSource = d.includeSourceCard && d.sourceText.trim().length > 0;
    if (!hasSource && trimmedEntities.length < 1) {
      window.alert("Add at least one entity with a name, or include the source text as a card.");
      return;
    }
    const center = centerCoords();
    setLoreImportCommitting(true);
    playVigilUiSound("button");
    try {
      const res = await fetch("/api/lore/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId: activeSpaceId,
          sourceDocument: hasSource
            ? {
                title: d.sourceTitle?.trim() || d.fileName,
                text: d.sourceText,
              }
            : undefined,
          entities: trimmedEntities,
          suggestedLinks: d.suggestedLinks.filter((l) => l.fromName.trim() && l.toName.trim()),
          layout: { originX: center.x - 140, originY: center.y - 120 },
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        linkWarnings?: string[];
      };
      if (!res.ok || !data.ok) {
        playVigilUiSound("caution");
        window.alert(typeof data.error === "string" ? data.error : "Commit failed");
        return;
      }
      if (data.linkWarnings?.length) {
        window.alert(
          `Imported. Link notes:\n${data.linkWarnings.slice(0, 8).join("\n")}${data.linkWarnings.length > 8 ? "\n…" : ""}`,
        );
      }
      const boot = await fetchBootstrap(activeSpaceId);
      if (boot && boot.demo === false && boot.spaceId) {
        setGraph((g) => mergeBootstrapView(g, boot));
        if (boot.items.length > 0) {
          setMaxZIndex((z) => Math.max(z, ...boot.items.map((i) => i.zIndex)));
        }
      }
      playVigilUiSound("celebration");
      setLoreImportDraft(null);
    } catch {
      playVigilUiSound("caution");
      window.alert("Commit request failed");
    } finally {
      setLoreImportCommitting(false);
    }
  }, [activeSpaceId, centerCoords]);

  const commitSmartLoreImport = useCallback(async () => {
    const rev = loreSmartReview;
    if (!rev) return;
    if (!persistNeonRef.current || !isUuidLike(activeSpaceId)) {
      window.alert("Importing to the canvas requires a connected Neon space (not local demo mode).");
      return;
    }
    const center = centerCoords();
    const acceptedMergeProposalIds = Object.entries(loreSmartAcceptedMergeIds)
      .filter(([, v]) => v)
      .map(([id]) => id);
    setLoreImportCommitting(true);
    playVigilUiSound("button");
    try {
      const res = await fetch("/api/lore/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId: activeSpaceId,
          importBatchId: rev.plan.importBatchId,
          plan: rev.plan,
          layout: { originX: center.x - 140, originY: center.y - 120 },
          includeSourceCard: loreSmartIncludeSource,
          sourceDocument:
            loreSmartIncludeSource && rev.sourceText.trim().length > 0
              ? {
                  title: rev.sourceTitle?.trim() || rev.fileName || rev.plan.fileName,
                  text: rev.sourceText,
                }
              : undefined,
          acceptedMergeProposalIds,
          clarificationAnswers: loreSmartClarificationAnswers,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        linkWarnings?: string[];
      };
      if (!res.ok || !data.ok) {
        playVigilUiSound("caution");
        window.alert(typeof data.error === "string" ? data.error : "Apply failed");
        return;
      }
      if (data.linkWarnings?.length) {
        window.alert(
          `Imported. Link notes:\n${data.linkWarnings.slice(0, 8).join("\n")}${data.linkWarnings.length > 8 ? "\n…" : ""}`,
        );
      }
      const boot = await fetchBootstrap(activeSpaceId);
      if (boot && boot.demo === false && boot.spaceId) {
        setGraph((g) => mergeBootstrapView(g, boot));
        if (boot.items.length > 0) {
          setMaxZIndex((z) => Math.max(z, ...boot.items.map((i) => i.zIndex)));
        }
      }
      playVigilUiSound("celebration");
      setLoreSmartReview(null);
      setLoreSmartAcceptedMergeIds({});
      setLoreSmartClarificationAnswers([]);
      setLoreSmartTab("structure");
    } catch {
      playVigilUiSound("caution");
      window.alert("Apply request failed");
    } finally {
      setLoreImportCommitting(false);
    }
  }, [
    activeSpaceId,
    centerCoords,
    loreSmartAcceptedMergeIds,
    loreSmartClarificationAnswers,
    loreSmartIncludeSource,
    loreSmartReview,
  ]);

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

  const stackSelectedContent = useCallback((selectionOverride?: readonly string[]) => {
    if (stackModalRef.current) return;
    const g = graphRef.current;
    const spaceId = activeSpaceIdRef.current;
    const rawSelection = selectionOverride ?? selectedNodeIdsRef.current;
    const { orderedContentIds: ids } = getStackSelectionState(g, spaceId, rawSelection);
    if (ids.length < 2) return;
    recordUndoBeforeMutation();
    const stackId = createId();
    setGraph((prev) => {
      const next = shallowCloneGraph(prev);
      const finiteSlots = ids
        .map((id) => next.entities[id]?.slots[spaceId])
        .filter((s): s is { x: number; y: number } =>
          !!s && Number.isFinite(s.x) && Number.isFinite(s.y),
        );
      /* Match card placement fallback: missing slots still stack at a shared anchor. */
      const anchorX = finiteSlots.length > 0 ? Math.min(...finiteSlots.map((s) => s.x)) : 0;
      const anchorY = finiteSlots.length > 0 ? Math.min(...finiteSlots.map((s) => s.y)) : 0;
      /* Higher stackOrder renders last (top of pile). First in merge/selection list = top card. */
      const topOrder = ids.length - 1;
      ids.forEach((id, index) => {
        const entity = next.entities[id];
        if (!entity || entity.kind !== "content") return;
        next.entities[id] = {
          ...entity,
          stackId,
          stackOrder: topOrder - index,
          slots: {
            ...entity.slots,
            [spaceId]: { x: anchorX, y: anchorY },
          },
        };
      });
      return next;
    });
    setSelectedNodeIds(ids);
    if (persistNeonRef.current) {
      queueMicrotask(() => persistNeonItemsLayout(ids));
    }
  }, [createId, persistNeonItemsLayout, recordUndoBeforeMutation]);

  const unstackGroup = useCallback(
    (stackId: string) => {
      recordUndoBeforeMutation();
      const members = Object.values(graphRef.current.entities)
        .filter(
          (e): e is Extract<CanvasEntity, { kind: "content" }> =>
            e.kind === "content" && e.stackId === stackId,
        )
        .map((e) => e.id);
      setGraph((prev) => applyUnstackStackInSpace(prev, stackId, activeSpaceId));
      if (persistNeonRef.current && members.length > 0) {
        queueMicrotask(() => persistNeonItemsLayout(members));
      }
    },
    [activeSpaceId, persistNeonItemsLayout, recordUndoBeforeMutation],
  );

  const ensureFolderChildSpace = useCallback(
    async (folderId: string): Promise<string | null> => {
      const folderEarly = graphRef.current.entities[folderId];
      if (!folderEarly || folderEarly.kind !== "folder") return null;
      if (graphRef.current.spaces[folderEarly.childSpaceId]) {
        return folderEarly.childSpaceId;
      }

      if (persistNeonRef.current && isUuidLike(folderId)) {
        recordUndoBeforeMutation();
        const folder = graphRef.current.entities[folderId];
        if (!folder || folder.kind !== "folder") return null;
        const parentSpaceId = activeSpaceIdRef.current;
        const created = await apiCreateSpace(folder.title || "Untitled Folder", parentSpaceId);
        if (!created.ok || !created.space?.id) return null;
        const newSpaceId = created.space.id;
        const contentJson = buildContentJsonForFolderEntity({
          ...folder,
          childSpaceId: newSpaceId,
        });
        await patchItemWithVersion(folderId, { contentJson });
        flushSync(() => {
          setGraph((prev) => {
            const f = prev.entities[folderId];
            if (!f || f.kind !== "folder") return prev;
            const next = shallowCloneGraph(prev);
            next.spaces[newSpaceId] = {
              id: newSpaceId,
              name: f.title || "Untitled Folder",
              parentSpaceId,
              entityIds: [],
            };
            next.entities[folderId] = { ...f, childSpaceId: newSpaceId };
            return next;
          });
        });
        return newSpaceId;
      }

      recordUndoBeforeMutation();
      let resolved: string | null = null;
      flushSync(() => {
        setGraph((prev) => {
          const folder = prev.entities[folderId];
          if (!folder || folder.kind !== "folder") return prev;
          if (prev.spaces[folder.childSpaceId]) {
            resolved = folder.childSpaceId;
            return prev;
          }

          const next = shallowCloneGraph(prev);
          const newSpaceId = createId();
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
      });
      return resolved;
    },
    [activeSpaceId, createId, patchItemWithVersion, recordUndoBeforeMutation],
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
      options?: {
        anchor?: { x: number; y: number };
        forceLayout?: boolean;
        skipUndo?: boolean;
        /** Commit graph before Neon persist (cross-space drop / parent exit). */
        neonFlush?: boolean;
        /** Space the items are leaving (for grouping same-slot piles when DB has no stackId yet). */
        fromSpaceId?: string;
      },
    ) => {
      if (!options?.skipUndo) {
        recordUndoBeforeMutation();
      }
      const apply = (prev: CanvasGraph) => {
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

        /** Stacked content nodes share one canvas slot; lay out one position per stack, not per card. */
        const stackGroupKey = (entityId: string): string => {
          const ent = next.entities[entityId];
          if (ent?.kind === "content" && ent.stackId) return `stack:${ent.stackId}`;
          const from = options?.fromSpaceId;
          if (from && ent?.kind === "content") {
            const s = ent.slots[from];
            if (s) {
              const rx = Math.round(s.x);
              const ry = Math.round(s.y);
              return `pile:${from}:${rx}:${ry}`;
            }
          }
          return `solo:${entityId}`;
        };
        const groupKeys: string[] = [];
        const idsByGroup = new Map<string, string[]>();
        for (const id of idsToMove) {
          const key = stackGroupKey(id);
          if (!idsByGroup.has(key)) {
            idsByGroup.set(key, []);
            groupKeys.push(key);
          }
          idsByGroup.get(key)!.push(id);
        }

        let layoutGroupIndex = 0;
        for (const key of groupKeys) {
          const groupIds = idsByGroup.get(key)!;
          const lead = next.entities[groupIds[0]!];
          if (!lead) continue;

          const leadExisting = lead.slots[destinationSpaceId];
          const sharedStack =
            lead.kind === "content" &&
            !!lead.stackId &&
            groupIds.every((gid) => {
              const e = next.entities[gid];
              return e?.kind === "content" && e.stackId === lead.stackId;
            });

          let destinationSlot: { x: number; y: number };
          if (
            !shouldForceLayout &&
            leadExisting &&
            (!sharedStack ||
              groupIds.every((gid) => {
                const s = next.entities[gid]?.slots[destinationSpaceId];
                return (
                  !!s && s.x === leadExisting.x && s.y === leadExisting.y
                );
              }))
          ) {
            destinationSlot = leadExisting;
          } else {
            destinationSlot = findNextSlot(layoutGroupIndex);
            layoutGroupIndex += 1;
          }

          for (const entityId of groupIds) {
            const entity = next.entities[entityId];
            if (!entity) continue;
            next.entities[entityId] = {
              ...entity,
              slots: {
                ...entity.slots,
                [destinationSpaceId]: destinationSlot,
              },
            };
          }

          if (
            key.startsWith("pile:") &&
            groupIds.length > 1 &&
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
          ) {
            const allContent = groupIds.every((gid) => next.entities[gid]?.kind === "content");
            const noneHaveStack = groupIds.every(
              (gid) => !next.entities[gid] || next.entities[gid]!.kind !== "content" || !next.entities[gid]!.stackId,
            );
            if (allContent && noneHaveStack) {
              const sid = crypto.randomUUID();
              const n = groupIds.length;
              groupIds.forEach((entityId, index) => {
                const entity = next.entities[entityId];
                if (!entity || entity.kind !== "content") return;
                next.entities[entityId] = {
                  ...entity,
                  stackId: sid,
                  stackOrder: n - 1 - index,
                };
              });
            }
          }
        }

        for (const id of idsToMove) {
          const ent = next.entities[id];
          if (!ent || ent.kind !== "folder") continue;
          const inner = next.spaces[ent.childSpaceId];
          if (inner) {
            next.spaces[ent.childSpaceId] = {
              ...inner,
              parentSpaceId: destinationSpaceId,
            };
          }
        }

        return next;
      };
      if (options?.neonFlush && persistNeonRef.current) {
        flushSync(() => {
          setGraph(apply);
        });
      } else {
        setGraph(apply);
      }
    },
    [canMoveEntityToSpace, recordUndoBeforeMutation],
  );

  const enterSpace = useCallback(
    (spaceId: string) => {
      const snap = graphRef.current;
      if (!snap.spaces[spaceId] || spaceId === activeSpaceIdRef.current) return;

      const fromDepth = navigationPathRef.current.length;
      const nextPathPreview = buildPathToSpace(spaceId, snap.spaces, snap.rootSpaceId);
      const toDepth = nextPathPreview.length;
      if (toDepth > fromDepth) playVigilUiSound("transition_down");
      else if (toDepth < fromDepth) playVigilUiSound("transition_up");

      const applySpaceNavigation = (merged: CanvasGraph | null, bootstrapMaxZ: number | null) => {
        const g = merged ?? graphRef.current;
        if (merged) {
          setGraph(merged);
          if (bootstrapMaxZ !== null) {
            const zCap = bootstrapMaxZ;
            setMaxZIndex((z) => Math.max(z, zCap));
          }
        }
        if (isUuidLike(spaceId)) {
          const cam = readSpaceCamera(spaceId) ?? defaultCamera();
          setTranslateX(cam.x);
          setTranslateY(cam.y);
          setScale(cam.zoom);
        } else if (!merged) {
          recenterToOrigin();
        }
        setActiveSpaceId(spaceId);
        setNavigationPath(buildPathToSpace(spaceId, g.spaces, g.rootSpaceId));
        setSelectedNodeIds([]);
      };

      if (!canvasEffectsEnabledRef.current) {
        void (async () => {
          let merged: CanvasGraph | null = null;
          let bootstrapMaxZ: number | null = null;
          try {
            if (persistNeonRef.current && isUuidLike(spaceId)) {
              const data = await fetchBootstrap(spaceId);
              if (data && data.demo === false && data.spaceId) {
                merged = mergeBootstrapView(graphRef.current, data);
                if (data.items.length > 0) {
                  bootstrapMaxZ = Math.max(...data.items.map((i) => i.zIndex), 100);
                }
                let maxMs = Date.parse(syncCursorRef.current);
                if (!Number.isFinite(maxMs)) maxMs = 0;
                for (const it of data.items) {
                  if (it.updatedAt) {
                    itemServerUpdatedAtRef.current.set(it.id, it.updatedAt);
                    const t = Date.parse(it.updatedAt);
                    if (Number.isFinite(t) && t > maxMs) maxMs = t;
                  }
                }
                syncCursorRef.current = new Date(maxMs).toISOString();
              }
            }
          } catch {
            /* ignore */
          }
          applySpaceNavigation(merged, bootstrapMaxZ);
        })();
        return;
      }

      setNavTransitionActive(true);
      void (async () => {
        const now = () => (typeof performance !== "undefined" ? performance.now() : 0);
        const tNav = now();
        const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

        let merged: CanvasGraph | null = null;
        let bootstrapMaxZ: number | null = null;
        try {
          if (persistNeonRef.current && isUuidLike(spaceId)) {
            const data = await fetchBootstrap(spaceId);
            if (data && data.demo === false && data.spaceId) {
              merged = mergeBootstrapView(graphRef.current, data);
              if (data.items.length > 0) {
                bootstrapMaxZ = Math.max(...data.items.map((i) => i.zIndex), 100);
              }
              let maxMs = Date.parse(syncCursorRef.current);
              if (!Number.isFinite(maxMs)) maxMs = 0;
              for (const it of data.items) {
                if (it.updatedAt) {
                  itemServerUpdatedAtRef.current.set(it.id, it.updatedAt);
                  const t = Date.parse(it.updatedAt);
                  if (Number.isFinite(t) && t > maxMs) maxMs = t;
                }
              }
              syncCursorRef.current = new Date(maxMs).toISOString();
            }
          }
        } finally {
          const elapsedAfterFetch = now() - tNav;
          const waitFadeOutEnd = Math.max(0, VIEWPORT_SCENE_FADE_MS - elapsedAfterFetch);
          if (waitFadeOutEnd > 0) await sleep(waitFadeOutEnd);

          applySpaceNavigation(merged, bootstrapMaxZ);

          const elapsedBeforeRelease = now() - tNav;
          const waitUntilCenter = Math.max(0, VIEWPORT_TRANSITION_CENTER_MS - elapsedBeforeRelease);
          if (waitUntilCenter > 0) await sleep(waitUntilCenter);

          setNavTransitionActive(false);
        }
      })();
    },
    [recenterToOrigin],
  );

  const openFolder = useCallback(
    (folderId: string) => {
      void (async () => {
        const snap = graphRef.current;
        const folder = snap.entities[folderId];
        if (!folder || folder.kind !== "folder") return;
        const slotSpaceIds = Object.keys(folder.slots).filter((sid) => snap.spaces[sid]);
        const parentSpaceId =
          slotSpaceIds.find((sid) => sid === activeSpaceIdRef.current) ??
          slotSpaceIds[0] ??
          activeSpaceIdRef.current;
        const parentSpace = snap.spaces[parentSpaceId];
        const childSpaceId = snap.spaces[folder.childSpaceId]
          ? folder.childSpaceId
          : await ensureFolderChildSpace(folderId);
        if (!childSpaceId) return;
        pushRecentFolder({
          id: folderId,
          title: folder.title || "Untitled Folder",
          parentSpaceId,
          parentSpaceName: parentSpace?.name ?? "",
        });
        enterSpace(childSpaceId);
      })();
    },
    [enterSpace, ensureFolderChildSpace, pushRecentFolder],
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

      if (openInFocus && entity.kind === "content") {
        openFocusMode(entityId);
      }

      const panToEntity = () => {
        const ent = graphRef.current.entities[entityId];
        const slot = ent?.slots[targetSpaceId];
        if (slot) {
          const viewport = viewportRef.current?.getBoundingClientRect();
          const width = viewport?.width ?? window.innerWidth;
          const height = viewport?.height ?? window.innerHeight;
          const nextScale = viewRef.current.scale;
          setTranslateX(width / 2 - slot.x * nextScale);
          setTranslateY(height / 2 - slot.y * nextScale);
        }
        setSelectedNodeIds([entityId]);
      };

      if (targetSpaceId !== activeSpaceIdRef.current) {
        enterSpace(targetSpaceId);
        requestAnimationFrame(() => {
          requestAnimationFrame(panToEntity);
        });
        return;
      }

      panToEntity();
      playVigilUiSound("select");
    },
    [enterSpace, openFocusMode],
  );

  const resolveVaultReviewDraft = useCallback((): VaultReviewDraft | null => {
    if (!cloudLinksBar || !isUuidLike(activeSpaceId)) return null;
    if (focusOpen && activeNodeId) {
      const ent = graph.entities[activeNodeId];
      if (!ent || ent.kind !== "content" || ent.theme === "media") return null;
      return {
        title: focusTitle.trim(),
        bodyText: stripHtmlToPlain(focusBody),
        excludeItemId:
          ent.persistedItemId && isUuidLike(ent.persistedItemId)
            ? ent.persistedItemId
            : undefined,
        targetLabel: focusTitle.trim() || "Focused note",
      };
    }
    if (selectedNodeIds.length === 1) {
      const ent = graph.entities[selectedNodeIds[0]!];
      if (!ent || ent.kind !== "content" || ent.theme === "media") return null;
      return {
        title: (ent.title ?? "").trim(),
        bodyText: stripHtmlToPlain(ent.bodyHtml),
        excludeItemId:
          ent.persistedItemId && isUuidLike(ent.persistedItemId)
            ? ent.persistedItemId
            : undefined,
        targetLabel: (ent.title ?? "").trim() || "Selected note",
      };
    }
    return null;
  }, [
    activeNodeId,
    activeSpaceId,
    cloudLinksBar,
    focusBody,
    focusOpen,
    focusTitle,
    graph.entities,
    selectedNodeIds,
  ]);

  const vaultReviewDraftActive = useMemo(
    () => (loreReviewPanelOpen ? resolveVaultReviewDraft() : null),
    [loreReviewPanelOpen, resolveVaultReviewDraft],
  );

  const runVaultReviewAnalysis = useCallback(async () => {
    const draft = resolveVaultReviewDraft();
    if (!draft) {
      setLoreReviewError("Select one text note or open focus mode on a note.");
      return;
    }
    if (draft.bodyText.length < 12) {
      setLoreReviewError("Add a bit more text before running the analysis.");
      return;
    }
    setLoreReviewLoading(true);
    setLoreReviewError(null);
    setLoreReviewIssues([]);
    setLoreReviewSuggestedTags([]);
    setLoreReviewSemanticSummary(null);
    playVigilUiSound("button");
    try {
      const res = await fetch("/api/lore/consistency/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId: activeSpaceId,
          title: draft.title,
          bodyText: draft.bodyText,
          excludeItemId: draft.excludeItemId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        issues?: VaultReviewIssue[];
        suggestedNoteTags?: string[];
        semanticSummary?: string | null;
      };
      if (!res.ok || !data.ok) {
        setLoreReviewError(typeof data.error === "string" ? data.error : "Analysis failed");
        return;
      }
      setLoreReviewIssues(Array.isArray(data.issues) ? data.issues : []);
      setLoreReviewSuggestedTags(
        Array.isArray(data.suggestedNoteTags) ? data.suggestedNoteTags : [],
      );
      setLoreReviewSemanticSummary(
        typeof data.semanticSummary === "string" ? data.semanticSummary : null,
      );
    } catch {
      setLoreReviewError("Request failed");
    } finally {
      setLoreReviewLoading(false);
    }
  }, [activeSpaceId, resolveVaultReviewDraft]);

  const appendVaultReviewTags = useCallback(
    async (tags: string[]): Promise<boolean> => {
      const draft = resolveVaultReviewDraft();
      if (!draft?.excludeItemId) return false;
      return patchItemWithVersion(draft.excludeItemId, {
        entityMetaMerge: { loreReviewTags: tags },
      });
    },
    [patchItemWithVersion, resolveVaultReviewDraft],
  );

  /** Splash / auth boot (`VigilAppBootScreen`) — hide workspace-only chrome until dismissed. */
  const bootLayerVisible =
    scenario === "default" &&
    !bootLayerDismissed &&
    (!prefersReducedMotion || bootAfterLogout);

  /**
   * Same moment as import/search in `topRightChromeCluster` (`!bootPreActivateGate` below): after Enter,
   * not after boot exit (`bootLayerDismissed`). Using expanded expr — `bootPreActivateGate` is declared later.
   */
  const vaultReviewChromeVisible =
    cloudLinksBar &&
    isUuidLike(activeSpaceId) &&
    !isRestrictedLayer &&
    !(scenario === "default" && !bootLayerDismissed && !canvasSessionActivated);

  useEffect(() => {
    const preActivate = scenario === "default" && !bootLayerDismissed && !canvasSessionActivated;
    if (preActivate) {
      setLoreReviewPanelOpen(false);
    }
  }, [scenario, bootLayerDismissed, canvasSessionActivated]);

  const paletteActions = useMemo<PaletteAction[]>(() => {
    const all: PaletteAction[] = [
      { id: "create-note", label: "Create note", hint: "Add a new note at center", icon: <FileText size={14} weight="bold" /> },
      { id: "create-checklist", label: "Create checklist", hint: "Add a checklist card", icon: <NotePencil size={14} weight="bold" /> },
      { id: "create-media", label: "Create image card", hint: "Add a media card", icon: <SquaresFour size={14} weight="bold" /> },
      { id: "create-folder", label: "Create folder", hint: "Add folder and child space", icon: <Folder size={14} weight="bold" /> },
      { id: "export-json", label: "Export graph JSON", hint: "Download the current graph", icon: <DownloadSimple size={14} weight="bold" /> },
      { id: "toggle-theme", label: "Toggle theme", hint: "Switch light/dark shell class", icon: <CopySimple size={14} weight="bold" /> },
      { id: "zoom-fit", label: "Zoom to fit", hint: "Fit visible cards into the viewport", icon: <SquaresFour size={14} weight="bold" /> },
      { id: "recenter", label: "Recenter canvas", hint: modKeyHints.recenter, icon: <Stack size={14} weight="bold" /> },
      {
        id: "ask-lore",
        label: "Ask lore (AI)",
        hint: "Claude answers from searchable canvas text",
        keywords: ["lore", "ai", "claude", "ask", "heartgarden", "question"],
        icon: <Sparkle size={14} weight="bold" />,
      },
      {
        id: "link-graph",
        label: "Link graph",
        hint: "Force-directed item_links view for this space",
        keywords: ["graph", "links", "network", "edges"],
        icon: <Graph size={14} weight="bold" />,
      },
      {
        id: "import-lore",
        label: "Import lore file",
        hint: "PDF / markdown → text + Claude entity extract (beta)",
        keywords: ["import", "pdf", "markdown", "upload"],
        icon: <UploadSimple size={14} weight="bold" />,
      },
      ...(vaultReviewChromeVisible
        ? [
            {
              id: "check-lore-consistency",
              label: "Vault review (consistency & tags)",
              hint: "Top-right panel — AI pass + label without moving cards",
              keywords: ["consistency", "conflict", "contradiction", "lore", "check", "tags", "vault"],
              icon: <SealCheck size={14} weight="bold" />,
            } satisfies PaletteAction,
          ]
        : []),
    ];
    if (!isRestrictedLayer) return all;
    const deny = new Set([
      "export-json",
      "ask-lore",
      "link-graph",
      "import-lore",
      "check-lore-consistency",
      "create-media",
      "create-folder",
    ]);
    return all.filter((a) => !deny.has(a.id));
  }, [isRestrictedLayer, modKeyHints.recenter, vaultReviewChromeVisible]);

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
    const snap = graphRef.current;
    const vis = new Set(snap.spaces[activeSpaceId]?.entityIds ?? []);
    const selected = selectedNodeIds.filter((id) => vis.has(id));
    const idsToMoveSet = new Set<string>(selected);
    for (const id of selected) {
      const e = snap.entities[id];
      if (e?.kind !== "content" || !e.stackId) continue;
      for (const ent of Object.values(snap.entities)) {
        if (ent.kind === "content" && ent.stackId === e.stackId && vis.has(ent.id)) {
          idsToMoveSet.add(ent.id);
        }
      }
    }
    const idsToMove = [...idsToMoveSet];
    if (idsToMove.length === 0) return;
    if (!idsToMove.every((id) => canMoveEntityToSpace(id, parentSpaceId))) return;
    const center = centerCoords();
    const fallback = { x: center.x - 180, y: center.y - 120 };
    const anchorBelowFolder = getParentFolderExitSlot(0) ?? fallback;
    moveEntitiesToSpace(idsToMove, parentSpaceId, {
      anchor: anchorBelowFolder,
      forceLayout: true,
      neonFlush: true,
      fromSpaceId: activeSpaceId,
    });
    if (persistNeonRef.current) {
      persistNeonItemsLayout(idsToMove);
    }
  }, [
    activeSpaceId,
    canMoveEntityToSpace,
    centerCoords,
    getParentFolderExitSlot,
    moveEntitiesToSpace,
    parentSpaceId,
    persistNeonItemsLayout,
    selectedNodeIds,
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
          queueMicrotask(() => {
            if (!persistNeonRef.current || !isUuidLike(entityId)) return;
            const ent = graphRef.current.entities[entityId];
            if (ent?.kind !== "folder") return;
            const t = title.trim() || "Untitled Folder";
            void patchItemWithVersion(entityId, { title: t });
            if (isUuidLike(ent.childSpaceId)) void apiPatchSpaceName(ent.childSpaceId, t);
          });
        },
        120,
      );
    },
    [patchItemWithVersion, queueGraphCommit, recordUndoBeforeMutation],
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
          queueMicrotask(() => {
            if (!persistNeonRef.current || !isUuidLike(entityId)) return;
            const ent = graphRef.current.entities[entityId];
            if (ent?.kind !== "folder") return;
            void patchItemWithVersion(entityId, { contentJson: buildContentJsonForFolderEntity(ent) });
          });
        },
        120,
      );
    },
    [patchItemWithVersion, queueGraphCommit, recordUndoBeforeMutation],
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
    if (isRestrictedLayer && (type === "media" || type === "folder")) return;
    if (
      persistNeonRef.current &&
      isUuidLike(activeSpaceId) &&
      getNeonSyncSnapshot().lastError?.trim()
    ) {
      return;
    }
    recordUndoBeforeMutation();
    const center = centerCoords();
    const x = center.x - 170 + (Math.random() * 60 - 30);
    const y = center.y - 100 + (Math.random() * 60 - 30);
    const rotation = (Math.random() - 0.5) * 4;
    const tapeRotation = (Math.random() - 0.5) * 6;
    const nextZ = maxZIndexRef.current + 1;
    setMaxZIndex(nextZ);

    if (persistNeonRef.current && isUuidLike(activeSpaceId)) {
      const spaceId = activeSpaceId;
      void (async () => {
        try {
        if (type === "folder") {
          const fx = center.x - FOLDER_CARD_WIDTH / 2 + (Math.random() * 60 - 30);
          const fy = center.y - FOLDER_CARD_HEIGHT / 2 + (Math.random() * 60 - 30);
          const spaceRes = await apiCreateSpace("New Folder", spaceId);
          if (!spaceRes.ok || !spaceRes.space?.id) {
            window.alert(
              spaceRes.error?.trim() ||
                "Could not create folder space. Check sync status or try again.",
            );
            return;
          }
          const childSpaceId = spaceRes.space.id;
          const tempFolder: CanvasFolderEntity = {
            id: "",
            title: "New Folder",
            kind: "folder",
            theme: "folder",
            childSpaceId,
            rotation,
            width: FOLDER_CARD_WIDTH,
            tapeRotation: 0,
            stackId: null,
            stackOrder: null,
            slots: { [spaceId]: { x: fx, y: fy } },
          };
          const itemRes = await apiCreateItem(spaceId, {
            itemType: "folder",
            x: fx,
            y: fy,
            width: FOLDER_CARD_WIDTH,
            height: FOLDER_CARD_HEIGHT,
            title: "New Folder",
            contentJson: buildContentJsonForFolderEntity(tempFolder),
            zIndex: nextZ,
          });
          if (!itemRes.ok || !itemRes.item) {
            window.alert(
              itemRes.error?.trim() ||
                "Could not create folder on the canvas. Check sync status or try again.",
            );
            return;
          }
          if (itemRes.item.updatedAt) {
            itemServerUpdatedAtRef.current.set(itemRes.item.id, itemRes.item.updatedAt);
          }
          const entity = canvasItemToEntity(itemRes.item, spaceId);
          if (!entity || entity.kind !== "folder") {
            const msg =
              "Could not display the new folder after create (unexpected response).";
            if (getNeonSyncSnapshot().cloudEnabled) {
              neonSyncReportAuxiliaryFailure({
                operation: "createNewNode (folder map)",
                message: msg,
                cause: "client",
              });
            }
            window.alert(msg);
            return;
          }
          setGraph((prev) => {
            const next = shallowCloneGraph(prev);
            next.spaces[childSpaceId] = {
              id: childSpaceId,
              name: "New Folder",
              parentSpaceId: spaceId,
              entityIds: [],
            };
            next.entities[entity.id] = entity;
            const sp = next.spaces[spaceId];
            if (sp) {
              next.spaces[spaceId] = { ...sp, entityIds: [...sp.entityIds, entity.id] };
            }
            return next;
          });
          return;
        }

        let title = "New Note";
        const width = UNIFIED_NODE_WIDTH;
        let contentTheme: ContentTheme =
          type === "task" ? "default" : (type as ContentTheme);
        let bodyHtml = `<div contenteditable="true">Start typing...</div>`;

        if (type === "task") {
          title = "Checklist";
          contentTheme = "task";
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

        const tempNode: CanvasContentEntity = {
          id: "",
          title,
          kind: "content",
          rotation,
          width,
          theme: contentTheme,
          tapeVariant: tapeVariantForTheme(contentTheme),
          tapeRotation,
          bodyHtml,
          stackId: null,
          stackOrder: null,
          slots: { [spaceId]: { x, y } },
        };
        const itemRes = await apiCreateItem(spaceId, {
          itemType: architecturalItemType(tempNode),
          x,
          y,
          width,
          height: 280,
          title,
          contentText: htmlToPlainText(bodyHtml),
          contentJson: buildContentJsonForContentEntity(tempNode),
          zIndex: nextZ,
        });
        if (!itemRes.ok || !itemRes.item) {
          window.alert(
            itemRes.error?.trim() ||
              "Could not create item on the canvas. Check sync status or try again.",
          );
          return;
        }
        if (itemRes.item.updatedAt) {
          itemServerUpdatedAtRef.current.set(itemRes.item.id, itemRes.item.updatedAt);
        }
        const entity = canvasItemToEntity(itemRes.item, spaceId);
        if (!entity) {
          const msg =
            "Could not display the new item after create (unexpected response).";
          if (getNeonSyncSnapshot().cloudEnabled) {
            neonSyncReportAuxiliaryFailure({
              operation: "createNewNode (content map)",
              message: msg,
              cause: "client",
            });
          }
          window.alert(msg);
          return;
        }
        setGraph((prev) => {
          const next = shallowCloneGraph(prev);
          next.entities[entity.id] = entity;
          const sp = next.spaces[spaceId];
          if (sp) {
            next.spaces[spaceId] = { ...sp, entityIds: [...sp.entityIds, entity.id] };
          }
          return next;
        });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Create failed unexpectedly.";
          if (getNeonSyncSnapshot().cloudEnabled) {
            neonSyncReportAuxiliaryFailure({
              operation: "createNewNode",
              message: msg,
              cause: "network",
            });
          }
          window.alert(msg);
        }
      })();
      return;
    }

    if (type === "folder") {
      const entityId = createId();
      const childSpaceId = createId();
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

    const id = createId();
    let title = "New Note";
    const width = UNIFIED_NODE_WIDTH;
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
  }, [activeSpaceId, centerCoords, createId, isRestrictedLayer, recordUndoBeforeMutation]);

  const onLoreImportFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        const parseRes = await fetch("/api/lore/import/parse", { method: "POST", body: fd });
        const parsed = (await parseRes.json()) as {
          ok?: boolean;
          error?: string;
          text?: string;
          fileName?: string;
          suggestedTitle?: string;
        };
        if (!parsed.ok || typeof parsed.text !== "string") {
          window.alert(parsed.error ?? "Parse failed");
          return;
        }

        const spaceId = activeSpaceIdRef.current;
        const useSmart =
          persistNeonRef.current && isUuidLike(spaceId) && parsed.text.trim().length > 0;

        if (useSmart) {
          setLoreImportDraft(null);
          setLoreSmartReview(null);
          setLoreSmartAcceptedMergeIds({});
          setLoreSmartClarificationAnswers([]);
          setLoreSmartIncludeSource(true);
          setLoreSmartTab("structure");
          setLoreSmartPlanning(true);
          try {
            const jobRes = await fetch("/api/lore/import/jobs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: parsed.text,
                spaceId,
                fileName: parsed.fileName,
              }),
            });
            const jobBody = (await jobRes.json()) as {
              ok?: boolean;
              error?: string;
              jobId?: string;
            };
            if (!jobRes.ok || !jobBody.ok || !jobBody.jobId) {
              window.alert(
                typeof jobBody.error === "string"
                  ? jobBody.error
                  : "Could not start import job — opening legacy review.",
              );
            } else {
              const jobId = jobBody.jobId;
              const maxAttempts = 240;
              let planReady = false;
              for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const poll = await fetch(
                  `/api/lore/import/jobs/${jobId}?spaceId=${encodeURIComponent(spaceId)}`,
                );
                const st = (await poll.json()) as {
                  ok?: boolean;
                  status?: string;
                  plan?: LoreImportPlan;
                  error?: string;
                };
                if (!poll.ok || !st.ok) {
                  window.alert(
                    typeof st.error === "string"
                      ? st.error
                      : "Import job status request failed — opening legacy review.",
                  );
                  break;
                }
                if (st.status === "ready" && st.plan) {
                  planReady = true;
                  setLoreSmartReview({
                    plan: st.plan,
                    sourceText: parsed.text,
                    sourceTitle: parsed.suggestedTitle,
                    fileName: parsed.fileName,
                  });
                  setLoreSmartClarificationAnswers([]);
                  const nextMerge: Record<string, boolean> = {};
                  for (const m of st.plan.mergeProposals) {
                    nextMerge[m.id] = false;
                  }
                  setLoreSmartAcceptedMergeIds(nextMerge);
                  if (st.plan.clarifications.some((c) => c.severity === "required")) {
                    setLoreSmartTab("questions");
                  }
                  return;
                }
                if (st.status === "failed") {
                  window.alert(
                    typeof st.error === "string"
                      ? st.error
                      : "Smart import plan failed — opening legacy review.",
                  );
                  break;
                }
                await new Promise((r) => setTimeout(r, 900));
              }
              if (!planReady) {
                window.alert(
                  "Import planning is taking too long (the server may still be working). Try again with a shorter file, or use legacy import.",
                );
              }
            }
          } catch {
            window.alert("Smart import job request failed — opening legacy review.");
          } finally {
            setLoreSmartPlanning(false);
          }
        }

        let entities: LoreImportEntityDraft[] = [];
        let suggestedLinks: LoreImportLinkDraft[] = [];
        try {
          const extRes = await fetch("/api/lore/import/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: parsed.text }),
          });
          const extracted = (await extRes.json()) as {
            ok?: boolean;
            error?: string;
            entities?: LoreImportEntityDraft[];
            suggestedLinks?: LoreImportLinkDraft[];
          };
          if (extRes.ok && extracted.ok) {
            entities = Array.isArray(extracted.entities) ? extracted.entities : [];
            suggestedLinks = Array.isArray(extracted.suggestedLinks) ? extracted.suggestedLinks : [];
          } else if (extRes.status !== 503) {
            window.alert(extracted.error ?? "Extract failed");
            return;
          }
        } catch {
          /* Network error — still open manual review with parsed text */
        }
        setLoreImportDraft({
          fileName: parsed.fileName,
          sourceTitle: parsed.suggestedTitle,
          sourceText: parsed.text,
          includeSourceCard: true,
          entities,
          suggestedLinks,
        });
      } catch {
        window.alert("Import request failed");
      }
    },
    [],
  );

  const exportGraphJson = useCallback(() => {
    const data = JSON.stringify(graphRef.current, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `heartgarden-graph-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const runPaletteAction = useCallback((actionId: string) => {
    if (
      isRestrictedLayer &&
      [
        "export-json",
        "ask-lore",
        "link-graph",
        "import-lore",
        "check-lore-consistency",
        "create-media",
        "create-folder",
      ].includes(actionId)
    ) {
      return;
    }
    if (actionId === "create-note") {
      createNewNode("default");
      playVigilUiSound("select");
      return;
    }
    if (actionId === "create-checklist") {
      createNewNode("task");
      playVigilUiSound("select");
      return;
    }
    if (actionId === "create-media") {
      createNewNode("media");
      playVigilUiSound("select");
      return;
    }
    if (actionId === "create-folder") {
      createNewNode("folder");
      playVigilUiSound("select");
      return;
    }
    if (actionId === "export-json") {
      playVigilUiSound("button");
      exportGraphJson();
      return;
    }
    if (actionId === "toggle-theme") {
      const html = document.documentElement;
      const willBeDark = !html.classList.contains("dark");
      playVigilUiSound(willBeDark ? "toggle_on" : "toggle_off");
      html.classList.toggle("dark");
      html.dataset.vigilTheme = html.classList.contains("dark") ? "dark" : "light";
      return;
    }
    if (actionId === "zoom-fit") {
      const ids = activeSpace?.entityIds ?? [];
      if (ids.length === 0) {
        recenterToOrigin();
        playVigilUiSound("select");
        return;
      }
      const slots = ids
        .map((id) => graphRef.current.entities[id]?.slots[activeSpaceIdRef.current])
        .filter((slot): slot is { x: number; y: number } => !!slot);
      if (slots.length === 0) {
        recenterToOrigin();
        playVigilUiSound("select");
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
      playVigilUiSound("select");
      return;
    }
    if (actionId === "recenter") {
      recenterToOrigin();
      playVigilUiSound("select");
      return;
    }
    if (actionId === "ask-lore") {
      setLorePanelOpen(true);
      playVigilUiSound("select");
      return;
    }
    if (actionId === "link-graph") {
      setGraphOverlayOpen(true);
      playVigilUiSound("select");
      return;
    }
    if (actionId === "import-lore") {
      playVigilUiSound("select");
      loreImportFileInputRef.current?.click();
      return;
    }
    if (actionId === "check-lore-consistency") {
      if (bootLayerVisible) return;
      setLoreReviewError(null);
      setLoreReviewPanelOpen(true);
      playVigilUiSound("select");
    }
  }, [
    activeSpace?.entityIds,
    bootLayerVisible,
    createNewNode,
    exportGraphJson,
    isRestrictedLayer,
    recenterToOrigin,
  ]);

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
      if (!stackModalRef.current && !nextFolderId && canDragGroupStack) {
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
      if (stackModalRef.current) return false;
      const target = graph.entities[targetEntityId];
      if (!target || target.kind !== "content") return false;
      const idsToStack = draggedEntityIds.filter((id, index) => {
        if (draggedEntityIds.indexOf(id) !== index) return false;
        if (id === targetEntityId) return false;
        const entity = graph.entities[id];
        return !!entity && entity.kind === "content";
      });
      if (idsToStack.length === 0) return false;

      recordUndoBeforeMutation();
      const stackId = target.stackId ?? createId();
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
        const baseOrder = existing.length;
        const nAdd = idsToStack.length;

        idsToStack.forEach((id, addIndex) => {
          const entity = next.entities[id];
          if (!entity || entity.kind !== "content") return;
          if (entity.stackId && entity.stackId !== stackId) {
            normalizedOldStackIds.add(entity.stackId);
          }
          next.entities[id] = {
            ...entity,
            stackId,
            /* First in drag list sits on top of the pile (above existing members). */
            stackOrder: baseOrder + (nAdd - 1 - addIndex),
            slots: targetSlot
              ? {
                  ...entity.slots,
                  [activeSpaceId]: { x: targetSlot.x, y: targetSlot.y },
                }
              : entity.slots,
          };
        });

        next = normalizeStack(stackId, next);
        normalizedOldStackIds.forEach((oldStackId) => {
          next = normalizeStack(oldStackId, next);
        });
        return next;
      });
      setSelectedNodeIds([targetEntityId, ...idsToStack]);
      if (persistNeonRef.current) {
        queueMicrotask(() => {
          const g = graphRef.current;
          const top = g.entities[targetEntityId];
          const sid = top?.kind === "content" ? top.stackId : null;
          const persistSet = new Set<string>([targetEntityId, ...idsToStack]);
          if (sid) {
            for (const e of Object.values(g.entities)) {
              if (e.kind === "content" && e.stackId === sid) persistSet.add(e.id);
            }
          }
          persistNeonItemsLayout([...persistSet]);
        });
      }
      return true;
    },
    [
      activeSpaceId,
      createId,
      graph.entities,
      normalizeStack,
      persistNeonItemsLayout,
      recordUndoBeforeMutation,
    ],
  );

  const handleDrop = useCallback(
    async (draggedEntityIds: string[]) => {
      if (draggedEntityIds.length === 0) return;
      const center = centerCoords();
      const fallback = { x: center.x - 180, y: center.y - 120 };

      if (parentDropHoveredRef.current && parentSpaceId) {
        const anchorBelowFolder = getParentFolderExitSlot(0) ?? fallback;
        moveEntitiesToSpace(draggedEntityIds, parentSpaceId, {
          anchor: anchorBelowFolder,
          forceLayout: true,
          skipUndo: true,
          neonFlush: true,
          fromSpaceId: activeSpaceIdRef.current,
        });
        suppressParentExitActivateUntilRef.current = Date.now() + 500;
        return;
      }

      if (hoveredFolderId) {
        const folderEntity = graphRef.current.entities[hoveredFolderId];
        if (folderEntity && folderEntity.kind === "folder") {
          const childSpaceId = graphRef.current.spaces[folderEntity.childSpaceId]
            ? folderEntity.childSpaceId
            : await ensureFolderChildSpace(hoveredFolderId);
          if (childSpaceId) {
            moveEntitiesToSpace(draggedEntityIds, childSpaceId, {
              anchor: fallback,
              forceLayout: true,
              skipUndo: true,
              neonFlush: true,
              fromSpaceId: activeSpaceIdRef.current,
            });
            return;
          }
        }
      }

      if (hoveredStackTargetId && !stackModalRef.current) {
        stackEntitiesOntoTarget(draggedEntityIds, hoveredStackTargetId);
      }
    },
    [
      centerCoords,
      ensureFolderChildSpace,
      getParentFolderExitSlot,
      hoveredFolderId,
      hoveredStackTargetId,
      moveEntitiesToSpace,
      parentSpaceId,
      stackEntitiesOntoTarget,
    ],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (lassoStartRef.current) {
        const pid = lassoPointerIdRef.current;
        if (pid != null && event.pointerId !== pid) return;
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
      const { tx, ty, scale: viewScale } = viewRef.current;
      const mouseCanvasX = (event.clientX - tx) / viewScale;
      const mouseCanvasY = (event.clientY - ty) / viewScale;
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

    const completeActiveLasso = () => {
      if (!lassoStartRef.current) return;
      const start = lassoStartRef.current;
      const rect: LassoRectScreen =
        lassoRectScreenRef.current ?? {
          x1: start.x,
          y1: start.y,
          x2: start.x,
          y2: start.y,
        };
      lassoStartRef.current = null;
      lassoPointerIdRef.current = null;
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
        const spaceId = activeSpaceIdRef.current;
        const allowedIds = new Set(
          graphRef.current.spaces[spaceId]?.entityIds ?? [],
        );
        const canvasRoot = canvasEntityLayerRef.current ?? viewportRef.current;
        const nodeEls = canvasRoot
          ? Array.from(canvasRoot.querySelectorAll<HTMLElement>("[data-node-id]"))
          : [];
        /* Center-point containment matches “what the box clearly covers” better than
         * AABB overlap (avoids grabbing neighbors / extra stack layers on a thin edge). */
        const hits: string[] = [];
        for (const el of nodeEls) {
          const id = el.dataset.nodeId;
          if (!id || !allowedIds.has(id)) continue;
          if (el.dataset.spaceId && el.dataset.spaceId !== spaceId) continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 && r.height <= 0) continue;
          const cx = (r.left + r.right) / 2;
          const cy = (r.top + r.bottom) / 2;
          if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
            hits.push(id);
          }
        }
        const seen = new Set<string>();
        const unique = hits.filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        const canvasOrder = graphRef.current.spaces[spaceId]?.entityIds ?? [];
        const orderIdx = new Map(canvasOrder.map((eid, i) => [eid, i]));
        unique.sort((a, b) => (orderIdx.get(a) ?? 1e9) - (orderIdx.get(b) ?? 1e9));
        setSelectedNodeIds(unique);
      }
    };

    const finishLassoFromPointer = (event: PointerEvent) => {
      if (!lassoStartRef.current) return;
      const pid = lassoPointerIdRef.current;
      if (pid != null && event.pointerId !== pid) return;
      completeActiveLasso();
    };

    const onMouseMoveForLasso = (event: MouseEvent) => {
      if (!lassoStartRef.current) return;
      const start = lassoStartRef.current;
      const next: LassoRectScreen = {
        x1: start.x,
        y1: start.y,
        x2: event.clientX,
        y2: event.clientY,
      };
      lassoRectScreenRef.current = next;
      setLassoRectScreen(next);
    };

    const onWindowPointerOrMouseUp = (event: PointerEvent | MouseEvent) => {
      if ("pointerId" in event) {
        finishLassoFromPointer(event);
      } else if (event.button === 0 && lassoStartRef.current) {
        completeActiveLasso();
      }

      isPanningRef.current = false;
      setIsPanning(false);
      if (draggedNodeIdsRef.current.length > 0) {
        const ids = [...draggedNodeIdsRef.current];
        updateDropTargets(ids[0], dragPointerScreenRef.current.x, dragPointerScreenRef.current.y);
        void handleDrop(ids).then(() => {
          if (!persistNeonRef.current) return;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              persistNeonItemsLayout(ids);
            });
          });
        });
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

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onWindowPointerOrMouseUp);
    window.addEventListener("pointercancel", onWindowPointerOrMouseUp);
    window.addEventListener("mousemove", onMouseMoveForLasso);
    window.addEventListener("mouseup", onWindowPointerOrMouseUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onWindowPointerOrMouseUp);
      window.removeEventListener("pointercancel", onWindowPointerOrMouseUp);
      window.removeEventListener("mousemove", onMouseMoveForLasso);
      window.removeEventListener("mouseup", onWindowPointerOrMouseUp);
    };
  }, [
    activeSpaceId,
    handleDrop,
    persistNeonItemsLayout,
    setParentDropHover,
    updateDropTargets,
  ]);

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

    const onMouseUp = (event: MouseEvent) => {
      const drag = stackDragRef.current;
      const hullSnap = stackDragHullOrderedIdsRef.current;
      const orderedSnap = stackModalOrderedIdsDuringDragRef.current;
      const stackOrderAtDragStart = stackModalDragStartOrderedIdsRef.current;

      setStackDrag(null);
      stackDragRef.current = null;
      setStackModalEjectPreview(false);
      lastStackEjectPreviewRef.current = false;
      stackDragHullOrderedIdsRef.current = null;
      stackModalOrderedIdsDuringDragRef.current = null;
      stackModalDragStartOrderedIdsRef.current = null;
      stackEjectTouchedOutsideRef.current = false;
      stackBlockLiveReorderRef.current = false;

      const modal = stackModalRef.current;
      if (!drag || !modal) return;

      const releaseX = event.clientX;
      const releaseY = event.clientY;

      const hullForEject = hullSnap ?? getVisibleOrdered(modal.orderedIds);
      const outsideWithMargin = isDraggedOutsideHull(
        {
          entityId: drag.entityId,
          currentX: releaseX,
          currentY: releaseY,
          pointerOffsetX: drag.pointerOffsetX,
          pointerOffsetY: drag.pointerOffsetY,
        },
        hullForEject,
      );

      const orderedIdsForCommit = orderedSnap ?? modal.orderedIds;
      const pointerMoved =
        Math.hypot(releaseX - drag.startX, releaseY - drag.startY) > 2;

      if (outsideWithMargin && pointerMoved) {
        const graphSnap = graphRef.current;
        const extracted = graphSnap.entities[drag.entityId];
        const spaceId = activeSpaceIdRef.current;
        if (extracted) {
          const remainingOrdered = orderedIdsForCommit.filter((id) => id !== drag.entityId);
          const remaining = remainingOrdered
            .map((id) => graphSnap.entities[id])
            .filter(
              (entity): entity is CanvasEntity =>
                !!entity && entity.kind === "content" && entity.stackId === modal.stackId,
            );

          const { tx, ty, scale: viewScale } = viewRef.current;
          const canvasRect = canvasTransformRef.current?.getBoundingClientRect();
          const cardLeftClient = releaseX - drag.pointerOffsetX;
          const cardTopClient = releaseY - drag.pointerOffsetY;
          const aw = modal.anchorWorld;
          const stackSL = modal.stackScreenLeft;
          const stackST = modal.stackScreenTop;
          let worldDropX: number;
          let worldDropY: number;
          if (
            aw &&
            Number.isFinite(stackSL) &&
            Number.isFinite(stackST) &&
            Number.isFinite(viewScale) &&
            viewScale !== 0
          ) {
            worldDropX = Math.round(aw.x + (cardLeftClient - stackSL) / viewScale);
            worldDropY = Math.round(aw.y + (cardTopClient - stackST) / viewScale);
          } else {
            const dropWorld = clientPointToCanvasWorld(
              cardLeftClient,
              cardTopClient,
              canvasRect,
              tx,
              ty,
              viewScale,
            );
            worldDropX = Math.round(dropWorld.x);
            worldDropY = Math.round(dropWorld.y);
          }

          const sortedRemaining = [...remaining].sort(
            (a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0),
          );
          const anchorSource = sortedRemaining[sortedRemaining.length - 1] ?? sortedRemaining[0];
          const anchorFallback = anchorSource
            ? graphSnap.entities[anchorSource.id]?.slots[spaceId]
            : undefined;
          const anchorSlot = aw ?? anchorFallback;

          setGraph((prev) => {
            const next = shallowCloneGraph(prev);
            if (sortedRemaining.length >= 2) {
              sortedRemaining.forEach((entity, index) => {
                const current = next.entities[entity.id];
                if (!current) return;
                next.entities[entity.id] = {
                  ...current,
                  stackId: modal.stackId,
                  stackOrder: index,
                  slots:
                    anchorSlot != null
                      ? { ...current.slots, [spaceId]: { x: anchorSlot.x, y: anchorSlot.y } }
                      : current.slots,
                };
              });
            } else if (sortedRemaining.length === 1) {
              const sole = sortedRemaining[0]!;
              const current = next.entities[sole.id];
              if (current) {
                next.entities[sole.id] = {
                  ...current,
                  stackId: null,
                  stackOrder: null,
                  slots:
                    anchorSlot != null
                      ? { ...current.slots, [spaceId]: { x: anchorSlot.x, y: anchorSlot.y } }
                      : current.slots,
                };
              }
            }
            const pulled = next.entities[drag.entityId];
            if (pulled && extracted.kind === "content") {
              next.entities[drag.entityId] = {
                ...pulled,
                stackId: null,
                stackOrder: null,
                slots: {
                  ...pulled.slots,
                  [spaceId]: { x: worldDropX, y: worldDropY },
                },
              };
            }
            return next;
          });
          setMaxZIndex((z) => z + 1);
          setStackModalEjectCount((count) => count + 1);
          playVigilUiSound("swipe");
          closeStackModal();
          if (persistNeonRef.current) {
            const persistIds = [drag.entityId, ...sortedRemaining.map((e) => e.id)];
            requestAnimationFrame(() => {
              persistNeonItemsLayout(persistIds);
            });
          }
        }
        return;
      }
      if (drag.intent === "reorder") {
        const ordered = orderedIdsForCommit;
        const orderChanged =
          stackOrderAtDragStart != null &&
          (stackOrderAtDragStart.length !== ordered.length ||
            stackOrderAtDragStart.some((id, i) => id !== ordered[i]));
        if (orderChanged) playVigilUiSound("swipe");
        setGraph((prev) => {
          const next = shallowCloneGraph(prev);
          const topOrder = ordered.length - 1;
          ordered.forEach((id, index) => {
            const entity = next.entities[id];
            if (!entity) return;
            next.entities[id] = {
              ...entity,
              stackOrder: topOrder - index,
            };
          });
          return next;
        });
        if (orderChanged && persistNeonRef.current) {
          requestAnimationFrame(() => persistNeonItemsLayout(ordered));
        }
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp, true);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp, true);
    };
  }, [closeStackModal, persistNeonItemsLayout, stackModal, viewportSize]);

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
      /* Folder face (.folderFront) must arm drag/select like other cards; only the title
       * editor, chrome buttons, and note bodies opt out. Double-click to open uses React
       * onDoubleClick on ArchitecturalFolderCard (with stopPropagation). */
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
                      (id) => id !== nodeId && activeSpaceEntityIds.includes(id),
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
    activeSpaceEntityIds,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (paletteOpenRef.current || lorePanelOpenRef.current) return;
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

  const deleteEntitySelection = useCallback(
    (entityIds: string[]) => {
      if (entityIds.length === 0) return;
      const snap = graphRef.current;
      const { entityIds: idsToRemove, spaceIds } = collectDeletionClosure(snap, entityIds);
      const spaceRoots = filterSpaceDeletionRoots(spaceIds, snap);
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

        Object.keys(next.connections).forEach((cid) => {
          const c = next.connections[cid];
          if (
            entityIdsToDelete.has(c.sourceEntityId) ||
            entityIdsToDelete.has(c.targetEntityId)
          ) {
            delete next.connections[cid];
          }
        });

        return next;
      });

      if (persistNeonRef.current) {
        for (const id of idsToRemove) {
          if (isUuidLike(id)) void apiDeleteItem(id);
        }
        for (const sid of spaceRoots) {
          if (isUuidLike(sid)) void apiDeleteSpaceSubtree(sid);
        }
      }

      const pruned = new Set(idsToRemove);
      pruneRecentItems(pruned);
      pruneRecentFolders(pruned);

      setSelectedNodeIds((prev) => prev.filter((id) => !entityIds.includes(id)));
      if (activeNodeId && entityIds.includes(activeNodeId)) {
        setFocusOpen(false);
        setActiveNodeId(null);
      }
      if (galleryNodeId && entityIds.includes(galleryNodeId)) {
        closeMediaGallery();
      }
    },
    [
      activeNodeId,
      closeMediaGallery,
      galleryNodeId,
      pruneRecentFolders,
      pruneRecentItems,
      recordUndoBeforeMutation,
    ],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (paletteOpenRef.current || lorePanelOpenRef.current) return;
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
        lassoPointerIdRef.current = null;
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
  }, [
    closeMediaGallery,
    closeStackModal,
    focusOpen,
    galleryOpen,
    goBack,
    parentSpaceId,
    setParentDropHover,
    stackModal,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (paletteOpenRef.current || lorePanelOpenRef.current) return;
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

  const onViewportPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary) return;
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
        lassoPointerIdRef.current = event.pointerId;
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
      if (focusOpen || galleryOpen || stackModal || paletteOpenRef.current || lorePanelOpenRef.current)
        return;
      const target = event.target as HTMLElement;
      const inEditable =
        !!target.closest("input, textarea, select, [contenteditable='true']");

      // Allow native scroll inside node bodies even when not contenteditable
      // (e.g. pan tool active). Only when the body actually overflows.
      const scrollBody = target.closest<HTMLElement>("[data-node-body-editor]");
      const inScrollableBody =
        !!scrollBody && scrollBody.scrollHeight > scrollBody.clientHeight;

      // Preserve native wheel/scroll behavior inside editors or scrollable
      // document bodies when the user is not pinch-zooming.
      if ((inEditable || inScrollableBody) && !(event.ctrlKey || event.metaKey)) return;

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
      if (paletteOpenRef.current || lorePanelOpenRef.current) return;
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
      if (paletteOpenRef.current || lorePanelOpenRef.current) return;
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
      if (event.shiftKey) {
        if (undoFutureRef.current.length === 0) return;
        redo();
      } else {
        if (undoPastRef.current.length === 0) return;
        undo();
      }
      playVigilUiSound("tap");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusOpen, galleryOpen, redo, undo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (paletteOpenRef.current || lorePanelOpenRef.current) return;
      const target = event.target as HTMLElement | null;
      if (isEditableTarget(target)) return;
      if (focusOpen || galleryOpen || stackModal) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();

      // Tool / mode hotkeys use unmodified single keys to avoid browser/system collisions.
      if (key === "v") {
        event.preventDefault();
        setActiveTool("select");
        setConnectionMode("move");
        setConnectionSourceId(null);
        setConnectionCursorWorld(null);
        selectionBeforeConnectionModeRef.current = null;
        return;
      }
      if (key === "h") {
        event.preventDefault();
        setActiveTool("pan");
        setConnectionMode("move");
        setConnectionSourceId(null);
        setConnectionCursorWorld(null);
        selectionBeforeConnectionModeRef.current = null;
        return;
      }
      if (key === "d") {
        event.preventDefault();
        const resolved = connectionMode === "draw" ? "move" : "draw";
        setConnectionMode(resolved);
        setActiveTool("select");
        if (resolved === "move") {
          const restore = selectionBeforeConnectionModeRef.current;
          if (restore) setSelectedNodeIds(restore.filter((id) => !!graphRef.current.entities[id]));
          selectionBeforeConnectionModeRef.current = null;
          setConnectionSourceId(null);
          setConnectionCursorWorld(null);
        } else {
          if (!selectionBeforeConnectionModeRef.current) {
            selectionBeforeConnectionModeRef.current = [...selectedNodeIdsRef.current];
          }
          setSelectedNodeIds([]);
        }
        return;
      }
      if (key === "x") {
        event.preventDefault();
        const resolved = connectionMode === "cut" ? "move" : "cut";
        setConnectionMode(resolved);
        setActiveTool("select");
        if (resolved === "move") {
          const restore = selectionBeforeConnectionModeRef.current;
          if (restore) setSelectedNodeIds(restore.filter((id) => !!graphRef.current.entities[id]));
          selectionBeforeConnectionModeRef.current = null;
          setConnectionSourceId(null);
          setConnectionCursorWorld(null);
        } else {
          if (!selectionBeforeConnectionModeRef.current) {
            selectionBeforeConnectionModeRef.current = [...selectedNodeIdsRef.current];
          }
          setSelectedNodeIds([]);
        }
        return;
      }

      // Creation hotkeys (1-5) map to dock create actions.
      if (key === "1") {
        event.preventDefault();
        createNewNode("default");
        return;
      }
      if (key === "2") {
        event.preventDefault();
        createNewNode("task");
        return;
      }
      if (key === "3") {
        event.preventDefault();
        createNewNode("code");
        return;
      }
      if (key === "4") {
        if (isRestrictedLayer) return;
        event.preventDefault();
        createNewNode("media");
        return;
      }
      if (key === "5") {
        if (isRestrictedLayer) return;
        event.preventDefault();
        createNewNode("folder");
        return;
      }

      if (key === "g" && selectedNodeIdsRef.current.length >= 2) {
        event.preventDefault();
        alignSelectedInGridRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [connectionMode, createNewNode, focusOpen, galleryOpen, isRestrictedLayer, stackModal]);

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
      if (nodeId && activeSpaceEntityIds.includes(nodeId)) {
        hitIds = [nodeId];
      } else if (stackId) {
        const members = activeSpaceEntities
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
    [focusOpen, galleryOpen, stackModal, activeSpaceEntities, activeSpaceEntityIds],
  );

  const duplicateSelectedEntities = useCallback(() => {
    const ids = selectedNodeIdsRef.current.filter((id) => activeSpaceEntityIds.includes(id));
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
        plan.push({ kind: "content", nid: createId(), fromId: id });
      } else {
        plan.push({
          kind: "folder",
          nid: createId(),
          fromId: id,
          childSpaceId: createId(),
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
  }, [createId, recordUndoBeforeMutation, activeSpaceEntityIds]);

  const alignSelectedInGrid = useCallback(() => {
    const ids = selectedNodeIdsRef.current.filter((id) => activeSpaceEntityIds.includes(id));
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
  }, [recordUndoBeforeMutation, activeSpaceEntityIds]);
  alignSelectedInGridRef.current = alignSelectedInGrid;

  const stackSelectionUi = useMemo(
    () => getStackSelectionState(graph, activeSpaceId, selectedNodeIds),
    [graph, activeSpaceId, selectedNodeIds],
  );

  const unstackWhollySelectedStacks = useCallback((selectionOverride?: readonly string[]) => {
    const g = graphRef.current;
    const spaceId = activeSpaceIdRef.current;
    const rawSelection = selectionOverride ?? selectedNodeIdsRef.current;
    const { whollySelectedStackIds } = getStackSelectionState(g, spaceId, rawSelection);
    if (whollySelectedStackIds.length === 0) return;
    const memberIds: string[] = [];
    for (const sid of whollySelectedStackIds) {
      const members = Object.values(g.entities)
        .filter(
          (e): e is Extract<CanvasEntity, { kind: "content" }> =>
            e.kind === "content" && e.stackId === sid,
        )
        .sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0));
      memberIds.push(...members.map((m) => m.id));
    }
    recordUndoBeforeMutation();
    setGraph((prev) => {
      let next = prev;
      for (const stackId of whollySelectedStackIds) {
        next = applyUnstackStackInSpace(next, stackId, spaceId);
      }
      return next;
    });
    setSelectedNodeIds(memberIds);
  }, [recordUndoBeforeMutation]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (paletteOpenRef.current || lorePanelOpenRef.current) return;
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
          if (entity?.kind === "content" && entity.stackId) {
            const group = stackGroups.get(entity.stackId);
            if (group && group.length >= 2) {
              unstackGroup(entity.stackId);
              return;
            }
          }
        }
        const ui = getStackSelectionState(
          graphRef.current,
          activeSpaceIdRef.current,
          selectedNodeIds,
        );
        if (ui.canMergeStacks) {
          stackSelectedContent(selectedNodeIds);
        } else if (ui.canUnstackWhollySelected) {
          unstackWhollySelectedStacks(selectedNodeIds);
        }
        return;
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
    stackGroups,
    stackSelectedContent,
    unstackGroup,
    unstackWhollySelectedStacks,
  ]);

  const selectionContextMenuItems = useMemo<ContextMenuItem[]>(
    () => [
      {
        label:
          stackSelectionUi.whollySelectedStackIds.length >= 2 ? "Merge stacks" : "Create stack",
        icon: <Stack size={18} weight="bold" aria-hidden />,
        disabled: !stackSelectionUi.canMergeStacks,
        onSelect: () => stackSelectedContent(selectedNodeIds),
      },
      {
        label: "Unstack",
        icon: <ArrowsOut size={18} weight="bold" aria-hidden />,
        disabled: !stackSelectionUi.canUnstackWhollySelected,
        onSelect: () => unstackWhollySelectedStacks(selectedNodeIds),
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
      deleteEntitySelection,
      duplicateSelectedEntities,
      selectedNodeIds,
      stackSelectedContent,
      stackSelectionUi.canMergeStacks,
      stackSelectionUi.canUnstackWhollySelected,
      stackSelectionUi.whollySelectedStackIds.length,
      unstackWhollySelectedStacks,
    ],
  );

  const connectionContextMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!selectedConnectionId) return [];
    const selected = graph.connections[selectedConnectionId];
    const currentSlack = selected?.slackMultiplier ?? DEFAULT_LINK_SLACK_MULTIPLIER;
    const currentLt = selected?.linkType ?? "pin";
    const typeItems: ContextMenuItem[] = LORE_LINK_TYPE_OPTIONS.map((opt) => ({
      label: `${currentLt === opt.value ? "✓ " : ""}Link: ${opt.label}`,
      onSelect: () => setConnectionLinkType(selectedConnectionId, opt.value),
    }));
    const base: ContextMenuItem[] = [
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
      ...typeItems,
    ];
    return base;
  }, [cutConnection, graph.connections, selectedConnectionId, setConnectionLinkType, setConnectionSlack]);

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
          return { ...action, disabled: !canInsertImage || isRestrictedLayer };
        }
        if (action.command === "formatBlock" && action.value === "blockquote") {
          return { ...action, active: formatCommandState.blockTag === "blockquote" };
        }
        return action;
      }),
    [canInsertImage, formatCommandState.blockTag, isRestrictedLayer],
  );

  const dockCreateActions = useMemo(
    () =>
      isRestrictedLayer
        ? DEFAULT_CREATE_ACTIONS.filter(
            (a) => a.nodeType !== "media" && a.nodeType !== "folder",
          )
        : DEFAULT_CREATE_ACTIONS,
    [isRestrictedLayer],
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
    if (selectedNodeIds.length >= 1) return;
    setSelectionContextMenu((prev) => (prev === null ? prev : null));
  }, [selectedNodeIds.length]);

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
    if (selectedConnectionId) return;
    setConnectionContextMenu((prev) => (prev === null ? prev : null));
  }, [selectedConnectionId]);

  useEffect(() => {
    setSelectedNodeIds((prev) => {
      const next = prev.filter((id) => activeSpaceEntityIds.includes(id));
      return sameOrderedStringIds(prev, next) ? prev : next;
    });
  }, [activeSpaceEntityIds]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (!activeSpaceEntityIds.includes(activeNodeId)) {
      setFocusOpen(false);
      setActiveNodeId(null);
    }
  }, [activeNodeId, activeSpaceEntityIds]);

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
    () => selectedNodeIds.filter((id) => activeSpaceEntityIds.includes(id)),
    [selectedNodeIds, activeSpaceEntityIds],
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

  const technicalViewportReady = useMemo(() => {
    const bootstrapOk = scenario !== "default" || canvasBootstrapResolved;
    if (!canvasEffectsEnabled && scenario === "default") {
      return bootstrapOk;
    }
    return canvasSurfaceReady && bootstrapOk;
  }, [canvasEffectsEnabled, canvasSurfaceReady, canvasBootstrapResolved, scenario]);

  const viewportRevealReady = useMemo(() => {
    if (scenario !== "default") return technicalViewportReady;
    return technicalViewportReady && canvasSessionActivated;
  }, [scenario, technicalViewportReady, canvasSessionActivated]);

  /**
   * Pre-Enter gate only: hide in-viewport chrome + dot grid, elevate top-left above the boot overlay.
   * Once the user activates, show real chrome immediately — boot UI may stay mounted for ambient audio
   * fade (seconds) after the overlay opacity transition, which previously hid toolbars for that whole gap.
   */
  const bootPreActivateGate =
    scenario === "default" && !bootLayerDismissed && !canvasSessionActivated;

  /** No live Neon and no local snapshot — avoid an empty canvas that reads as data loss. */
  const showWorkspaceBlockingNoSnapshot =
    scenario === "default" &&
    neonWorkspaceOk === false &&
    !workspaceViewFromCache &&
    canvasBootstrapResolved;

  /**
   * Defer blocking UI until the boot overlay is gone — the splash uses a transparent fixed layer; an
   * in-viewport fixed scrim can stack above it and obscure the poetry + CTA.
   */
  const showWorkspaceBlockingOverlay =
    showWorkspaceBlockingNoSnapshot && !bootLayerVisible;

  const chromeEntranceOn = !prefersReducedMotion && chromeEnterEpoch > 0;

  /** Same moment as top-left chrome after Enter — do not wait for boot tear-down / ambient fade. */
  const showLogOutToAuth = scenario === "default" && canvasSessionActivated;

  return (
    <>
      {itemConflictQueue.length > 0 ? (
        <div className={styles.collabConflictBanner} role="alert">
          <span>
            Another session updated this card while you were editing. Load the server copy or dismiss to
            keep your draft.
            {itemConflictQueue.length > 1
              ? ` (${itemConflictQueue.length - 1} more in queue)`
              : ""}
          </span>
          <ArchitecturalButton type="button" size="menu" tone="glass" onClick={applyItemConflictFromServer}>
            Use server version
          </ArchitecturalButton>
          <ArchitecturalButton type="button" size="menu" tone="glass" onClick={dismissConflictHead}>
            Dismiss
          </ArchitecturalButton>
        </div>
      ) : null}
      {bootLayerVisible ? (
        <VigilAppBootScreen
          technicalReady={technicalViewportReady}
          flowerPortalContainer={bootFlowerPortalHost}
          canvasEffectsEnabled={canvasEffectsEnabled}
          onCanvasEffectsEnabledChange={handleCanvasEffectsEnabledChange}
          bootAmbientEpoch={bootAmbientEpoch}
          bootAmbientPrimePlaybackRef={bootAmbientPrimePlaybackRef}
          bootGateEnabled={heartgardenBootApi.loaded && heartgardenBootApi.gateEnabled}
          bootGateStatusReady={heartgardenBootApi.loaded}
          serverConfigurationError={bootServerConfigurationError}
          onActivate={() => {
            if (!bootCelebrationPlayedRef.current) {
              bootCelebrationPlayedRef.current = true;
              playVigilUiSound("celebration");
            }
            if (!prefersReducedMotion) {
              setChromeEnterEpoch((e) => e + 1);
            }
            setCanvasSessionActivated(true);
            /*
             * POST /api/heartgarden/boot sets `hg_boot`; refresh GET status so tier/sessionValid match the cookie,
             * then the bootstrap effect (or demo branch) loads the correct workspace.
             */
            const boot = heartgardenBootApiRef.current;
            if (boot.loaded && boot.gateEnabled) {
              void (async () => {
                try {
                  const r = await fetch("/api/heartgarden/boot", { credentials: "include" });
                  if (!r.ok) return;
                  const d = (await r.json()) as HeartgardenBootStatusJson;
                  setHeartgardenBootApi(parseHeartgardenBootStatus(d));
                } catch {
                  /* ignore */
                }
              })();
            }
          }}
          onExitComplete={() => {
            setBootLayerDismissed(true);
            setBootAfterLogout(false);
          }}
        />
      ) : null}
      <div
        ref={shellRef}
        className={`${styles.shell} ${focusOpen || galleryOpen ? styles.shellBackdropBlurActive : ""} ${
          focusOpen ? styles.shellFocusDockBleed : ""
        }`}
      >
      <div
        ref={setViewportNode}
        className={`${styles.viewport} ${
          viewportRevealReady ? styles.viewportSurfaceReady : styles.viewportSurfacePending
        } ${activeSpaceId !== graph.rootSpaceId ? styles.deepSpace : ""}${
          !canvasEffectsEnabled ? ` ${styles.viewportAmbientOff}` : ""
        }${stackModal ? ` ${styles.viewportStackModalOpen}` : ""} ${
          connectionMode !== "move" ? styles.viewportConnectionMode : ""
        }${bootPreActivateGate ? ` ${styles.viewportBootNoGrid}` : ""}${
          showWorkspaceBlockingOverlay ? ` ${styles.viewportDisconnectedNoData}` : ""
        }`}
        aria-busy={!viewportRevealReady}
        data-vigil-canvas="true"
        data-canvas-ready={viewportRevealReady ? "true" : "false"}
        onPointerDownCapture={onViewportPointerDown}
        onContextMenuCapture={handleViewportContextMenuCapture}
        onWheel={onWheel}
        style={{
          backgroundPosition: `${translateX}px ${translateY}px`,
          ["--viewport-grid-scale" as string]: String(scale),
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
          data-vigil-scene-layer="true"
          className={`${styles.viewportSceneLayer} ${
            !canvasEffectsEnabled ? styles.viewportSceneLayerInstant : ""
          } ${
            viewportRevealReady && !navTransitionActive
              ? styles.viewportSceneLayerVisible
              : styles.viewportSceneLayerDimmed
          }`}
          aria-hidden={!viewportRevealReady || navTransitionActive}
        >
        <div
          ref={canvasTransformRef}
          className={`${styles.canvas}${
            draggedNodeIds.length > 0 ? ` ${styles.canvasDraggingConnections}` : ""
          }`}
          style={{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})` }}
        >
          <div
            ref={canvasEntityLayerRef}
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
                    onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
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
                {entities.map((entity, index) => {
                  const isTopStackLayer = index === entities.length - 1;
                  return (
                  <div
                    key={entity.id}
                    data-node-id={entity.id}
                    data-space-id={activeSpaceId}
                    data-stack-layer="true"
                    className={`${styles.stackLayer} ${isTopStackLayer ? styles.stackLayerTopInteractive : ""}`}
                    style={{
                      "--stack-x": `${index * 6}px`,
                      "--stack-y": `${index * 6}px`,
                      "--stack-r": `${(index - (entities.length - 1) / 2) * 1.6}deg`,
                    } as React.CSSProperties}
                    onMouseDown={
                      isTopStackLayer
                        ? (event) => {
                            if (
                              event.button !== 0 ||
                              activeTool !== "select" ||
                              connectionMode !== "move"
                            )
                              return;
                            const t = event.target as HTMLElement;
                            if (t.closest("[data-expand-btn='true']")) return;
                            event.stopPropagation();
                            recordUndoBeforeMutation();
                            const mouseCanvasX = (event.clientX - translateX) / scale;
                            const mouseCanvasY = (event.clientY - translateY) / scale;
                            const offsets: Record<string, { x: number; y: number }> = {};
                            entities.forEach((e) => {
                              const entitySlot = e.slots[activeSpaceId];
                              if (!entitySlot) return;
                              offsets[e.id] = {
                                x: mouseCanvasX - entitySlot.x,
                                y: mouseCanvasY - entitySlot.y,
                              };
                            });
                            dragOffsetsRef.current = offsets;
                            draggedNodeIdsRef.current = entities.map((e) => e.id);
                            setDraggedNodeIds(entities.map((e) => e.id));
                            setSelectedNodeIds(entities.map((e) => e.id));
                            dragPointerScreenRef.current = { x: event.clientX, y: event.clientY };
                            setMaxZIndex((prev) => prev + 1);
                            stackPointerDragRef.current = {
                              stackId,
                              startX: event.clientX,
                              startY: event.clientY,
                              moved: false,
                            };
                          }
                        : undefined
                    }
                    onClick={
                      isTopStackLayer
                        ? (event) => {
                            if (connectionMode !== "move") return;
                            event.stopPropagation();
                            const t = event.target as HTMLElement;
                            if (t.closest("[data-expand-btn='true']")) return;
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
                            setStackModalEjectCount(0);
                            setHoveredStackTargetId(null);
                            setStackModal({
                              stackId,
                              orderedIds: [...entities].reverse().map((e) => e.id),
                              originX: rect.left + rect.width / 2,
                              originY: rect.top + rect.height / 2,
                              anchorWorld: { x: slot.x, y: slot.y },
                              stackScreenLeft: rect.left,
                              stackScreenTop: rect.top,
                            });
                          }
                        : undefined
                    }
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
                );
                })}
                <div className={styles.stackCountBadge}>{entities.length}</div>
              </div>
            );
          })}
          </div>
          <svg
            ref={connectionLayerSvgRef}
            className={styles.connectionLayer}
            viewBox="0 0 10000 10000"
            aria-hidden
          >
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
            {activeSpaceConnections.map((connection) => {
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
              /** Placeholder only; rope sim writes `d` imperatively (see rAF `step`). */
              const pathD = "M 0 0";
              const isCut = connectionMode === "cut";
              const lt = connection.linkType ?? "pin";
              const dash =
                lt !== "pin" && lt !== "reference" ? ("10 7" as const) : undefined;
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
                            { maxWidth: 260, maxHeight: 520, edgePadding: 8 },
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
                    style={{ stroke: connection.color, strokeDasharray: dash }}
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
                          { maxWidth: 260, maxHeight: 520, edgePadding: 8 },
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
        </div>
        {/*
         * Boot flowers portaled here only — sibling **before** VigilFlowRevealOverlay so the WebGL
         * ambient stack (z ~92) composites above pixel blooms (this host z ~36), not under them.
         */}
        <div ref={setBootFlowerPortalNode} className={styles.bootFlowerPortalHost} aria-hidden />
        {canvasEffectsEnabled ? (
          <VigilFlowRevealOverlay
            scenario={scenario}
            sessionActivated={scenario !== "default" || canvasSessionActivated}
            navActive={navTransitionActive}
            bootstrapPending={scenario === "default" && !canvasBootstrapResolved}
          />
        ) : null}
        {showWorkspaceBlockingOverlay ? <WorkspaceBootstrapErrorPanel /> : null}
        <div
          className={`${styles.chromeLayer}${bootPreActivateGate ? ` ${styles.chromeLayerBootSuppressed}` : ""}`}
        >
        {parentSpaceId ? (
          <ArchitecturalParentExitThreshold
            ref={parentDropRef}
            toolbarBottomPx={0}
            visible={parentExitStripVisible}
            hovered={parentDropHovered}
            interactive={parentExitInteractive}
            onActivate={moveSelectionToParent}
          />
        ) : null}

        {!bootPreActivateGate ? (
          <div
            key={`hg-ce-fx-${chromeEnterEpoch}`}
            className={`${styles.focusEffectsEnterHost}${
              chromeEntranceOn ? ` ${styles.chromeEnterBottomLeft}` : ""
            }`}
          >
            <ArchitecturalCanvasEffectsToggle
              effectsEnabled={canvasEffectsEnabled}
              onEffectsEnabledChange={handleCanvasEffectsEnabledChange}
              trailingSlot={
                !bootLayerVisible ? (
                  <>
                    <div className={styles.focusEffectsDockSep} aria-hidden />
                    <VigilAppChromeAudioMuteButton />
                  </>
                ) : null
              }
            />
          </div>
        ) : null}
        <div
          key={`hg-ce-metrics-${chromeEnterEpoch}`}
          className={`${styles.viewportMetricsEnterHost}${
            chromeEntranceOn ? ` ${styles.chromeEnterBottomRight}` : ""
          }`}
        >
          <ArchitecturalViewportMetrics
            centerWorldX={centerWorldX}
            centerWorldY={centerWorldY}
            scale={scale}
          />
        </div>
        {!focusOpen && !galleryOpen ? (
          <div
            key={`hg-ce-dock-${chromeEnterEpoch}`}
            className={`${styles.bottomDockEnterHost}${
              chromeEntranceOn ? ` ${styles.chromeEnterBottomCenter}` : ""
            }`}
          >
            <ArchitecturalBottomDock
              showFormatToolbar={textFormatChromeActive}
              showDocInsertCluster={richDocInsertChromeActive}
              insertDocActions={dockInsertActions}
              formatActions={dockFormatActions}
              createActions={dockCreateActions}
              createDisabled={dockCreateDisabledBySyncError}
              createDisabledReason={dockCreateSyncDisabledHint}
              activeBlockTag={formatCommandState.blockTag}
              onFormat={runFormat}
              onCreateNode={createNewNode}
              onUndo={undoFromDock}
              onRedo={redoFromDock}
              canUndo={canUndo}
              canRedo={canRedo}
              undoLabel={`Undo (${modKeyHints.undo})`}
              redoLabel={`Redo (${modKeyHints.redo})`}
              folderColorPicker={folderColorPickerForDock}
              selectionDelete={{
                selectedCount: selectedNodeIds.length,
                onDelete: () => deleteEntitySelection([...selectedNodeIdsRef.current]),
              }}
              selectionStack={{
                canMerge: stackSelectionUi.canMergeStacks,
                onMerge: () => stackSelectedContent(selectedNodeIds),
                mergeTitle:
                  stackSelectionUi.whollySelectedStackIds.length >= 2
                    ? `Merge stacks (${modKeyHints.stack})`
                    : `Create stack (${modKeyHints.stack})`,
                canUnstack: stackSelectionUi.canUnstackWhollySelected,
                onUnstack: () => unstackWhollySelectedStacks(selectedNodeIds),
                unstackTitle: "Unstack",
              }}
            />
          </div>
        ) : null}

        <div
          key={`hg-ce-rail-${chromeEnterEpoch}`}
          className={`${styles.toolRailEnterShell}${
            chromeEntranceOn ? ` ${styles.chromeEnterRightRail}` : ""
          }`}
        >
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
              lassoPointerIdRef.current = null;
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
        </div>
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          currentSpaceId={activeSpaceId}
          items={paletteItems}
          spaces={paletteSpaces}
          actions={paletteActions}
          recentItems={recentItems}
          recentFolders={recentFolders}
          onRecordRecentItem={pushRecentItem}
          onSelectItem={(id, openInFocus) => focusEntityFromPalette(id, openInFocus)}
          onSelectSpace={(spaceId) => enterSpace(spaceId)}
          onOpenRecentFolder={openFolder}
          onRunAction={runPaletteAction}
        />
        {!isRestrictedLayer ? (
          <LoreAskPanel
            open={lorePanelOpen}
            onClose={() => setLorePanelOpen(false)}
            spaceId={activeSpaceId}
            spaceScopedAllowed={isUuidLike(activeSpaceId)}
            onOpenSource={(id) => focusEntityFromPalette(id)}
          />
        ) : null}
        {!isRestrictedLayer ? (
          <input
            ref={loreImportFileInputRef}
            type="file"
            accept=".pdf,.md,.txt,.markdown,text/plain,text/markdown,application/pdf"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={onLoreImportFileChange}
          />
        ) : null}
        {loreSmartPlanning ? (
          <div
            className="fixed inset-0 z-[1150] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
            role="status"
            aria-live="polite"
            aria-label="Building import plan"
          >
            <div className="rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-panel)] px-6 py-4 text-sm text-[var(--vigil-label)] shadow-xl">
              <p className="font-medium">Planning import…</p>
              <p className="mt-1 max-w-xs text-[11px] text-[var(--vigil-muted)]">
                Running in the background on the server. You can leave this page open — it usually finishes
                within a minute or two for typical files.
              </p>
            </div>
          </div>
        ) : null}
        {!isRestrictedLayer ? (
          <ArchitecturalLoreReviewPanel
            open={loreReviewPanelOpen}
            onClose={() => setLoreReviewPanelOpen(false)}
            draft={vaultReviewDraftActive}
            onRunAnalysis={() => void runVaultReviewAnalysis()}
            onAppendTags={appendVaultReviewTags}
            loading={loreReviewLoading}
            error={loreReviewError}
            issues={loreReviewIssues}
            suggestedNoteTags={loreReviewSuggestedTags}
            semanticSummary={loreReviewSemanticSummary}
          />
        ) : null}
        {loreSmartReview && !isRestrictedLayer ? (
          <div
            className="fixed inset-0 z-[1150] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="Smart document import"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !loreImportCommitting) {
                setLoreSmartReview(null);
                setLoreSmartAcceptedMergeIds({});
                setLoreSmartClarificationAnswers([]);
                setLoreSmartTab("structure");
              }
            }}
          >
            <div className="flex max-h-[min(90vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-panel)] p-4 shadow-xl">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-[var(--vigil-label)]">
                    Smart import
                  </span>
                  {loreSmartReview.fileName ? (
                    <p className="text-[10px] text-[var(--vigil-muted)]">{loreSmartReview.fileName}</p>
                  ) : null}
                  <p className="text-[10px] text-[var(--vigil-muted)]">
                    {loreSmartReview.plan.folders.length} folders · {loreSmartReview.plan.notes.length}{" "}
                    notes · {loreSmartReview.plan.mergeProposals.length} merge suggestions
                    {loreSmartReview.plan.links.length > 0
                      ? ` · ${loreSmartReview.plan.links.length} same-canvas semantic links`
                      : ""}
                    {loreSmartReview.plan.contradictions.length > 0
                      ? ` · ${loreSmartReview.plan.contradictions.length} flagged for review`
                      : ""}
                    {loreSmartReview.plan.clarifications.length > 0
                      ? ` · ${loreSmartReview.plan.clarifications.length} open question(s)`
                      : ""}
                  </p>
                  <p className="text-[10px] text-[var(--vigil-muted)]">
                    Imported links use relationship types (ally, faction, …), not pin threads. Pin
                    connections are for hand-drawn ropes; add those on the canvas if you need ties
                    across folders.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="neutral"
                    tone="glass"
                    disabled={loreImportCommitting}
                    onClick={() => {
                      setLoreSmartReview(null);
                      setLoreSmartAcceptedMergeIds({});
                      setLoreSmartClarificationAnswers([]);
                      setLoreSmartTab("structure");
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    tone="solid"
                    disabled={loreImportCommitting || !loreSmartClarificationsOk}
                    onClick={() => void commitSmartLoreImport()}
                  >
                    {loreImportCommitting ? "Applying…" : "Apply import"}
                  </Button>
                </div>
              </div>
              <div className="mb-3 flex gap-1 border-b border-[var(--vigil-border)] pb-2">
                <Button
                  size="xs"
                  variant={loreSmartTab === "structure" ? "primary" : "neutral"}
                  tone="glass"
                  type="button"
                  onClick={() => setLoreSmartTab("structure")}
                >
                  Structure
                </Button>
                <Button
                  size="xs"
                  variant={loreSmartTab === "merges" ? "primary" : "neutral"}
                  tone="glass"
                  type="button"
                  onClick={() => setLoreSmartTab("merges")}
                >
                  Merges
                </Button>
                <Button
                  size="xs"
                  variant={loreSmartTab === "questions" ? "primary" : "neutral"}
                  tone="glass"
                  type="button"
                  onClick={() => setLoreSmartTab("questions")}
                >
                  Open questions
                  {loreSmartReview.plan.clarifications.filter((c) => c.severity === "required")
                    .length > 0
                    ? ` (${loreSmartReview.plan.clarifications.filter((c) => c.severity === "required").length} required)`
                    : ""}
                </Button>
              </div>
              {!loreSmartClarificationsOk ? (
                <p className="mb-2 text-[10px] text-amber-700 dark:text-amber-300">
                  Answer all required questions in Open questions before applying.
                </p>
              ) : null}
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <label className="flex items-start gap-2 text-[11px] text-[var(--vigil-label)]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={loreSmartIncludeSource}
                    onChange={(e) => setLoreSmartIncludeSource(e.target.checked)}
                  />
                  <span>Include full source text as a note card</span>
                </label>
                {loreSmartTab === "structure" ? (
                  <div className="space-y-3 text-[11px] text-[var(--vigil-label)]">
                    {loreSmartReview.plan.folders.length > 0 ? (
                      <div>
                        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--vigil-muted)]">
                          Folders
                        </span>
                        <ul className="list-inside list-disc space-y-1 text-[var(--vigil-muted)]">
                          {loreSmartReview.plan.folders.map((f) => (
                            <li key={f.clientId}>
                              <span className="text-[var(--vigil-label)]">{f.title}</span>
                              {f.parentClientId ? (
                                <span className="text-[var(--vigil-muted)]">
                                  {" "}
                                  (under {f.parentClientId})
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div>
                      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--vigil-muted)]">
                        Notes
                      </span>
                      <ul className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
                        {loreSmartReview.plan.notes.map((n) => (
                          <li
                            key={n.clientId}
                            className="rounded-lg border border-[var(--vigil-border)] bg-black/[0.03] p-2 dark:bg-white/[0.04]"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium">{n.title}</span>
                              <span className="text-[10px] uppercase text-[var(--vigil-muted)]">
                                {n.canonicalEntityKind}
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] text-[var(--vigil-muted)]">{n.summary}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {loreSmartReview.plan.contradictions.length > 0 ? (
                      <p className="text-[10px] text-amber-700 dark:text-amber-300">
                        {loreSmartReview.plan.contradictions.length} contradiction(s) were saved to
                        your review queue for later.
                      </p>
                    ) : null}
                    {loreSmartReview.plan.importPlanWarnings &&
                    loreSmartReview.plan.importPlanWarnings.length > 0 ? (
                      <div>
                        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--vigil-muted)]">
                          Link plan adjustments
                        </span>
                        <ul className="list-inside list-disc space-y-1 text-[10px] text-[var(--vigil-muted)]">
                          {loreSmartReview.plan.importPlanWarnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : loreSmartTab === "questions" ? (
                  <div className="space-y-3 text-[11px] text-[var(--vigil-label)]">
                    {loreSmartReview.plan.clarifications.length === 0 ? (
                      <p className="text-[var(--vigil-muted)]">No open questions for this import.</p>
                    ) : (
                      <ul className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
                        {loreSmartReview.plan.clarifications.map((c) => {
                          const ans = loreSmartClarificationAnswers.find(
                            (a) => a.clarificationId === c.id,
                          );
                          const isMulti = c.questionKind === "multi_select";
                          const selectedSet = new Set(
                            ans?.resolution === "answered"
                              ? (ans.selectedOptionIds ?? [])
                              : ans?.resolution === "skipped_default" && ans.skipDefaultOptionId
                                ? [ans.skipDefaultOptionId]
                                : [],
                          );
                          return (
                            <li
                              key={c.id}
                              className="rounded-lg border border-[var(--vigil-border)] bg-black/[0.03] p-3 dark:bg-white/[0.04]"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{c.title}</span>
                                <span className="text-[9px] uppercase text-[var(--vigil-muted)]">
                                  {c.category.replace(/_/g, " ")}
                                </span>
                                {c.severity === "required" ? (
                                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] uppercase text-amber-800 dark:text-amber-200">
                                    Required
                                  </span>
                                ) : (
                                  <span className="text-[9px] uppercase text-[var(--vigil-muted)]">
                                    Optional
                                  </span>
                                )}
                              </div>
                              {c.context ? (
                                <p className="mt-2 text-[10px] leading-relaxed text-[var(--vigil-muted)]">
                                  {c.context}
                                </p>
                              ) : null}
                              <div className="mt-3 space-y-2">
                                {c.options.map((opt) =>
                                  isMulti ? (
                                    <label
                                      key={opt.id}
                                      className="flex cursor-pointer items-start gap-2 text-[11px]"
                                    >
                                      <input
                                        type="checkbox"
                                        className="mt-0.5"
                                        checked={selectedSet.has(opt.id)}
                                        onChange={(e) => {
                                          let base: string[] =
                                            ans?.resolution === "answered"
                                              ? [...(ans.selectedOptionIds ?? [])]
                                              : ans?.resolution === "skipped_default" &&
                                                  ans.skipDefaultOptionId
                                                ? [ans.skipDefaultOptionId]
                                                : [];
                                          if (e.target.checked) {
                                            if (!base.includes(opt.id)) base.push(opt.id);
                                          } else {
                                            base = base.filter((x) => x !== opt.id);
                                          }
                                          setLoreSmartClarificationAnswers((prev) =>
                                            upsertClarificationAnswer(prev, {
                                              clarificationId: c.id,
                                              resolution: "answered",
                                              selectedOptionIds: base,
                                            }),
                                          );
                                        }}
                                      />
                                      <span>{opt.label}</span>
                                    </label>
                                  ) : (
                                    <label
                                      key={opt.id}
                                      className="flex cursor-pointer items-start gap-2 text-[11px]"
                                    >
                                      <input
                                        type="radio"
                                        className="mt-0.5"
                                        name={`clarify-${c.id}`}
                                        checked={
                                          !!(
                                            ans?.resolution === "answered" &&
                                            ans.selectedOptionIds?.[0] === opt.id
                                          ) ||
                                          !!(
                                            ans?.resolution === "skipped_default" &&
                                            ans.skipDefaultOptionId === opt.id
                                          )
                                        }
                                        onChange={() =>
                                          setLoreSmartClarificationAnswers((prev) =>
                                            upsertClarificationAnswer(prev, {
                                              clarificationId: c.id,
                                              resolution: "answered",
                                              selectedOptionIds: [opt.id],
                                            }),
                                          )
                                        }
                                      />
                                      <span>{opt.label}</span>
                                    </label>
                                  ),
                                )}
                              </div>
                              {recommendedClarificationOptionId(c) ? (
                                <div className="mt-2">
                                  <Button
                                    size="xs"
                                    variant="neutral"
                                    tone="glass"
                                    type="button"
                                    onClick={() => {
                                      const def = recommendedClarificationOptionId(c);
                                      if (!def) return;
                                      setLoreSmartClarificationAnswers((prev) =>
                                        upsertClarificationAnswer(prev, {
                                          clarificationId: c.id,
                                          resolution: "skipped_default",
                                          skipDefaultOptionId: def,
                                        }),
                                      );
                                    }}
                                  >
                                    Use recommended default
                                  </Button>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="xs"
                        variant="neutral"
                        tone="glass"
                        type="button"
                        disabled={loreSmartReview.plan.mergeProposals.length === 0}
                        onClick={() => {
                          const next: Record<string, boolean> = {};
                          for (const m of loreSmartReview.plan.mergeProposals) {
                            next[m.id] = true;
                          }
                          setLoreSmartAcceptedMergeIds(next);
                        }}
                      >
                        Select all merges
                      </Button>
                      <Button
                        size="xs"
                        variant="neutral"
                        tone="glass"
                        type="button"
                        disabled={loreSmartReview.plan.mergeProposals.length === 0}
                        onClick={() => {
                          const next: Record<string, boolean> = {};
                          for (const m of loreSmartReview.plan.mergeProposals) {
                            next[m.id] = false;
                          }
                          setLoreSmartAcceptedMergeIds(next);
                        }}
                      >
                        Clear merges
                      </Button>
                    </div>
                    {loreSmartReview.plan.mergeProposals.length === 0 ? (
                      <p className="text-[11px] text-[var(--vigil-muted)]">
                        No merge suggestions — new notes and folders will be created.
                      </p>
                    ) : (
                      <ul className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
                        {loreSmartReview.plan.mergeProposals.map((m) => (
                          <li
                            key={m.id}
                            className="rounded-lg border border-[var(--vigil-border)] bg-black/[0.03] p-2 dark:bg-white/[0.04]"
                          >
                            <label className="flex cursor-pointer gap-2 text-[11px] text-[var(--vigil-label)]">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={!!loreSmartAcceptedMergeIds[m.id]}
                                onChange={() =>
                                  setLoreSmartAcceptedMergeIds((p) => ({
                                    ...p,
                                    [m.id]: !p[m.id],
                                  }))
                                }
                              />
                              <span>
                                Merge into{" "}
                                <span className="font-medium">{m.targetTitle}</span>
                                {m.targetSpaceName ? (
                                  <span className="text-[var(--vigil-muted)]">
                                    {" "}
                                    · {m.targetSpaceName}
                                  </span>
                                ) : null}
                                <span className="block text-[10px] text-[var(--vigil-muted)]">
                                  Strategy: {m.strategy}
                                  {m.targetItemType || m.targetEntityType
                                    ? ` · existing type ${m.targetItemType ?? "note"} / ${m.targetEntityType ?? "—"}`
                                    : ""}
                                </span>
                              </span>
                            </label>
                            <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded border border-[var(--vigil-border)] bg-[var(--vigil-surface)] p-2 text-[10px] text-[var(--vigil-muted)]">
                              {m.proposedText}
                            </pre>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
        <ArchitecturalLinksPanel
          graph={graph}
          activeSpaceId={activeSpaceId}
          selectedEntityIds={selectedNodeIds}
          cloudEnabled={cloudLinksBar}
          onFocusEntity={(id) => focusEntityFromPalette(id)}
        />
        {!isRestrictedLayer ? (
          <LinkGraphOverlay
            open={graphOverlayOpen}
            spaceId={cloudLinksBar && isUuidLike(activeSpaceId) ? activeSpaceId : null}
            onClose={() => setGraphOverlayOpen(false)}
            onSelectItem={(id) => focusEntityFromPalette(id)}
          />
        ) : null}
        {loreImportDraft && !loreSmartReview && !isRestrictedLayer ? (
          <div
            className="fixed inset-0 z-[1150] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="Lore import review"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !loreImportCommitting) setLoreImportDraft(null);
            }}
          >
            <datalist id="hg-lore-import-kinds">
              {(
                ["npc", "location", "faction", "quest", "item", "lore", "other"] as const
              ).map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
            <datalist id="hg-lore-import-linktypes">
              {LORE_LINK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} label={o.label} />
              ))}
            </datalist>
            <div className="flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-panel)] p-4 shadow-xl">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-[var(--vigil-label)]">Lore import</span>
                  {loreImportDraft.fileName ? (
                    <p className="text-[10px] text-[var(--vigil-muted)]">{loreImportDraft.fileName}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="neutral"
                    tone="glass"
                    disabled={loreImportCommitting}
                    onClick={() => setLoreImportDraft(null)}
                  >
                    Close
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    tone="solid"
                    disabled={loreImportCommitting}
                    onClick={() => void commitLoreImport()}
                  >
                    {loreImportCommitting ? "Saving…" : "Add to canvas"}
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {loreImportDraft.entities.length === 0 && loreImportDraft.suggestedLinks.length === 0 ? (
                  <p className="text-[11px] text-[var(--vigil-muted)]">
                    No AI-extracted entities yet (missing API key or empty result). Add entity rows below, or
                    include the source text as a note card.
                  </p>
                ) : null}
                <label className="flex items-start gap-2 text-[11px] text-[var(--vigil-label)]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={loreImportDraft.includeSourceCard}
                    onChange={(e) =>
                      setLoreImportDraft((p) => (p ? { ...p, includeSourceCard: e.target.checked } : p))
                    }
                  />
                  <span>Include full source text as a note card (recommended for traceability)</span>
                </label>
                <div>
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--vigil-muted)]">
                    Source text
                  </span>
                  <textarea
                    className="h-28 w-full resize-y rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-surface)] px-2 py-1.5 text-[11px] text-[var(--vigil-label)]"
                    value={loreImportDraft.sourceText}
                    onChange={(e) =>
                      setLoreImportDraft((p) => (p ? { ...p, sourceText: e.target.value } : p))
                    }
                    spellCheck={false}
                  />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--vigil-muted)]">
                      Entities (manual edit)
                    </span>
                    <Button
                      size="xs"
                      variant="neutral"
                      tone="glass"
                      type="button"
                      onClick={() =>
                        setLoreImportDraft((p) =>
                          p
                            ? {
                                ...p,
                                entities: [...p.entities, { name: "", kind: "lore", summary: "" }],
                              }
                            : p,
                        )
                      }
                    >
                      Add entity
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {loreImportDraft.entities.length === 0 ? (
                      <p className="text-[10px] text-[var(--vigil-muted)]">No entities — use Add entity.</p>
                    ) : null}
                    {loreImportDraft.entities.map((ent, i) => (
                      <div
                        key={i}
                        className="grid gap-2 rounded-lg border border-[var(--vigil-border)] bg-black/[0.03] p-2 dark:bg-white/[0.04] sm:grid-cols-[1fr_100px_1fr_auto]"
                      >
                        <input
                          className="rounded border border-[var(--vigil-border)] bg-[var(--vigil-surface)] px-2 py-1 text-[11px] text-[var(--vigil-label)]"
                          placeholder="Name"
                          value={ent.name}
                          onChange={(e) =>
                            setLoreImportDraft((p) => {
                              if (!p) return p;
                              const next = [...p.entities];
                              next[i] = { ...next[i]!, name: e.target.value };
                              return { ...p, entities: next };
                            })
                          }
                        />
                        <input
                          className="rounded border border-[var(--vigil-border)] bg-[var(--vigil-surface)] px-2 py-1 text-[11px] text-[var(--vigil-label)]"
                          placeholder="Kind"
                          list="hg-lore-import-kinds"
                          value={ent.kind}
                          onChange={(e) =>
                            setLoreImportDraft((p) => {
                              if (!p) return p;
                              const next = [...p.entities];
                              next[i] = { ...next[i]!, kind: e.target.value };
                              return { ...p, entities: next };
                            })
                          }
                        />
                        <input
                          className="rounded border border-[var(--vigil-border)] bg-[var(--vigil-surface)] px-2 py-1 text-[11px] text-[var(--vigil-label)] sm:col-span-1"
                          placeholder="Summary"
                          value={ent.summary}
                          onChange={(e) =>
                            setLoreImportDraft((p) => {
                              if (!p) return p;
                              const next = [...p.entities];
                              next[i] = { ...next[i]!, summary: e.target.value };
                              return { ...p, entities: next };
                            })
                          }
                        />
                        <Button
                          size="xs"
                          variant="ghost"
                          tone="glass"
                          type="button"
                          className="justify-self-end"
                          onClick={() =>
                            setLoreImportDraft((p) => {
                              if (!p) return p;
                              const next = p.entities.filter((_, j) => j !== i);
                              const names = new Set(
                                next.map((e) => e.name.trim().toLowerCase()).filter(Boolean),
                              );
                              const links = p.suggestedLinks.filter(
                                (l) =>
                                  names.has(l.fromName.trim().toLowerCase()) &&
                                  names.has(l.toName.trim().toLowerCase()),
                              );
                              return { ...p, entities: next, suggestedLinks: links };
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--vigil-muted)]">
                      Suggested links
                    </span>
                    <Button
                      size="xs"
                      variant="neutral"
                      tone="glass"
                      type="button"
                      onClick={() =>
                        setLoreImportDraft((p) =>
                          p
                            ? {
                                ...p,
                                suggestedLinks: [
                                  ...p.suggestedLinks,
                                  { fromName: "", toName: "", linkType: "reference" },
                                ],
                              }
                            : p,
                        )
                      }
                    >
                      Add link
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {loreImportDraft.suggestedLinks.length === 0 ? (
                      <p className="text-[10px] text-[var(--vigil-muted)]">No links.</p>
                    ) : null}
                    {loreImportDraft.suggestedLinks.map((link, i) => (
                      <div
                        key={i}
                        className="grid gap-2 rounded-lg border border-[var(--vigil-border)] bg-black/[0.03] p-2 dark:bg-white/[0.04] sm:grid-cols-[1fr_1fr_120px_auto]"
                      >
                        <input
                          className="rounded border border-[var(--vigil-border)] bg-[var(--vigil-surface)] px-2 py-1 text-[11px] text-[var(--vigil-label)]"
                          placeholder="From (entity name)"
                          value={link.fromName}
                          onChange={(e) =>
                            setLoreImportDraft((p) => {
                              if (!p) return p;
                              const next = [...p.suggestedLinks];
                              next[i] = { ...next[i]!, fromName: e.target.value };
                              return { ...p, suggestedLinks: next };
                            })
                          }
                        />
                        <input
                          className="rounded border border-[var(--vigil-border)] bg-[var(--vigil-surface)] px-2 py-1 text-[11px] text-[var(--vigil-label)]"
                          placeholder="To (entity name)"
                          value={link.toName}
                          onChange={(e) =>
                            setLoreImportDraft((p) => {
                              if (!p) return p;
                              const next = [...p.suggestedLinks];
                              next[i] = { ...next[i]!, toName: e.target.value };
                              return { ...p, suggestedLinks: next };
                            })
                          }
                        />
                        <input
                          className="rounded border border-[var(--vigil-border)] bg-[var(--vigil-surface)] px-2 py-1 text-[11px] text-[var(--vigil-label)]"
                          placeholder="Type"
                          list="hg-lore-import-linktypes"
                          value={link.linkType ?? ""}
                          onChange={(e) =>
                            setLoreImportDraft((p) => {
                              if (!p) return p;
                              const next = [...p.suggestedLinks];
                              next[i] = { ...next[i]!, linkType: e.target.value };
                              return { ...p, suggestedLinks: next };
                            })
                          }
                        />
                        <Button
                          size="xs"
                          variant="ghost"
                          tone="glass"
                          type="button"
                          className="justify-self-end"
                          onClick={() =>
                            setLoreImportDraft((p) => {
                              if (!p) return p;
                              return {
                                ...p,
                                suggestedLinks: p.suggestedLinks.filter((_, j) => j !== i),
                              };
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-[var(--vigil-muted)]">
                Cards are placed near the viewport center. Requires Neon (not local demo). Link rows must match
                entity names (case-insensitive).
              </p>
            </div>
          </div>
        ) : null}
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
          className={`${styles.stackFanStage}${stackDrag ? ` ${styles.stackFanStageDragging}` : ""}`}
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
            const visLast = stackModalVisibleEntities.length - 1;
            /* orderedIds is front-first; rank 0 = back of fan, visLast = foremost card. */
            const rank = visLast - index;
            const collapsedX = fanOriginX + rank * 6;
            const collapsedY = fanOriginY + rank * 6;
            const baseX = stackModalExpanded ? slot.x : collapsedX;
            const baseY = stackModalExpanded ? slot.y : collapsedY;
            const dragX = drag ? drag.currentX - drag.pointerOffsetX : baseX;
            const dragY = drag ? drag.currentY - drag.pointerOffsetY : baseY;
            const rotation = stackModalExpanded
              ? ((rank % 2 === 0 ? -1 : 1) * 0.8)
              : (rank - (stackModalEntities.length - 1) / 2) * 1.6;
            return (
              <div
                key={entity.id}
                data-node-id={entity.id}
                data-space-id={activeSpaceId}
                className={`${styles.stackFanCard} ${drag ? styles.stackFanDragging : ""} ${drag && stackModalEjectPreview ? styles.stackFanEjectArmed : ""}`}
                style={{
                  zIndex: 900 + rank,
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
                  stackModalDragStartOrderedIdsRef.current = stackModal.orderedIds.slice();
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
                    onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
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
                  // eslint-disable-next-line @next/next/no-img-element -- dynamic user/R2 URLs; not suitable for next/image without broad remotePatterns
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
          focusCodeTheme ? styles.focusEditorDark : ""
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
            onUndo={undoFromDock}
            onRedo={redoFromDock}
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
      <div
        className={`${styles.chromeLayer}${
          bootPreActivateGate ? ` ${styles.chromeLayerTopLeftBootElevated}` : ""
        }`}
      >
        <div ref={shellTopLeftStackRef} className={styles.shellTopLeftStack}>
          <div
            key={`hg-ce-tl-${chromeEnterEpoch}`}
            className={`${styles.shellTopCluster}${
              chromeEntranceOn ? ` ${styles.chromeEnterTopLeft}` : ""
            }`}
          >
            <div className={styles.shellTopClusterRow} data-hg-chrome="top-left-cluster">
              <ArchitecturalStatusBar
                syncBootstrapPending={scenario === "default" && !canvasBootstrapResolved}
                syncShowingCachedWorkspace={
                  scenario === "default" &&
                  workspaceViewFromCache &&
                  canvasBootstrapResolved &&
                  !bootLayerVisible
                }
                syncOfflineNoSnapshot={
                  scenario === "default" && showWorkspaceBlockingOverlay
                }
                collabPeerCount={presencePeerCount}
                onExportGraphJson={exportGraphJson}
                exportGraphPaletteHint={`${modKeyHints.search} → Export graph JSON`}
              />
              {showLogOutToAuth ? (
                <div className={styles.shellTopLogOutWrap} data-hg-chrome="log-out">
                  <div
                    className={`${styles.glassPanel} ${styles.shellTopChromePanel} ${styles.shellTopLogOutPanel}`}
                  >
                    <ArchitecturalTooltip
                      content="Log out — return to auth splash"
                      side="bottom"
                      delayMs={320}
                    >
                      <ArchitecturalButton
                        type="button"
                        size="icon"
                        tone="glass"
                        iconOnly
                        leadingIcon={<SignOut size={18} weight="bold" aria-hidden />}
                        className={styles.shellTopLogOutTrigger}
                        aria-label="Log out and return to auth splash"
                        onClick={handleLogOutToAuth}
                      />
                    </ArchitecturalTooltip>
                  </div>
                </div>
              ) : null}
              <div className={styles.navChrome} data-hg-chrome="nav-breadcrumb">
                <div className={`${styles.glassPanel} ${styles.navPanel} ${styles.shellTopChromePanel}`}>
                  <div className={styles.navRow}>
                    {parentSpaceId ? (
                      <ArchitecturalButton
                        type="button"
                        size="menu"
                        tone="focus-light"
                        className={styles.navBackBtn}
                        leadingIcon={<ArrowLeft size={14} weight="bold" aria-hidden />}
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
                            ? ROOT_SPACE_DISPLAY_NAME
                            : graph.spaces[spaceId]?.name ?? "Unknown";
                        const crumbTip = isActive
                          ? `${label} — current space`
                          : `Open “${label}” in the canvas`;
                        return (
                          <span key={spaceId} className={styles.crumbItem}>
                            {index > 0 ? <span className={styles.crumbSep}>/</span> : null}
                            <ArchitecturalTooltip content={crumbTip} side="bottom" delayMs={320}>
                              <Button
                                type="button"
                                variant="ghost"
                                tone="glass"
                                size="sm"
                                className={`${styles.crumbBtn} ${isActive ? styles.crumbActive : ""}`}
                                onClick={() => enterSpace(spaceId)}
                                disabled={isActive}
                              >
                                {label}
                              </Button>
                            </ArchitecturalTooltip>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.topRightChromeCluster} data-hg-chrome="top-right-tools">
          <div
            key={`hg-ce-tr-cluster-${chromeEnterEpoch}`}
            className={`${styles.topRightChromeClusterInner}${
              chromeEntranceOn ? ` ${styles.chromeEnterTopRight}` : ""
            }`}
          >
            {vaultReviewChromeVisible ? (
              <div
                className={`${styles.glassPanel} ${styles.shellTopChromePanel} ${styles.shellTopLogOutPanel}`}
                data-hg-chrome="vault-review"
              >
                <ArchitecturalTooltip
                  content="Vault review — consistency check & semantic tags (no layout changes)"
                  side="bottom"
                  delayMs={320}
                >
                  <ArchitecturalButton
                    type="button"
                    size="icon"
                    tone="glass"
                    iconOnly
                    leadingIcon={<SealCheck size={18} weight="bold" aria-hidden />}
                    className={styles.shellTopLogOutTrigger}
                    aria-label="Open vault review"
                    onClick={() => {
                      setLoreReviewError(null);
                      setLoreReviewPanelOpen(true);
                      playVigilUiSound("select");
                    }}
                  />
                </ArchitecturalTooltip>
              </div>
            ) : null}
            {!bootPreActivateGate ? (
              <div className={styles.topRightConnectionTools}>
                {!isRestrictedLayer ? (
                  <div
                    key={`hg-ce-import-${chromeEnterEpoch}`}
                    className={`${styles.glassPanel} ${styles.shellTopChromePanel} ${styles.shellTopLogOutPanel}`}
                    data-hg-chrome="import-document"
                  >
                    <ArchitecturalTooltip content="Import PDF or Markdown" side="bottom" delayMs={320}>
                      <ArchitecturalButton
                        type="button"
                        size="icon"
                        tone="glass"
                        iconOnly
                        className={styles.shellTopLogOutTrigger}
                        aria-label="Import document"
                        onClick={() => {
                          playVigilUiSound("select");
                          loreImportFileInputRef.current?.click();
                        }}
                      >
                        <UploadSimple size={18} weight="bold" aria-hidden />
                      </ArchitecturalButton>
                    </ArchitecturalTooltip>
                  </div>
                ) : null}
                <div
                  key={`hg-ce-search-${chromeEnterEpoch}`}
                  className={`${styles.glassPanel} ${styles.shellTopChromePanel} ${styles.shellTopLogOutPanel}`}
                  data-hg-chrome="search"
                >
                  <ArchitecturalTooltip
                    content={`Search (${modKeyHints.search})`}
                    side="bottom"
                    delayMs={320}
                  >
                    <ArchitecturalButton
                      type="button"
                      size="icon"
                      tone="glass"
                      iconOnly
                      className={styles.shellTopLogOutTrigger}
                      aria-label="Search"
                      onClick={() => setPaletteOpen(true)}
                    >
                      <MagnifyingGlass size={18} weight="bold" aria-hidden />
                    </ArchitecturalButton>
                  </ArchitecturalTooltip>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
