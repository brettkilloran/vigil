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
import dynamic from "next/dynamic";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  ArrowsOut,
  BoundingBox,
  CopySimple,
  DownloadSimple,
  FileText,
  Folder,
  Graph,
  ImageSquare,
  MapPin,
  Lightning,
  MagnifyingGlass,
  NotePencil,
  Scan,
  SealCheck,
  SignOut,
  Sparkle,
  SquaresFour,
  Stack,
  Trash,
  UploadSimple,
  User,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";

import {
  ArchitecturalLoreReviewPanel,
  type VaultReviewDraft,
  type VaultReviewIssue,
} from "@/src/components/foundation/ArchitecturalLoreReviewPanel";
import { ArchitecturalLoreImportErrorDialog } from "@/src/components/foundation/ArchitecturalLoreImportErrorDialog";
import {
  ArchitecturalLoreImportUploadPopover,
  type LoreImportScopeMode,
  type LoreImportUploadMode,
} from "@/src/components/foundation/ArchitecturalLoreImportUploadPopover";
import { VigilAppBootScreen } from "./VigilAppBootScreen";
import { VigilAppChromeAudioMuteButton } from "./VigilAppChromeAudioMuteButton";
import styles from "./ArchitecturalCanvasApp.module.css";
import type { WikiLinkAssistConfig } from "@/src/components/editing/BufferedContentEditable";
import { BufferedTextInput } from "@/src/components/editing/BufferedTextInput";
import { HeartgardenDocEditor } from "@/src/components/editing/HeartgardenDocEditor";
import { LoreHybridFocusEditor } from "@/src/components/editing/LoreHybridFocusEditor";
import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";
import {
  ArchitecturalTooltip,
  ARCH_TOOLTIP_AVOID_TOP,
} from "@/src/components/foundation/ArchitecturalTooltip";
import { Button } from "@/src/components/ui/Button";
import { HeartgardenMediaPlaceholderImg } from "@/src/components/ui/HeartgardenMediaPlaceholderImg";
import {
  ArchitecturalBottomDock,
  ArchitecturalConnectionKindPicker,
  DEFAULT_CREATE_ACTIONS,
  DEFAULT_DOC_INSERT_ACTIONS,
  DEFAULT_FORMAT_ACTIONS,
  loreVariantChoiceLabel,
  type ConnectionDockMode,
} from "@/src/components/foundation/ArchitecturalBottomDock";
import { ArchitecturalParentExitThreshold } from "@/src/components/foundation/ArchitecturalParentExitThreshold";
import { ArchitecturalFocusCloseButton } from "@/src/components/foundation/ArchitecturalFocusCloseButton";
import {
  ArchitecturalFolderCard,
  FOLDER_CONTENT_PREVIEW_MAX_LINES,
} from "@/src/components/foundation/ArchitecturalFolderCard";
import { ArchitecturalLoreCharacterCanvasNode } from "@/src/components/foundation/ArchitecturalLoreCharacterCanvasNode";
import { ArchitecturalLoreFactionArchiveCanvasNode } from "@/src/components/foundation/ArchitecturalLoreFactionArchiveCanvasNode";
import { ArchitecturalLoreLocationCanvasNode } from "@/src/components/foundation/ArchitecturalLoreLocationCanvasNode";
import { ArchitecturalNodeCard } from "@/src/components/foundation/ArchitecturalNodeCard";
import { CanvasMinimap } from "@/src/components/foundation/CanvasMinimap";
import { CanvasViewportToast } from "@/src/components/foundation/CanvasViewportToast";
import {
  ArchitecturalCanvasEffectsToggle,
  ArchitecturalStatusBar,
  ArchitecturalViewportMetrics,
  type CollabPeerPresenceChip,
} from "@/src/components/foundation/ArchitecturalStatusBar";
import { ArchitecturalRemotePresenceCursors } from "@/src/components/foundation/ArchitecturalRemotePresenceLayer";
import { ArchitecturalToolRail } from "@/src/components/foundation/ArchitecturalToolRail";
import {
  applyImageDataUrlToArchitecturalMediaBody,
  bodyUsesLorePortraitMediaSlot,
  buildEmptyArchitecturalMediaBodyHtml,
  lorePortraitSlotUsesV9,
  getArchitecturalMediaNotes,
  mediaUploadActionLabel,
  parseArchitecturalMediaFromBody,
  setArchitecturalMediaNotes,
} from "@/src/components/foundation/architectural-media-html";
import { heartgardenMediaPlaceholderClassList } from "@/src/lib/heartgarden-media-placeholder-classes";
import loreEntityCardStyles from "@/src/components/foundation/lore-entity-card.module.css";
import { type FolderColorSchemeId } from "@/src/components/foundation/architectural-folder-schemes";
import {
  CONNECTION_KINDS_IN_ORDER,
  canonicalKindForConnection,
  canonicalPairForKind,
  colorForConnectionKind,
  isCanonicalConnectionPair,
  linkTypeForConnectionKind,
  snapColorToConnectionKind,
  type ConnectionKind,
} from "@/src/lib/connection-kind-colors";
import {
  type BootstrapResponse,
  buildCanvasGraphFromBootstrap,
  buildContentJsonForContentEntity,
  buildContentJsonForFolderEntity,
  canvasItemToEntity,
  contentPlainTextForEntity,
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
  fetchBootstrapDetailed,
  neonVaultIndexSetPlayerLayerActive,
  postPresencePayload,
  type BootstrapFetchDetail,
  type SpacePresencePeer,
} from "@/src/components/foundation/architectural-neon-api";
import {
  applyFolderPopOutPlan,
  collectFolderPopOutPlan,
} from "@/src/components/foundation/architectural-folder-popout";
import { mergeHydratedDbConnections } from "@/src/lib/architectural-item-link-graph";
import type { GraphEdge } from "@/src/lib/graph-types";
import {
  clampLinkMetaSlackMultiplier,
  DEFAULT_LINK_SLACK_MULTIPLIER,
} from "@/src/lib/item-link-meta";
import {
  groupedOrderedLinkOptionsForEndpoints,
  LINK_TYPE_GROUP_HEADINGS,
} from "@/src/lib/lore-link-types";
import type {
  ClarificationAnswer,
  LoreImportClarificationItem,
  LoreImportPlan,
  LoreImportUserContext,
} from "@/src/lib/lore-import-plan-types";
import {
  collapseToOneNote,
  filterAutoResolvedClarifications,
  flipOrgMode,
} from "@/src/lib/lore-import-plan-reshuffle";
import {
  getNeonSyncSnapshot,
  getNeonSyncServerSnapshot,
  neonSyncBumpPending,
  neonSyncReportAuxiliaryFailure,
  neonSyncSetCloudEnabled,
  neonSyncSpaceChangeSyncBreadcrumb,
  neonSyncUnbumpPending,
  subscribeNeonSync,
} from "@/src/lib/neon-sync-bus";
import { parseJsonBody, syncFailureFromApiResponse } from "@/src/lib/sync-error-diagnostic";
import {
  formatLoreImportFailureReport,
  parseLoreImportJsonBody,
  type LoreImportFailureDetail,
  type LoreImportStage,
} from "@/src/lib/lore-import-diagnostic";
import { playVigilUiSound } from "@/src/lib/vigil-ui-sounds";
import { pointerEventTargetElement } from "@/src/components/foundation/pointer-event-target";
import {
  cloneArchitecturalGraph,
  MAX_ARCHITECTURAL_UNDO,
  type ArchitecturalUndoSnapshot,
} from "@/src/components/foundation/architectural-undo";
import { useModKeyHints } from "@/src/lib/mod-keys";
import {
  VIGIL_CANVAS_EFFECTS_STORAGE_KEY,
  VIGIL_MINIMAP_VISIBLE_STORAGE_KEY,
  readCanvasMinimapVisibleFromStorage,
  writeCanvasMinimapVisibleToStorage,
} from "@/src/lib/vigil-canvas-prefs";
import { writeSpaceCamera } from "@/src/lib/heartgarden-space-camera";
import {
  buildCollapsedStacksList,
  computeSpaceContentBounds,
  fitCameraToActiveSpaceContent,
  fitCameraToSelection,
  isContentMostlyOffScreen,
  minimapLayoutSignature,
  minimapPlacementMapsEqual,
  viewportWorldRect,
  type CollapsedStackInfo,
} from "@/src/lib/canvas-view-bounds";
import {
  buildCullExceptionEntityIds,
  collapsedStackIntersectsWorldRect,
  connectionIntersectsWorldRect,
  entityIntersectsWorldRect,
  worldRectFromViewport,
} from "@/src/lib/canvas-viewport-cull";
import {
  HEARTGARDEN_GRAPH_REFRESH_DEBOUNCE_MS,
  HEARTGARDEN_GRAPH_REFRESH_FALLBACK_INTERVAL_MS,
  HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MAX,
  HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MIN,
  HEARTGARDEN_PRESENCE_POINTER_FLUSH_MIN_MS,
} from "@/src/lib/heartgarden-collab-constants";
import {
  presenceFallbackAliasForClientId,
  presenceEmojiForClientId,
  presenceInitialsFromName,
  presenceNameForClient,
  presenceSigilLabel,
  sanitizePresenceDisplayName,
} from "@/src/lib/collab-presence-identity";
import { getOrCreatePresenceClientId } from "@/src/lib/heartgarden-presence-client";
import {
  maybePromptPresenceDisplayNameOnce,
  readPresenceProfile,
} from "@/src/lib/heartgarden-presence-profile";
import { useHeartgardenPresenceHeartbeat } from "@/src/hooks/use-heartgarden-presence-heartbeat";
import { useHeartgardenRealtimeSpaceSync } from "@/src/hooks/use-heartgarden-realtime-space-sync";
import { useHeartgardenSpaceChangeSync } from "@/src/hooks/use-heartgarden-space-change-sync";
import {
  clearWorkspaceViewCache,
  readWorkspaceViewCache,
  writeWorkspaceViewCache,
  type WorkspaceBootTierTag,
} from "@/src/lib/workspace-view-cache";
import type { CameraState, CanvasItem } from "@/src/model/canvas-types";
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
import { GraphPanel } from "@/src/components/product-ui/canvas/GraphPanel";
import { AltGraphCard } from "@/src/components/product-ui/canvas/AltGraphCard";
import {
  type CanvasBodyCommitPayload,
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
  type LoreCard,
  type LoreCardKind,
  type LoreCardVariant,
  type NodeTheme,
  type TapeVariant,
  ROOT_SPACE_DISPLAY_NAME,
} from "@/src/components/foundation/architectural-types";
import type { JSONContent } from "@tiptap/core";
import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import { contentEntityUsesHgDoc } from "@/src/lib/hg-doc/entity-uses-hg-doc";
import { findHgDocSurfaceKeyFromSelection, getHgDocEditor } from "@/src/lib/hg-doc/editor-registry";
import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import {
  contentEntityHasHgAiPending,
  hgDocJsonHasHgAiPending,
  htmlStringHasHgAiPending,
  stripHgAiPendingFromHgDocJson,
  stripHgAiPendingFromHtml,
} from "@/src/lib/hg-doc/strip-hg-ai-pending";
import {
  AI_REVIEW_CLEARED,
  hasActionableAiReview,
  isAiReviewPending,
} from "@/src/lib/entity-meta-schema";
import {
  htmlFragmentToHgDocDoc,
  legacyCodeBodyHtmlToHgDocSeed,
  stripLegacyHtmlToPlainText,
} from "@/src/lib/hg-doc/html-to-doc";
import { newDefaultHgDocSeed, newTaskHgDocSeed } from "@/src/lib/hg-doc/new-node-seeds";
import { hgDocForContentEntity } from "@/src/lib/hg-doc/code-theme-doc";
import { hgDocToPlainText } from "@/src/lib/hg-doc/serialize";
import {
  isUuidLike,
  resolveFactionRosterEntryIdFromDrawTarget,
  runSemanticThreadLinkEvaluation,
} from "@/src/lib/canvas-thread-link-eval";
import { createDefaultFactionRosterSeed } from "@/src/lib/faction-roster-link";
import type { FactionRosterEntry } from "@/src/lib/faction-roster-schema";
import {
  defaultLoreCardVariantForKind,
  defaultTitleForLoreKind,
  getLoreNodeSeedBodyHtml,
  shouldRenderLoreCharacterCredentialCanvasNode,
  shouldRenderLoreFactionArchive091CanvasNode,
  shouldRenderLoreLocationCanvasNode,
  tapeVariantForLoreCard,
} from "@/src/lib/lore-node-seed-html";
import {
  characterV11BodyToFocusDocumentHtml,
  focusDocumentHtmlToCharacterV11Body,
  normalizeCharacterV11BodyHtmlForCurrentBuild,
  withCharacterV11ObjectIdInHeader,
} from "@/src/lib/lore-character-focus-document-html";
import {
  focusDocumentHtmlToLocationBody,
  locationBodyToFocusDocumentHtml,
  plainPlaceNameFromLocationBodyHtml,
} from "@/src/lib/lore-location-focus-document-html";
import {
  factionBodyToFocusDocumentHtml,
  focusDocumentHtmlToFactionBody,
} from "@/src/lib/lore-faction-focus-document-html";
import {
  bodyHtmlImpliesFactionArchive091,
  plainFactionPrimaryNameFromArchiveBodyHtml,
  withFactionArchiveObjectIdInRails,
} from "@/src/lib/lore-faction-archive-html";
import {
  caretIsWithinRichDocInsertRegion,
  resolveActiveRichEditorSurface,
  resolveProseCommandTarget,
} from "@/src/lib/rich-editor-surface";
import { readWordUnderPointer } from "@/src/lib/word-under-pointer";
import { BoundedMap } from "@/src/lib/bounded-map";
import type {
  AltMentionRow,
  AltSearchRow,
} from "@/src/lib/entity-mention-row-types";
import { useChunkLoadRecovery } from "@/src/lib/chunk-load-recovery";
const VigilFlowRevealOverlay = dynamic(
  () =>
    import("@/src/components/transition-experiment/VigilFlowRevealOverlay").then((mod) => ({
      default: mod.VigilFlowRevealOverlay,
    })),
  { ssr: false, loading: () => null },
);

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_BUTTON_STEP = 0.2;
/**
 * Cap on entries in the alt-hover mention/search caches. Entries are evicted
 * least-recently-touched first so a long hover-heavy session can't grow the map
 * without bound. (REVIEW_2026-04-25_1835.md M8.)
 */
const ALT_HOVER_CACHE_MAX = 256;
/** Subpixel / border rounding when comparing `scrollHeight` vs `clientHeight`. */
const SCROLLPORT_OVERFLOW_EPSILON_PX = 1;
/** Trackpad pinch (ctrl/meta + wheel): tuned to feel close to Figma on laptop trackpads. */
const WHEEL_ZOOM_SENSITIVITY = 0.00235;

/** deltaMode → pixels (Figma-style canvas: stable pan on macOS trackpads / WebKit line mode). */
function normalizeWheelPanAxis(delta: number, deltaMode: number, axis: "x" | "y"): number {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    if (typeof window === "undefined") return delta;
    return delta * (axis === "x" ? window.innerWidth : window.innerHeight);
  }
  return delta;
}

/** deltaY + deltaMode → pixels for pinch-zoom (ctrl/meta + wheel on Mac trackpad). */
function normalizeWheelZoomDeltaY(deltaY: number, deltaMode: number): number {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) return deltaY * 16;
  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    if (typeof window === "undefined") return deltaY;
    return deltaY * window.innerHeight;
  }
  return deltaY;
}

function canScrollableBodyConsumeWheel(body: HTMLElement | null, event: WheelEvent): boolean {
  if (!body) return false;
  if (body.scrollHeight <= body.clientHeight + SCROLLPORT_OVERFLOW_EPSILON_PX) return false;
  const goingDown = event.deltaY > 0;
  const goingUp = event.deltaY < 0;
  if (!goingDown && !goingUp) return false;
  const maxScrollTop = body.scrollHeight - body.clientHeight;
  const atTop = body.scrollTop <= 0;
  const atBottom = body.scrollTop >= maxScrollTop - SCROLLPORT_OVERFLOW_EPSILON_PX;
  return (goingDown && !atBottom) || (goingUp && !atTop);
}

/**
 * `WheelEvent.target` may be a text node or non-HTMLElement (`SVG*`); walk to an `HTMLElement` for
 * geometry / `getComputedStyle` / DOM walks.
 */
function wheelEventOriginHTMLElement(event: WheelEvent): HTMLElement | null {
  let n: Node | null = event.target as Node | null;
  if (!n) return null;
  if (n.nodeType === Node.TEXT_NODE || n.nodeType === Node.CDATA_SECTION_NODE) n = n.parentElement;
  let el: Element | null = n instanceof Element ? n : null;
  while (el && !(el instanceof HTMLElement)) el = el.parentElement;
  return el;
}

/**
 * Closest strict ancestor inside the canvas viewport that is a real vertical scrollport (`overflow-y`
 * scrollable and content taller than the box). Never returns `viewportRoot` itself so future `overflow`
 * on `.viewport` cannot steal wheel from the custom pan/zoom handler. `data-node-body-editor` often sits
 * *inside* the scroll element (e.g. ORDO notes cell), so routing cannot rely on that attribute alone.
 */
function nearestVerticalScrollportInViewport(
  target: HTMLElement,
  viewportRoot: HTMLElement,
): HTMLElement | null {
  let el: HTMLElement | null = target;
  while (el && el !== viewportRoot && viewportRoot.contains(el)) {
    const oy = window.getComputedStyle(el).overflowY;
    if (
      (oy === "auto" || oy === "scroll" || oy === "overlay") &&
      el.scrollHeight > el.clientHeight + SCROLLPORT_OVERFLOW_EPSILON_PX
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

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

type ArchitecturalCanvasScenario = "default" | "corrupt";

type LoreSmartImportReviewState = {
  plan: LoreImportPlan;
  sourceText: string;
  sourceTitle?: string;
  fileName?: string;
};

type LoreImportSelectionState = {
  mode: LoreImportUploadMode;
  scope: LoreImportScopeMode;
  contextText: string;
};

type LoreImportPreparedSource = {
  text: string;
  fileName: string;
  suggestedTitle: string;
};

function inferDocSourceKind(fileName: string): LoreImportUserContext["docSourceKind"] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  return "text";
}

function mapSelectionToUserContext(
  selection: LoreImportSelectionState,
  fileName: string,
): LoreImportUserContext {
  if (selection.mode === "one_note") {
    return {
      granularity: "one_note",
      orgMode: "nearby",
      importScope: selection.scope,
      freeformContext: "",
      docSourceKind: inferDocSourceKind(fileName),
    };
  }
  if (selection.mode === "many_folders") {
    return {
      granularity: "many",
      orgMode: "folders",
      importScope: selection.scope,
      freeformContext: selection.contextText.trim(),
      docSourceKind: inferDocSourceKind(fileName),
    };
  }
  return {
    granularity: "many",
    orgMode: "nearby",
    importScope: selection.scope,
    freeformContext: selection.contextText.trim(),
    docSourceKind: inferDocSourceKind(fileName),
  };
}

type LoreImportJobProgress = {
  phase?: string;
  step?: number;
  total?: number;
  message?: string;
  meta?: Record<string, unknown>;
  updatedAt?: string | null;
};

type LoreImportJobEvent = {
  ts?: string;
  phase?: string;
  kind: "phase_start" | "phase_end" | "llm_call" | "vault_search" | "warning" | "note";
  durationMs?: number;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  stopReason?: string;
  responseSnippet?: string;
  text?: string;
  ref?: string;
};

type LoreImportTargetSpaceOption = {
  spaceId: string;
  title: string;
  path: string;
};

const LORE_SMART_SPACE_SEARCH_MIN_QUERY = 2;
const LORE_SMART_SPACE_SEARCH_DEBOUNCE_MS = 220;

function coerceOptionalProgressInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function readProgressMetaNumber(meta: Record<string, unknown> | undefined, key: string): number | null {
  if (!meta) return null;
  const value = coerceOptionalProgressInt(meta[key]);
  if (value === null) return null;
  return value;
}

function formatEtaLabel(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `~${totalSeconds}s left (estimate)`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return remMinutes > 0
      ? `~${hours}h ${remMinutes}m left (estimate)`
      : `~${hours}h left (estimate)`;
  }
  return seconds > 0
    ? `~${minutes}m ${seconds}s left (estimate)`
    : `~${minutes}m left (estimate)`;
}

function toPlanningStepLabel(phase: string, step?: number, total?: number): string | null {
  if (!(typeof step === "number" && typeof total === "number" && total > 0)) return null;
  if (phase === "merge") return `Merge batch ${step} of ${total}`;
  if (phase === "vault_retrieval") return `Searching vault ${step} of ${total}`;
  return `Step ${step} of ${total}`;
}

function normalizeLoreImportJobEvents(raw: unknown): LoreImportJobEvent[] {
  if (!Array.isArray(raw)) return [];
  const allowedKinds = new Set([
    "phase_start",
    "phase_end",
    "llm_call",
    "vault_search",
    "warning",
    "note",
  ]);
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const kind = String(row.kind ?? "").trim();
      if (!allowedKinds.has(kind)) return null;
      const event: LoreImportJobEvent = {
        kind: kind as LoreImportJobEvent["kind"],
      };
      const ts = String(row.ts ?? "").trim();
      if (ts) event.ts = ts;
      const phase = String(row.phase ?? "").trim();
      if (phase) event.phase = phase;
      const model = String(row.model ?? "").trim();
      if (model) event.model = model;
      const stopReason = String(row.stopReason ?? "").trim();
      if (stopReason) event.stopReason = stopReason;
      const text = String(row.text ?? "").trim();
      if (text) event.text = text;
      const ref = String(row.ref ?? "").trim();
      if (ref) event.ref = ref;
      const responseSnippet = String(row.responseSnippet ?? "").trim();
      if (responseSnippet) event.responseSnippet = responseSnippet;
      const durationMs = coerceOptionalProgressInt(row.durationMs);
      if (durationMs !== null && durationMs >= 0) event.durationMs = durationMs;
      const tokensIn = coerceOptionalProgressInt(row.tokensIn);
      if (tokensIn !== null && tokensIn >= 0) event.tokensIn = tokensIn;
      const tokensOut = coerceOptionalProgressInt(row.tokensOut);
      if (tokensOut !== null && tokensOut >= 0) event.tokensOut = tokensOut;
      return event;
    })
    .filter((event): event is LoreImportJobEvent => Boolean(event));
}

function formatDurationMs(ms?: number): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remSeconds}s`;
}

function toHumanPhaseLabel(phase?: string): string {
  const key = String(phase || "").trim().toLowerCase();
  if (!key) return "Starting…";
  const labels: Record<string, string> = {
    queued: "Queued on the server",
    fallback_plan: "Planning locally",
    chunking: "Reading the document",
    outline: "Building the outline",
    vault_retrieval: "Gathering related vault context",
    merge: "Merging entities and notes",
    clarify: "Drafting clarifications",
    persist_review: "Saving the review queue",
    failed: "Planning failed",
    ready: "Plan ready",
  };
  return labels[key] ?? key.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function summarizeQueueCreateFailure(args: {
  status: number;
  error?: string;
  detail?: string;
  hint?: string;
  errorCode?: string;
  dbCode?: string;
}): string {
  if (args.status === 503) return "Queue service unavailable (check database configuration)";
  if (args.status === 403) return "Queue request forbidden for this session";
  if (args.errorCode === "lore_import_job_persist_failed") {
    const db = args.dbCode ? ` (${args.dbCode})` : "";
    return `Queue persistence failed${db}`;
  }
  if (args.errorCode) return `Queue request failed (${args.errorCode})`;
  if (args.detail) return args.detail;
  if (args.error) return args.error;
  if (args.hint) return args.hint;
  return `Queue request failed (HTTP ${args.status})`;
}

function createLoreImportFailureDetail(args: {
  attemptId: string;
  stage: LoreImportStage;
  operation: string;
  message: string;
  recommendedAction: string;
  responseSnippet?: string;
  httpStatus?: number;
  jobId?: string;
  phase?: string;
  errorCode?: string;
  serverDetail?: string;
  serverHint?: string;
  dbCode?: string;
  dbTable?: string;
  dbColumn?: string;
  dbConstraint?: string;
  retryable?: boolean;
  fileName?: string;
  spaceId?: string;
}): LoreImportFailureDetail {
  return {
    ...args,
    occurredAtIso: new Date().toISOString(),
  };
}

const LORE_IMPORT_VERCEL_BODY_LIMIT_BYTES = 4 * 1024 * 1024;
const LORE_IMPORT_MULTIPART_OVERHEAD_BYTES = 256 * 1024;
const LORE_IMPORT_LOCAL_PDF_MAX_CHARS = 2_000_000;

function loreImportSuggestedTitle(fileName: string): string {
  const trimmed = fileName.trim();
  const base = trimmed.replace(/\.[^.]+$/, "").trim();
  return base || "Import";
}

function shouldUseLocalPdfParse(file: File): boolean {
  if (!file.name.toLowerCase().endsWith(".pdf")) return false;
  // Vercel can reject large multipart bodies before the route handler runs (HTTP 413).
  return file.size + LORE_IMPORT_MULTIPART_OVERHEAD_BYTES >= LORE_IMPORT_VERCEL_BODY_LIMIT_BYTES;
}

let loreImportPdfjsWorkerSrcSet = false;

type LoreImportPdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

/** Pinned to `pnpm-lock.yaml` `pdfjs-dist` (via `pdf-parse`); keep worker URL in sync with `import()`. */
const LORE_IMPORT_PDFJS_WORKER =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/legacy/build/pdf.worker.mjs";
const LORE_IMPORT_PDFJS_MODULE_URL =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/legacy/build/pdf.mjs";

/**
 * pdfjs v5+ requires `GlobalWorkerOptions.workerSrc` before `getDocument` in the browser.
 *
 * We load the published `pdf.mjs` in the *browser* with `import()` + `webpackIgnore: true` so
 * Next’s webpack does not re-bundle the pre-bundled library. Re-wrapping it breaks `next dev`
 * (runtime `Object.defineProperty called on non-object` / undefined `__webpack_exports__`;
 * see webpack#20095, mozilla/pdf.js#20478, vercel/next.js#89177).
 */
async function getLoreImportPdfjs(): Promise<LoreImportPdfjsModule> {
  const pdfjs = (await import(
    /* webpackIgnore: true */
    // Use a variable so TypeScript treats this as runtime URL import (not compile-time module resolution).
    LORE_IMPORT_PDFJS_MODULE_URL
  )) as LoreImportPdfjsModule;
  if (!loreImportPdfjsWorkerSrcSet) {
    pdfjs.GlobalWorkerOptions.workerSrc = LORE_IMPORT_PDFJS_WORKER;
    loreImportPdfjsWorkerSrcSet = true;
  }
  return pdfjs;
}

async function parsePdfInBrowser(
  file: File,
  signal?: AbortSignal,
): Promise<{ text: string; truncated: boolean; pageCount: number; parsedPages: number; failedPages: number }> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const pdfjs = await getLoreImportPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const chunks: string[] = [];
    let charCount = 0;
    let parsedPages = 0;
    let failedPages = 0;
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        const page = await doc.getPage(pageNum);
        try {
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
            .filter(Boolean)
            .join(" ")
            .trim();
          if (!pageText) {
            parsedPages += 1;
            continue;
          }
          if (chunks.length > 0) {
            const remaining = LORE_IMPORT_LOCAL_PDF_MAX_CHARS - charCount;
            if (remaining <= 0) break;
            const spacer = "\n\n";
            const spacing = spacer.length > remaining ? spacer.slice(0, remaining) : spacer;
            chunks.push(spacing);
            charCount += spacing.length;
            if (spacing.length < spacer.length) break;
          }
          const remaining = LORE_IMPORT_LOCAL_PDF_MAX_CHARS - charCount;
          if (remaining <= 0) break;
          const next = pageText.length > remaining ? pageText.slice(0, remaining) : pageText;
          chunks.push(next);
          charCount += next.length;
          parsedPages += 1;
          if (next.length < pageText.length) break;
        } finally {
          page.cleanup();
        }
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        failedPages += 1;
      }
    }
    if (parsedPages === 0) {
      throw new Error("PDF did not contain readable text");
    }
    return {
      text: chunks.join("").replace(/\0/g, "").trim(),
      truncated: charCount >= LORE_IMPORT_LOCAL_PDF_MAX_CHARS,
      pageCount: doc.numPages,
      parsedPages,
      failedPages,
    };
  } finally {
    await doc.destroy();
  }
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    const msg = error.message.toLowerCase();
    return name === "aborterror" || msg.includes("aborted") || msg.includes("abort");
  }
  return false;
}

async function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    await new Promise((r) => setTimeout(r, ms));
    return;
  }
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

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

function clarificationConfidenceScore(c: LoreImportClarificationItem): number {
  if (typeof c.confidenceScore === "number" && Number.isFinite(c.confidenceScore)) {
    return Math.max(0, Math.min(1, c.confidenceScore));
  }
  if (c.questionKind === "confirm_default") return 0.78;
  if (c.severity === "required") return 0.44;
  return 0.62;
}

function isClarificationAnswered(a: ClarificationAnswer | undefined): boolean {
  if (!a) return false;
  if (a.resolution === "answered") return (a.selectedOptionIds?.length ?? 0) > 0;
  if (a.resolution === "skipped_default") return !!a.skipDefaultOptionId;
  if (a.resolution === "other_text") return (a.otherText?.trim().length ?? 0) >= 4;
  if (a.resolution === "skipped_best_judgement") return true;
  return false;
}

type LoreImportOtherFollowUp = {
  clarificationId: string;
  title: string;
  question: string;
  options: { id: string; label: string; recommended?: boolean }[];
  confidence: number;
  otherText: string;
};

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
/** Skip O(n) palette indexing when the command palette is closed (hot path on every node add / graph mutation). */
const EMPTY_PALETTE_ITEMS: PaletteItem[] = [];
const EMPTY_PALETTE_SPACES: PaletteSpace[] = [];
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

/** Client rect union of `[data-stack-layer]` — tall lore cards exceed `.stackContainer`’s CSS min box. */
function unionBoundingRectFromStackLayers(container: HTMLElement): DOMRect | null {
  const layers = Array.from(container.querySelectorAll<HTMLElement>("[data-stack-layer='true']"));
  if (layers.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const layer of layers) {
    const r = layer.getBoundingClientRect();
    minX = Math.min(minX, r.left);
    minY = Math.min(minY, r.top);
    maxX = Math.max(maxX, r.right);
    maxY = Math.max(maxY, r.bottom);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
    width: maxX - minX,
    height: maxY - minY,
    x: minX,
    y: minY,
    toJSON: () => ({}),
  } as DOMRect;
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

/**
 * Fallback color for connections hydrated without one (e.g. historical DB rows
 * that predate the kind-driven picker). Resolves to the `pin` kind's canonical
 * swatch — see `src/lib/connection-kind-colors.ts`.
 */
const CONNECTION_DEFAULT_COLOR = colorForConnectionKind("pin");
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
/** World-space padding around the viewport for culling (cards / threads slightly off-screen stay mounted). */
const CULL_MARGIN_WORLD = 100;

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

function clampFollowCamera(cam: CameraState): CameraState {
  return {
    x: Number.isFinite(cam.x) ? cam.x : 0,
    y: Number.isFinite(cam.y) ? cam.y : 0,
    zoom: Math.min(
      HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MAX,
      Math.max(
        HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MIN,
        Number.isFinite(cam.zoom) ? cam.zoom : 1,
      ),
    ),
  };
}

/** CSS pixel size of the canvas viewport for `defaultCamera` / recenter — prefer the element over window. */
function viewportCssSizeForDefaultCamera(
  viewportEl: HTMLDivElement | null,
  fallbackWidth: number,
  fallbackHeight: number,
): { width: number; height: number } {
  const rect = viewportEl?.getBoundingClientRect();
  const w =
    rect && rect.width > 0
      ? rect.width
      : fallbackWidth > 0
        ? fallbackWidth
        : typeof window !== "undefined"
          ? window.innerWidth
          : 0;
  const h =
    rect && rect.height > 0
      ? rect.height
      : fallbackHeight > 0
        ? fallbackHeight
        : typeof window !== "undefined"
          ? window.innerHeight
          : 0;
  return { width: Math.max(1, w), height: Math.max(1, h) };
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
    const h =
      placement.offsetHeight ||
      (entity.kind === "folder" ? FOLDER_CARD_HEIGHT : entity.height ?? 280);
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

/** Live placement size for persistence / bounds — same node resolution as connection pins. */
function measureArchitecturalNodePlacement(
  entityId: string,
  spaceId: string,
): { width: number; height: number } | null {
  if (typeof document === "undefined") return null;
  const escapedId =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(entityId)
      : entityId.replace(/"/g, '\\"');
  const escapedSpace =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(spaceId)
      : spaceId.replace(/"/g, '\\"');
  const nodeSel = `[data-node-id="${escapedId}"][data-space-id="${escapedSpace}"]`;
  const fanStage = document.querySelector<HTMLElement>("[data-stack-fan-stage='true']");
  const placement =
    (fanStage?.querySelector<HTMLElement>(nodeSel) as HTMLElement | null) ??
    document.querySelector<HTMLElement>(nodeSel);
  if (!placement) return null;
  const w = placement.offsetWidth;
  const h = placement.offsetHeight;
  if (w < 8 || h < 8) return null;
  return { width: w, height: h };
}

function tapeVariantForTheme(theme: ContentTheme): TapeVariant {
  if (theme === "code" || theme === "media") return "dark";
  return "clear";
}

function isLoreCreateNodeType(type: NodeTheme): type is LoreCardKind {
  return type === "character" || type === "faction" || type === "location";
}

/** Character is always v11. Location defaults to ORDO v7; v1 migrates to v7. Faction: explicit v1–v3 or default. */
function resolveLoreVariantForCreate(
  type: LoreCardKind,
  requested: LoreCardVariant | undefined,
): LoreCardVariant {
  if (type === "character") {
    return defaultLoreCardVariantForKind(type);
  }
  if (type === "location") {
    if (requested === "v1") return "v7";
    if (requested === "v2" || requested === "v3" || requested === "v7") {
      return requested;
    }
    return defaultLoreCardVariantForKind(type);
  }
  if (type === "faction") {
    if (requested === "v1" || requested === "v2" || requested === "v3" || requested === "v4") {
      return "v4";
    }
    return defaultLoreCardVariantForKind(type);
  }
  return defaultLoreCardVariantForKind(type);
}

function normalizedFocusTitle(raw: string): string {
  return raw.trim() || "Untitled";
}

function jsonStableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
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
    .slice(0, FOLDER_CONTENT_PREVIEW_MAX_LINES)
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
  const el = pointerEventTargetElement(target);
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return true;
  }
  /* Text nodes have no isContentEditable; host uses React contenteditable="" (not [contenteditable="true"]). */
  return el instanceof HTMLElement && el.isContentEditable === true;
}

/** Mirrors `BufferedContentEditable` caret probes — canvas delete must not steal real text edits. */
function canvasCaretIsAtStartOfHost(host: HTMLElement, range: Range): boolean {
  if (!range.collapsed) return false;
  const probe = document.createRange();
  try {
    probe.setStart(host, 0);
    probe.setEnd(range.startContainer, range.startOffset);
  } catch {
    return false;
  }
  return probe.toString().length === 0;
}

function canvasCaretIsAtEndOfHost(host: HTMLElement, range: Range): boolean {
  if (!range.collapsed || !host.contains(range.startContainer)) return false;
  const end = document.createRange();
  try {
    end.selectNodeContents(host);
    end.collapse(false);
    const fromCaret = document.createRange();
    fromCaret.setStart(range.startContainer, range.startOffset);
    fromCaret.setEnd(end.startContainer, end.startOffset);
    return fromCaret.toString().length === 0;
  } catch {
    return false;
  }
}

function resolveCanvasDataNodeIdFromTarget(target: EventTarget | null): string | null {
  const el = pointerEventTargetElement(target);
  if (!el) return null;
  const node = el.closest("[data-node-id]") as HTMLElement | null;
  const id = node?.dataset.nodeId;
  return id && id.length > 0 ? id : null;
}

function resolveCanvasRichBodyHostFromTarget(target: EventTarget | null): HTMLElement | null {
  const el = pointerEventTargetElement(target);
  if (!el) return null;
  return el.closest("[data-hg-rich-editor-host], [data-hg-doc-editor]") as HTMLElement | null;
}

/**
 * When focus is inside a node body editor, Delete/Backspace normally edit HTML/TipTap.
 * Allow the canvas shortcut to remove the selected node(s) only when the key would not
 * meaningfully edit (e.g. Delete at end of body, Backspace in an empty HTML body or empty HgDoc).
 */
function shouldAllowCanvasDeleteWhileEditableBodyFocused(
  target: EventTarget | null,
  selectedNodeIds: readonly string[],
  event: KeyboardEvent,
): boolean {
  const nodeId = resolveCanvasDataNodeIdFromTarget(target);
  if (!nodeId || !selectedNodeIds.includes(nodeId)) return false;

  const host = resolveCanvasRichBodyHostFromTarget(target);
  if (!host) return false;

  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);

  if (event.key === "Delete") {
    return canvasCaretIsAtEndOfHost(host, range);
  }
  if (event.key === "Backspace") {
    if (!canvasCaretIsAtStartOfHost(host, range)) return false;
    if (host.matches("[data-hg-rich-editor-host]")) {
      return host.getAttribute("data-arch-doc-empty") === "true";
    }
    if (host.matches("[data-hg-doc-editor]")) {
      const surfaceKey = host.getAttribute("data-hg-doc-surface");
      const api = getHgDocEditor(surfaceKey);
      return !!(api?.isEmptyDocument?.() ?? false);
    }
    return false;
  }
  return false;
}

/**
 * Focus / selection is in a rich prose body where the formatting dock applies.
 * Excludes titles (focus overlay, folder names), plain-text fields, and other inputs.
 */
function isTextFormattingToolbarTarget(focusEl: Element | null): boolean {
  return !!(focusEl instanceof HTMLElement && focusEl.closest("[data-hg-doc-editor]"));
}

/** Caret is in a prose body surface (not card titles) — in-document insert tools apply. */
function isRichDocBodyFormattingTarget(focusEl: Element | null): boolean {
  const surface = resolveActiveRichEditorSurface(focusEl);
  if (!surface.root) return false;
  if (!surface.root.matches("[data-hg-doc-editor]")) return false;
  return caretIsWithinRichDocInsertRegion(focusEl, surface.root, surface.kind);
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
      text.setAttribute("data-arch-task-text", "true");
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
      taskText.setAttribute("data-arch-task-text", "true");

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
    } else {
      taskText.setAttribute("data-arch-task-text", "true");
    }
  });

  return wrap.innerHTML;
}

function projectBodyHtmlForFocus(
  entity: Pick<CanvasContentEntity, "id" | "kind" | "bodyHtml" | "loreCard">,
  bodyHtml: string,
): string {
  if (shouldRenderLoreCharacterCredentialCanvasNode(entity)) {
    return characterV11BodyToFocusDocumentHtml(
      withCharacterV11ObjectIdInHeader(bodyHtml, entity.id),
    );
  }
  if (shouldRenderLoreLocationCanvasNode(entity)) {
    return locationBodyToFocusDocumentHtml(bodyHtml);
  }
  if (shouldRenderLoreFactionArchive091CanvasNode(entity)) {
    return factionBodyToFocusDocumentHtml(
      withFactionArchiveObjectIdInRails(bodyHtml, entity.id),
    );
  }
  return bodyHtml;
}

function canonicalizeCharacterBodyHtml(
  entity: Pick<CanvasContentEntity, "id" | "kind" | "bodyHtml" | "loreCard">,
  bodyHtml: string,
): string {
  if (!shouldRenderLoreCharacterCredentialCanvasNode(entity)) return bodyHtml;
  const normalizedBody =
    bodyHtml.includes(loreEntityCardStyles.charSkShellV11) &&
    bodyHtml.includes(loreEntityCardStyles.charSkCardMaterial)
      ? bodyHtml
      : normalizeCharacterV11BodyHtmlForCurrentBuild(bodyHtml);
  return withCharacterV11ObjectIdInHeader(
    normalizedBody,
    entity.id,
  );
}

function canonicalizeFactionBodyHtml(
  entity: Pick<CanvasContentEntity, "id" | "kind" | "bodyHtml" | "loreCard">,
  bodyHtml: string,
): string {
  if (!shouldRenderLoreFactionArchive091CanvasNode(entity)) return bodyHtml;
  const base = bodyHtmlImpliesFactionArchive091(bodyHtml)
    ? bodyHtml
    : getLoreNodeSeedBodyHtml("faction", "v4", { factionRailSeed: entity.id });
  return withFactionArchiveObjectIdInRails(base, entity.id);
}

type LassoRectScreen = { x1: number; y1: number; x2: number; y2: number };

/**
 * Whether a pointer event target is “canvas chrome” for pan / marquee lasso (not on an entity, stack, or thread).
 * Entity surfaces win over raw svg/path (e.g. icons inside cards). Connection threads are not marquee targets.
 */
/**
 * v11 character nodes wrap the plate inside `.nodeBody`; the catalog header strip should still
 * arm canvas drag like `.nodeHeader` on note cards (mousedown uses `inContent` / `nodeBody`).
 */
function targetIsLoreCharacterV11CanvasDragChrome(target: Element): boolean {
  const cred = target.closest('[data-hg-canvas-role="lore-character-v11"]');
  if (!cred) return false;
  if (target.closest("[data-expand-btn='true']")) return false;
  if (target.closest("[data-architectural-media-upload='true']")) return false;
  if (target.closest("[data-hg-lore-field]")) return false;
  /*
   * Regression guard:
   * `BufferedContentEditable` wraps the whole lore plate with
   * `[data-hg-rich-editor-inner="true"][contenteditable="true"]`. Rejecting
   * generic `[contenteditable='true']` here would make every hit look
   * "editable" and block drag-start for the entire character card.
   */
  if (
    target.closest(
      "button, a, input, textarea, select, [role='button']",
    )
  ) {
    return false;
  }
  // Treat any non-editable surface in the credential shell as card chrome so legacy/drifted
  // class names still allow selection + deletion from click/drag.
  return true;
}

/** Location ORDO v7 slab: drag only from the masthead strip (`data-hg-lore-ordo-drag-handle`); body fields stay text-first. */
function targetIsLoreLocationOrdoCanvasDragChrome(target: Element): boolean {
  const root = target.closest('[data-hg-canvas-role="lore-location"][data-lore-variant="v7"]');
  if (!root) return false;
  if (!target.closest("[data-hg-lore-ordo-drag-handle='true']")) return false;
  if (target.closest("[data-expand-btn='true']")) return false;
  if (
    target.closest(
      "button, a, input, textarea, select, [role='button']",
    )
  ) {
    return false;
  }
  return true;
}

/** Faction Archive-091: drag from plate header strip only (`data-hg-faction-archive-drag-handle`). */
function targetIsLoreFactionArchiveCanvasDragChrome(target: Element): boolean {
  const root = target.closest('[data-hg-canvas-role="lore-faction"][data-lore-variant="v4"]');
  if (!root) return false;
  if (!target.closest("[data-hg-faction-archive-drag-handle='true']")) return false;
  if (target.closest("[data-expand-btn='true']")) return false;
  if (
    target.closest(
      "button, a, input, textarea, select, [role='button']",
    )
  ) {
    return false;
  }
  return true;
}

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

/** Plain text for clipboard / support when bootstrap cannot reach Postgres (boot gate on, cloud expected). */
const WORKSPACE_BOOTSTRAP_ERROR_COPY = `Heartgarden — Could not load workspace

No account data was deleted. This browser session could not open a Postgres workspace.

Local dev:
1. Add NEON_DATABASE_URL, DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL to heartgarden/.env.local (Neon connection string).
2. Restart the dev server from the vigil folder: pnpm run dev
3. Reload this page.

Vercel / hosted:
1. Project → Settings → Environment Variables: add NEON_DATABASE_URL (or DATABASE_URL) for Production — use Neon’s pooled serverless URL; see docs/DEPLOY_VERCEL.md.
2. Redeploy so serverless functions pick up the variable.
3. Reload this page.

After one successful cloud load, Heartgarden keeps a local snapshot in this browser so short outages still show your garden.`;

/**
 * Shape of the last failed bootstrap attempt, cached in state so
 * {@link WorkspaceBootstrapErrorPanel} can surface **why** loading failed
 * (schema drift 500, forbidden role, offline, etc.) instead of only a
 * generic overlay. Null = no failure recorded yet.
 */
type WorkspaceBootstrapErrorSummary = {
  cause: Exclude<BootstrapFetchDetail, { ok: true }>["cause"];
  status: number | null;
  message: string | null;
};

function summarizeBootstrapError(
  detail: Extract<BootstrapFetchDetail, { ok: false }>,
): WorkspaceBootstrapErrorSummary {
  if (detail.cause === "network") {
    return { cause: "network", status: null, message: detail.message };
  }
  if (detail.cause === "parse") {
    return { cause: "parse", status: detail.status, message: null };
  }
  return {
    cause: detail.cause,
    status: detail.status,
    message: "message" in detail && detail.message ? detail.message : null,
  };
}

function formatBootstrapErrorHeadline(
  summary: WorkspaceBootstrapErrorSummary | null,
): string | null {
  if (!summary) return null;
  switch (summary.cause) {
    case "network":
      return "Network error reaching /api/bootstrap";
    case "forbidden":
      return `HTTP 403 — session not allowed on this workspace`;
    case "demo":
      return "Server returned demo fallback (database not configured)";
    case "parse":
      return `HTTP ${summary.status ?? "?"} — server returned non-JSON (likely a crash)`;
    case "http":
    default: {
      const s = summary.status ?? "?";
      return `HTTP ${s} from /api/bootstrap`;
    }
  }
}

function WorkspaceBootstrapErrorPanel({
  errorSummary,
}: {
  errorSummary: WorkspaceBootstrapErrorSummary | null;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headline = formatBootstrapErrorHeadline(errorSummary);

  const copyPayload = useMemo(() => {
    if (!errorSummary) return WORKSPACE_BOOTSTRAP_ERROR_COPY;
    const lines = [
      WORKSPACE_BOOTSTRAP_ERROR_COPY,
      "",
      "Diagnostics:",
      `- cause: ${errorSummary.cause}`,
    ];
    if (errorSummary.status != null) lines.push(`- status: ${errorSummary.status}`);
    if (errorSummary.message) lines.push(`- server message: ${errorSummary.message}`);
    return lines.join("\n");
  }, [errorSummary]);

  const onCopyDetails = useCallback(async () => {
    const markCopied = () => {
      setCopied(true);
      if (copyTimerRef.current != null) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        copyTimerRef.current = null;
        setCopied(false);
      }, 2500);
    };
    try {
      await navigator.clipboard.writeText(copyPayload);
      markCopied();
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = copyPayload;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        markCopied();
      } catch {
        window.alert("Could not copy automatically — select the text in the box and press Ctrl+C (⌘C on Mac).");
      }
    }
  }, [copyPayload]);

  useEffect(
    () => () => {
      if (copyTimerRef.current != null) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    },
    [],
  );

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
        {headline ? (
          <p
            className={styles.neonWorkspaceUnavailableFoot}
            data-testid="hg-ws-err-headline"
          >
            <span className={styles.monoSmall}>{headline}</span>
            {errorSummary?.message ? (
              <>
                {" — "}
                <span className={styles.monoSmall}>{errorSummary.message}</span>
              </>
            ) : null}
          </p>
        ) : null}
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
            {copyPayload}
          </pre>
        </div>
        <p className={styles.neonWorkspaceUnavailableFoot}>
          Server checks{" "}
          <span className={styles.monoSmall}>NEON_DATABASE_URL</span>,{" "}
          <span className={styles.monoSmall}>DATABASE_URL</span>,{" "}
          <span className={styles.monoSmall}>POSTGRES_URL</span>, then{" "}
          <span className={styles.monoSmall}>POSTGRES_PRISMA_URL</span> (Vercel / Neon).
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
  sessionTier: "access" | "player" | "demo" | null;
  playerLayerMisconfigured: boolean;
};

function parseHeartgardenBootStatus(d: HeartgardenBootStatusJson): HeartgardenBootApiState {
  const st = d.sessionTier;
  const tier =
    st === "access" || st === "demo" || st === "player"
      ? st
      : st === "visitor"
        ? "player"
        : null;
  return {
    loaded: true,
    gateEnabled: Boolean(d.gateEnabled),
    sessionValid: Boolean(d.sessionValid),
    sessionTier: tier,
    playerLayerMisconfigured: Boolean(d.gateEnabled && d.playerLayerMisconfigured),
  };
}

/** Local-only demo canvas (no Neon); same graph as default seed (single-level Demo subspace folder). */
function buildHeartgardenDemoLocalGraph() {
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
    "default",
  );
}

function workspaceCacheTierForNeonSession(b: HeartgardenBootApiState): WorkspaceBootTierTag {
  if (!b.gateEnabled) return "open";
  if (b.sessionTier === "access") return "access";
  if (b.sessionTier === "player") return "player";
  return "open";
}

export function ArchitecturalCanvasApp({
  scenario = "default",
}: {
  scenario?: ArchitecturalCanvasScenario;
}) {
  useChunkLoadRecovery();
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
  const [pendingFolderTitleSelectId, setPendingFolderTitleSelectId] = useState<string | null>(null);
  /** Lore character canvas: body is read-only until double-click so Delete targets the node, not the editor. */
  const [loreCanvasBodyEditEntityId, setLoreCanvasBodyEditEntityId] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionDockMode>("move");
  const connectionModeSoundPrevRef = useRef<ConnectionDockMode>("move");
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [threadRosterNotice, setThreadRosterNotice] = useState<string | null>(null);
  const [collabConnectionsNotice, setCollabConnectionsNotice] = useState<string | null>(null);
  /**
   * Connection kind drives BOTH the color and `item_links.link_type` written
   * when a new thread is drawn. The picker edits this single piece of state;
   * `connection-kind-colors.ts` is the canonical map. Legacy per-color state
   * was removed — color is a visual consequence of the selected kind.
   */
  const [connectionKind, setConnectionKind] = useState<ConnectionKind>("pin");
  const connectionColor = useMemo(() => colorForConnectionKind(connectionKind), [connectionKind]);
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
  /**
   * Last failed `/api/bootstrap` attempt (status + short server message).
   * Used by {@link WorkspaceBootstrapErrorPanel} so the blocking overlay shows **why** — a
   * schema-drift 500 must not look the same as a 403 or an offline network. Cleared on
   * every successful live bootstrap (see `ingestLiveBootstrap` setter usage).
   */
  const [bootstrapErrorSummary, setBootstrapErrorSummary] =
    useState<WorkspaceBootstrapErrorSummary | null>(null);
  /** True when the canvas is hydrated from localStorage because live bootstrap failed (still looks “loaded”). */
  const [workspaceViewFromCache, setWorkspaceViewFromCache] = useState(false);
  const [navTransitionActive, setNavTransitionActive] = useState(false);
  const [itemConflictQueue, setItemConflictQueue] = useState<CanvasItem[]>([]);
  const itemConflictQueueRef = useRef<CanvasItem[]>([]);
  const [presencePeers, setPresencePeers] = useState<SpacePresencePeer[]>([]);
  const [realtimeRefreshNonce, setRealtimeRefreshNonce] = useState(0);
  const localPointerWorldRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointerPresencePostRef = useRef(0);
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
      heartgardenBootApi.sessionTier === "player",
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
  /**
   * GM contexts (open gate dev or Bishop/access tier) should mirror deployed behavior:
   * require live workspace bootstrap and persistence paths; no silent demo/cache fallback.
   */
  const strictGmWorkspaceSession = useMemo(
    () =>
      scenario === "default" &&
      heartgardenBootApi.loaded &&
      (!heartgardenBootApi.gateEnabled || heartgardenBootApi.sessionTier === "access"),
    [
      scenario,
      heartgardenBootApi.loaded,
      heartgardenBootApi.gateEnabled,
      heartgardenBootApi.sessionTier,
    ],
  );
  const heartgardenBootApiRef = useRef(heartgardenBootApi);
  heartgardenBootApiRef.current = heartgardenBootApi;

  useEffect(() => {
    neonVaultIndexSetPlayerLayerActive(isPlayersTier);
    return () => neonVaultIndexSetPlayerLayerActive(false);
  }, [isPlayersTier]);

  /**
   * Presence identity (names/sigils) is intentionally scoped to player sessions for now.
   * GM/other spaces keep current anonymous behavior until we intentionally expand it.
   */
  const presenceIdentityEnabled = isPlayersTier;
  useEffect(() => {
    if (!presenceIdentityEnabled) return;
    maybePromptPresenceDisplayNameOnce(getOrCreatePresenceClientId());
  }, [presenceIdentityEnabled]);

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
  const [viewportToastOpen, setViewportToastOpen] = useState(false);
  /** Default hidden; restored from `localStorage` on the client after SSR hydrate (see layout effect). */
  const [minimapOpen, setMinimapOpen] = useState(false);

  useLayoutEffect(() => {
    setMinimapOpen(readCanvasMinimapVisibleFromStorage());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== VIGIL_MINIMAP_VISIBLE_STORAGE_KEY) return;
      if (e.storageArea !== window.localStorage) return;
      setMinimapOpen(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const GRAPH_PANEL_WIDTH_STORAGE_KEY = "heartgarden.graphPanel.width";
  const [minimapPlacementSizes, setMinimapPlacementSizes] = useState<
    ReadonlyMap<string, { width: number; height: number }>
  >(() => new Map());
  const paletteOpenSoundPrevRef = useRef(false);
  const [lorePanelOpen, setLorePanelOpen] = useState(false);
  const lorePanelOpenRef = useRef(false);
  const lorePanelOpenSoundPrevRef = useRef(false);
  const [graphOverlayOpen, setGraphOverlayOpen] = useState(false);
  const [graphPanelWidth, setGraphPanelWidth] = useState(360);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = Number(window.localStorage.getItem(GRAPH_PANEL_WIDTH_STORAGE_KEY) ?? "");
      if (!Number.isFinite(raw)) return;
      setGraphPanelWidth(Math.max(320, Math.min(760, Math.round(raw))));
    } catch {
      /* ignore */
    }
  }, [GRAPH_PANEL_WIDTH_STORAGE_KEY]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(GRAPH_PANEL_WIDTH_STORAGE_KEY, String(graphPanelWidth));
    } catch {
      /* ignore */
    }
  }, [GRAPH_PANEL_WIDTH_STORAGE_KEY, graphPanelWidth]);
  const [activeBraneId, setActiveBraneId] = useState<string | null>(null);
  const [altHeld, setAltHeld] = useState(false);
  /**
   * Alt-hover graph card content. NOTE: position (x/y) is intentionally NOT
   * stored in state — it changes on every pointer move, which would re-render
   * the whole canvas at frame rate. Position is updated imperatively via
   * `altGraphCardDivRef.current.style.transform`. (REVIEW_2026-04-25_1835.md M8.)
   */
  const [altGraphCard, setAltGraphCard] = useState<{
    term: string;
    mentions: AltMentionRow[];
    searchItems: AltSearchRow[];
    loadingMentions: boolean;
    loadingSearch: boolean;
  } | null>(null);
  const altGraphCardPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const altMentionCacheRef = useRef(
    new BoundedMap<string, { at: number; items: AltMentionRow[] }>(ALT_HOVER_CACHE_MAX),
  );
  const altSearchCacheRef = useRef(
    new BoundedMap<string, { at: number; items: AltSearchRow[] }>(ALT_HOVER_CACHE_MAX),
  );
  const altWordHighlightDivRef = useRef<HTMLDivElement | null>(null);
  const altGraphCardDivRef = useRef<HTMLDivElement | null>(null);

  const setAltHighlightRect = useCallback(
    (rect: { left: number; top: number; width: number; height: number } | null) => {
      const el = altWordHighlightDivRef.current;
      if (!el) return;
      if (!rect) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.style.transform = `translate3d(${rect.left - 2}px, ${rect.top - 1}px, 0)`;
      el.style.width = `${rect.width + 4}px`;
      el.style.height = `${rect.height + 2}px`;
    },
    [],
  );

  const setAltGraphCardPos = useCallback((x: number, y: number) => {
    altGraphCardPosRef.current = { x, y };
    const el = altGraphCardDivRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, []);
  const graphOverlayOpenSoundPrevRef = useRef(false);
  const [loreSmartReview, setLoreSmartReview] = useState<LoreSmartImportReviewState | null>(null);
  const [loreSmartPlanning, setLoreSmartPlanning] = useState(false);
  const [loreSmartPlanningJobId, setLoreSmartPlanningJobId] = useState<string | null>(null);
  const loreSmartPlanningAbortRef = useRef<AbortController | null>(null);
  const loreSmartPlanningAttemptRef = useRef<string | null>(null);
  const loreSmartPlanningStartedAtRef = useRef<number | null>(null);
  const [loreSmartPlanningProgress, setLoreSmartPlanningProgress] =
    useState<LoreImportJobProgress | null>(null);
  const [loreSmartPlanningEvents, setLoreSmartPlanningEvents] = useState<LoreImportJobEvent[]>([]);
  const [loreSmartPlanningDetailsOpen, setLoreSmartPlanningDetailsOpen] = useState(false);
  const loreSmartPlanningUi = useMemo(() => {
    const progress = loreSmartPlanningProgress;
    const phase = String(progress?.phase ?? "").trim();
    const queueFailureHintRaw = progress?.meta?.queueFailureHint;
    const queueFailureHint =
      typeof queueFailureHintRaw === "string" && queueFailureHintRaw.trim().length > 0
        ? queueFailureHintRaw.trim()
        : null;
    const phaseLabel = toHumanPhaseLabel(phase);
    const rawDetail = typeof progress?.message === "string" ? progress.message.trim() : "";
    const redundantQueuedCopy = phase === "queued" && /^queued\b/i.test(rawDetail);
    const detail =
      redundantQueuedCopy || rawDetail.length === 0 || /^queued\b/i.test(rawDetail)
        ? null
        : rawDetail;
    const failed = phase === "failed";
    const stepLabel = toPlanningStepLabel(phase, progress?.step, progress?.total);
    const meta =
      progress?.meta && typeof progress.meta === "object"
        ? (progress.meta as Record<string, unknown>)
        : undefined;
    const pipelinePercent = readProgressMetaNumber(meta, "pipelinePercent");
    const subphaseRaw = typeof meta?.subphase === "string" ? meta.subphase.trim() : "";
    const subphase = subphaseRaw.length > 0 ? subphaseRaw : null;
    const findingsRaw =
      meta?.findings && typeof meta.findings === "object"
        ? (meta.findings as Record<string, unknown>)
        : undefined;
    const findings = findingsRaw
      ? {
          chunks: readProgressMetaNumber(findingsRaw, "chunks"),
          folders: readProgressMetaNumber(findingsRaw, "folders"),
          notes: readProgressMetaNumber(findingsRaw, "notes"),
          candidates: readProgressMetaNumber(findingsRaw, "candidates"),
          candidateSpaces: readProgressMetaNumber(findingsRaw, "candidateSpaces"),
          mergeProposals: readProgressMetaNumber(findingsRaw, "mergeProposals"),
          contradictions: readProgressMetaNumber(findingsRaw, "contradictions"),
          clarifications: readProgressMetaNumber(findingsRaw, "clarifications"),
          targetSpaceRoutes: readProgressMetaNumber(findingsRaw, "targetSpaceRoutes"),
        }
      : null;
    const findingsSummary = findings
      ? [
          typeof findings.chunks === "number" ? `${findings.chunks} chunks` : null,
          typeof findings.notes === "number" ? `${findings.notes} notes` : null,
          typeof findings.folders === "number" ? `${findings.folders} folders` : null,
          typeof findings.candidates === "number" ? `${findings.candidates} candidates` : null,
          typeof findings.candidateSpaces === "number"
            ? `${findings.candidateSpaces} candidate spaces`
            : null,
          typeof findings.mergeProposals === "number"
            ? `${findings.mergeProposals} merge proposals`
            : null,
          typeof findings.contradictions === "number"
            ? `${findings.contradictions} contradictions`
            : null,
          typeof findings.clarifications === "number"
            ? `${findings.clarifications} clarifications`
            : null,
          typeof findings.targetSpaceRoutes === "number"
            ? `${findings.targetSpaceRoutes} routed`
            : null,
        ]
          .filter((token): token is string => Boolean(token))
          .join(" · ")
      : null;
    const startedAt = loreSmartPlanningStartedAtRef.current;
    const etaLabel =
      !failed &&
      typeof pipelinePercent === "number" &&
      pipelinePercent > 5 &&
      pipelinePercent < 95 &&
      typeof startedAt === "number"
        ? formatEtaLabel(((Date.now() - startedAt) / pipelinePercent) * (100 - pipelinePercent))
        : null;
    return {
      phase,
      phaseLabel,
      detail,
      queueFailureHint,
      failed,
      pipelinePercent,
      stepLabel,
      subphase,
      findingsSummary: findingsSummary || null,
      etaLabel,
    };
  }, [loreSmartPlanningProgress]);
  const [loreSmartIncludeSource, setLoreSmartIncludeSource] = useState(true);
  const [loreSmartAcceptedMergeIds, setLoreSmartAcceptedMergeIds] = useState<Record<string, boolean>>(
    {},
  );
  const [loreSmartClarificationAnswers, setLoreSmartClarificationAnswers] = useState<
    ClarificationAnswer[]
  >([]);
  const [loreSmartOtherFollowUp, setLoreSmartOtherFollowUp] = useState<LoreImportOtherFollowUp | null>(
    null,
  );
  const [loreSmartManualQuestionId, setLoreSmartManualQuestionId] = useState<string | null>(null);
  const [loreSmartTargetSpaceByNoteId, setLoreSmartTargetSpaceByNoteId] = useState<
    Record<string, string | null>
  >({});
  const [loreSmartRelatedOpenByNoteId, setLoreSmartRelatedOpenByNoteId] = useState<
    Record<string, boolean>
  >({});
  const [loreSmartSpaceSearchQuery, setLoreSmartSpaceSearchQuery] = useState("");
  const [loreSmartSpaceSearchResults, setLoreSmartSpaceSearchResults] = useState<
    LoreImportTargetSpaceOption[]
  >([]);
  const [loreImportCommitting, setLoreImportCommitting] = useState(false);
  const loreSmartMergeProposals = useMemo(
    () => loreSmartReview?.plan.mergeProposals ?? [],
    [loreSmartReview],
  );
  const loreSmartAcceptedMergeCount = useMemo(
    () =>
      loreSmartMergeProposals.reduce(
        (sum, proposal) => sum + (loreSmartAcceptedMergeIds[proposal.id] ? 1 : 0),
        0,
      ),
    [loreSmartAcceptedMergeIds, loreSmartMergeProposals],
  );
  const loreSmartNoteTitleByClientId = useMemo(() => {
    const byId = new Map<string, string>();
    for (const note of loreSmartReview?.plan.notes ?? []) {
      byId.set(note.clientId, note.title);
    }
    return byId;
  }, [loreSmartReview]);
  const closeLoreSmartReview = useCallback(() => {
    if (loreImportCommitting) return;
    setLoreSmartReview(null);
    setLoreSmartAcceptedMergeIds({});
    setLoreSmartClarificationAnswers([]);
    setLoreSmartOtherFollowUp(null);
    setLoreSmartManualQuestionId(null);
    setLoreSmartTargetSpaceByNoteId({});
    setLoreSmartRelatedOpenByNoteId({});
    setLoreSmartSpaceSearchQuery("");
    setLoreSmartSpaceSearchResults([]);
  }, [loreImportCommitting]);
  const flattenSmartImportToNearby = useCallback(() => {
    setLoreSmartReview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        plan: flipOrgMode(prev.plan, "nearby"),
      };
    });
    setLoreSmartClarificationAnswers([]);
    setLoreSmartManualQuestionId(null);
    setLoreSmartOtherFollowUp(null);
  }, []);
  const collapseSmartImportToOneNote = useCallback(() => {
    setLoreSmartReview((prev) => {
      if (!prev) return prev;
      const title = prev.sourceTitle?.trim() || prev.fileName || prev.plan.fileName || "Imported document";
      return {
        ...prev,
        plan: collapseToOneNote(prev.plan, {
          title,
          text: prev.sourceText,
        }),
      };
    });
    setLoreSmartClarificationAnswers([]);
    setLoreSmartManualQuestionId(null);
    setLoreSmartOtherFollowUp(null);
  }, []);
  const setAllLoreSmartMergeAcceptances = useCallback((accepted: boolean) => {
    setLoreSmartAcceptedMergeIds((prev) => {
      const next: Record<string, boolean> = {};
      for (const mergeId of Object.keys(prev)) {
        next[mergeId] = accepted;
      }
      return next;
    });
  }, []);
  const setLoreSmartMergeAccepted = useCallback((mergeId: string, accepted: boolean) => {
    setLoreSmartAcceptedMergeIds((prev) => ({
      ...prev,
      [mergeId]: accepted,
    }));
  }, []);
  const loreSmartImportScope = loreSmartReview?.plan.userContext?.importScope ?? "current_subtree";
  const loreSmartPlanWithTargetOverrides = useMemo(() => {
    if (!loreSmartReview) return null;
    const notes = loreSmartReview.plan.notes.map((note) => {
      if (note.folderClientId) return note;
      const overridden = loreSmartTargetSpaceByNoteId[note.clientId];
      return {
        ...note,
        targetSpaceId: typeof overridden === "string" ? overridden : null,
      };
    });
    return { ...loreSmartReview.plan, notes };
  }, [loreSmartReview, loreSmartTargetSpaceByNoteId]);
  useEffect(() => {
    if (!loreSmartReview || !isUuidLike(activeSpaceId)) {
      setLoreSmartSpaceSearchResults([]);
      return;
    }
    const ctrl = new AbortController();
    const query = loreSmartSpaceSearchQuery.trim();
    if (query.length > 0 && query.length < LORE_SMART_SPACE_SEARCH_MIN_QUERY) {
      setLoreSmartSpaceSearchResults([]);
      return;
    }
    const params = new URLSearchParams({
      scope: loreSmartImportScope,
      rootSpaceId: activeSpaceId,
      limit: query.length > 0 ? "50" : "20",
    });
    if (query) params.set("q", query);
    const timer = window.setTimeout(() => {
      void fetch(`/api/spaces/search?${params.toString()}`, {
        signal: ctrl.signal,
      })
        .then(async (res) => {
          const body = (await res.json()) as {
            ok?: boolean;
            spaces?: Array<{ spaceId?: string; title?: string; path?: string }>;
          };
          if (!res.ok || !body.ok || !Array.isArray(body.spaces)) return;
          setLoreSmartSpaceSearchResults(
            body.spaces
              .filter((row): row is { spaceId: string; title: string; path: string } =>
                typeof row.spaceId === "string" &&
                typeof row.title === "string" &&
                typeof row.path === "string",
              )
              .slice(0, 80),
          );
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) return;
        });
    }, LORE_SMART_SPACE_SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [activeSpaceId, loreSmartImportScope, loreSmartReview, loreSmartSpaceSearchQuery]);
  const cancelLoreSmartPlanning = useCallback(() => {
    const ctrl = loreSmartPlanningAbortRef.current;
    if (ctrl) {
      ctrl.abort();
      loreSmartPlanningAbortRef.current = null;
    }
    const currentJobId = loreSmartPlanningJobId;
    const currentSpaceId = activeSpaceIdRef.current;
    if (currentJobId && isUuidLike(currentSpaceId)) {
      void fetch(`/api/lore/import/jobs/${currentJobId}?spaceId=${encodeURIComponent(currentSpaceId)}`, {
        method: "DELETE",
        headers: { "X-Heartgarden-Import-Attempt": "client-cancel" },
      }).catch(() => {});
    }
    setLoreSmartPlanningJobId(null);
    setLoreSmartPlanning(false);
    setLoreSmartPlanningProgress(null);
    loreSmartPlanningStartedAtRef.current = null;
    setLoreSmartPlanningEvents([]);
    setLoreSmartPlanningDetailsOpen(false);
    loreSmartPlanningAttemptRef.current = null;
  }, [loreSmartPlanningJobId]);
  const [loreSmartPlanningCopyState, setLoreSmartPlanningCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const loreSmartPlanningEventGroups = useMemo(() => {
    const groups: Array<{ phase: string; label: string; events: LoreImportJobEvent[] }> = [];
    for (const event of loreSmartPlanningEvents) {
      const phase = String(event.phase ?? "").trim() || "general";
      const label = phase === "general" ? "General" : toHumanPhaseLabel(phase);
      const existing = groups.find((g) => g.phase === phase);
      if (existing) {
        existing.events.push(event);
      } else {
        groups.push({ phase, label, events: [event] });
      }
    }
    return groups;
  }, [loreSmartPlanningEvents]);
  useEffect(() => {
    if (loreSmartPlanningUi.failed) {
      setLoreSmartPlanningDetailsOpen(true);
    }
  }, [loreSmartPlanningUi.failed]);
  useEffect(() => {
    if (loreSmartPlanningCopyState === "idle") return;
    const t = setTimeout(() => setLoreSmartPlanningCopyState("idle"), 1800);
    return () => clearTimeout(t);
  }, [loreSmartPlanningCopyState]);
  useEffect(() => {
    if (!loreSmartPlanning && !loreSmartReview) return;
    const onGlobalEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (loreSmartPlanning) {
        cancelLoreSmartPlanning();
        return;
      }
      if (loreSmartReview) {
        closeLoreSmartReview();
      }
    };
    window.addEventListener("keydown", onGlobalEsc, true);
    return () => window.removeEventListener("keydown", onGlobalEsc, true);
  }, [cancelLoreSmartPlanning, closeLoreSmartReview, loreSmartPlanning, loreSmartReview]);
  const loreSmartQuestionUi = useMemo(() => {
    if (!loreSmartReview) {
      return {
        requiredTotal: 0,
        requiredAnswered: 0,
        optionalAnswered: 0,
        requiredPending: 0,
        percent: 0,
        barPercent: 0,
        ordered: [] as LoreImportClarificationItem[],
        stableQuestionOrder: [] as LoreImportClarificationItem[],
        focusQuestion: null as LoreImportClarificationItem | null,
        questionsComplete: false,
        answeredCount: 0,
        totalQuestions: 0,
        wizardBarPercent: 0,
      };
    }
    const clarifications = loreSmartReview.plan.clarifications;
    const byId = new Map(loreSmartClarificationAnswers.map((a) => [a.clarificationId, a]));
    const required = clarifications.filter((c) => c.severity === "required");
    const requiredAnswered = required.filter((c) => isClarificationAnswered(byId.get(c.id))).length;
    const optionalAnswered = clarifications.filter(
      (c) => c.severity === "optional" && isClarificationAnswered(byId.get(c.id)),
    ).length;
    const requiredTotal = required.length;
    const requiredPending = requiredTotal - requiredAnswered;
    const percent = requiredTotal > 0 ? Math.round((requiredAnswered / requiredTotal) * 100) : 100;
    const barPercent =
      requiredTotal === 0
        ? 100
        : requiredAnswered >= requiredTotal
          ? 100
          : requiredAnswered === 0
            ? 0
            : Math.max(percent, 8);
    const ordered = [...clarifications].sort((a, b) => {
      const aAnswered = isClarificationAnswered(byId.get(a.id));
      const bAnswered = isClarificationAnswered(byId.get(b.id));
      if (aAnswered !== bAnswered) return aAnswered ? 1 : -1;
      const c = clarificationConfidenceScore(a) - clarificationConfidenceScore(b);
      if (Math.abs(c) > 0.001) return c;
      if (a.severity !== b.severity) return a.severity === "required" ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
    const stableQuestionOrder = [...clarifications].sort((a, b) => {
      const c = clarificationConfidenceScore(a) - clarificationConfidenceScore(b);
      if (Math.abs(c) > 0.001) return c;
      if (a.severity !== b.severity) return a.severity === "required" ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
    const answeredCount = clarifications.filter((c) => isClarificationAnswered(byId.get(c.id))).length;
    const totalQuestions = clarifications.length;
    const defaultFocusQuestion =
      totalQuestions === 0
        ? null
        : stableQuestionOrder.find((c) => !isClarificationAnswered(byId.get(c.id))) ?? null;
    const focusQuestion =
      loreSmartManualQuestionId == null
        ? defaultFocusQuestion
        : stableQuestionOrder.find((c) => c.id === loreSmartManualQuestionId) ?? defaultFocusQuestion;
    const questionsComplete =
      totalQuestions > 0 && clarifications.every((c) => isClarificationAnswered(byId.get(c.id)));
    const wizardBarPercentRaw =
      totalQuestions === 0 ? 100 : Math.round((answeredCount / totalQuestions) * 100);
    const wizardBarPercent =
      totalQuestions === 0
        ? 100
        : answeredCount >= totalQuestions
          ? 100
          : answeredCount === 0
            ? 0
            : Math.max(wizardBarPercentRaw, 6);
    return {
      requiredTotal,
      requiredAnswered,
      optionalAnswered,
      requiredPending,
      percent,
      barPercent,
      ordered,
      stableQuestionOrder,
      focusQuestion,
      questionsComplete,
      answeredCount,
      totalQuestions,
      wizardBarPercent,
    };
  }, [loreSmartClarificationAnswers, loreSmartManualQuestionId, loreSmartReview]);
  const [loreReviewPanelOpen, setLoreReviewPanelOpen] = useState(false);
  const [loreReviewLoading, setLoreReviewLoading] = useState(false);
  const [loreReviewError, setLoreReviewError] = useState<string | null>(null);
  const [loreReviewIssues, setLoreReviewIssues] = useState<VaultReviewIssue[]>([]);
  const [loreReviewSuggestedTags, setLoreReviewSuggestedTags] = useState<string[]>([]);
  const [loreReviewSemanticSummary, setLoreReviewSemanticSummary] = useState<string | null>(null);
  const [loreImportFailure, setLoreImportFailure] = useState<LoreImportFailureDetail | null>(null);
  const [loreImportPopoverOpen, setLoreImportPopoverOpen] = useState(false);
  const [loreImportPreparedSource, setLoreImportPreparedSource] = useState<LoreImportPreparedSource | null>(
    null,
  );
  const [loreImportSelection, setLoreImportSelection] = useState<LoreImportSelectionState>({
    mode: "many_loose",
    scope: "current_subtree",
    contextText: "",
  });
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
  const beginLoreImportFilePick = useCallback(() => {
    setLoreImportPopoverOpen(false);
    loreImportFileInputRef.current?.click();
  }, []);
  const closeLoreImportPopover = useCallback(() => {
    setLoreImportPopoverOpen(false);
  }, []);
  const copyLoreSmartPlanningFailure = useCallback(() => {
    const failure = loreImportFailure;
    const progress = loreSmartPlanningProgress;
    const payload = failure
      ? formatLoreImportFailureReport(failure)
      : `Smart import planning failed\n---\nphase: ${progress?.phase ?? "unknown"}\nmessage: ${
          progress?.message ?? "(no message)"
        }\nmeta: ${JSON.stringify(progress?.meta ?? {}, null, 2)}`;
    if (!payload) return;
    void navigator.clipboard.writeText(payload).then(
      () => setLoreSmartPlanningCopyState("copied"),
      () => setLoreSmartPlanningCopyState("failed"),
    );
  }, [loreImportFailure, loreSmartPlanningProgress]);
  const retryLoreSmartPlanning = useCallback(() => {
    setLoreImportFailure(null);
    setLoreSmartPlanningJobId(null);
    setLoreSmartPlanning(false);
    setLoreSmartPlanningProgress(null);
    loreSmartPlanningStartedAtRef.current = null;
    setLoreSmartPlanningEvents([]);
    setLoreSmartPlanningDetailsOpen(false);
    setLoreSmartPlanningCopyState("idle");
    requestAnimationFrame(() => {
      beginLoreImportFilePick();
    });
  }, [beginLoreImportFilePick]);
  const closeLoreSmartPlanningFailure = useCallback(() => {
    setLoreImportFailure(null);
    setLoreSmartPlanningJobId(null);
    setLoreSmartPlanning(false);
    setLoreSmartPlanningProgress(null);
    loreSmartPlanningStartedAtRef.current = null;
    setLoreSmartPlanningEvents([]);
    setLoreSmartPlanningDetailsOpen(false);
    setLoreSmartPlanningCopyState("idle");
  }, []);
  const [galleryNodeId, setGalleryNodeId] = useState<string | null>(null);
  const galleryNodeIdRef = useRef<string | null>(null);
  const [galleryDraftTitle, setGalleryDraftTitle] = useState("");
  const [galleryDraftNotesDoc, setGalleryDraftNotesDoc] = useState<JSONContent>(() =>
    structuredClone(EMPTY_HG_DOC),
  );
  const [galleryDraftNotesDocKey, setGalleryDraftNotesDocKey] = useState(() =>
    jsonStableStringify(EMPTY_HG_DOC),
  );
  const [galleryBaselineTitle, setGalleryBaselineTitle] = useState("");
  const [galleryBaselineNotesDoc, setGalleryBaselineNotesDoc] = useState<JSONContent>(() =>
    structuredClone(EMPTY_HG_DOC),
  );
  const [galleryBaselineNotesDocKey, setGalleryBaselineNotesDocKey] = useState(() =>
    jsonStableStringify(EMPTY_HG_DOC),
  );
  const [galleryDimsLabel, setGalleryDimsLabel] = useState("— × —");
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [focusTitle, setFocusTitle] = useState("");
  const [focusBody, setFocusBody] = useState("");
  /** TipTap JSON for hgDoc focus editor; lore hybrid focus uses `focusBody` HTML + `focus-lore-notes` surface. */
  const [focusBodyDoc, setFocusBodyDoc] = useState<JSONContent>(() => structuredClone(EMPTY_HG_DOC));
  const [focusBodyDocKey, setFocusBodyDocKey] = useState(() => jsonStableStringify(EMPTY_HG_DOC));
  const [focusBaselineTitle, setFocusBaselineTitle] = useState("");
  const [focusBaselineBody, setFocusBaselineBody] = useState("");
  const [focusBaselineBodyDoc, setFocusBaselineBodyDoc] = useState<JSONContent>(() =>
    structuredClone(EMPTY_HG_DOC),
  );
  const [focusBaselineBodyDocKey, setFocusBaselineBodyDocKey] = useState(() =>
    jsonStableStringify(EMPTY_HG_DOC),
  );
  const [focusBaselineFactionRoster, setFocusBaselineFactionRoster] = useState<FactionRosterEntry[]>(
    [],
  );
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [hoveredStackTargetId, setHoveredStackTargetId] = useState<string | null>(null);
  const [parentDropHovered, setParentDropHovered] = useState(false);
  const parentDropHoveredRef = useRef(false);
  const dragPointerScreenRef = useRef({ x: 0, y: 0 });
  const setParentDropHover = useCallback((next: boolean) => {
    parentDropHoveredRef.current = next;
    setParentDropHovered(next);
  }, []);

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
  const [canvasEmptyContextMenu, setCanvasEmptyContextMenu] = useState<ContextMenuPosition>(null);
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
  const viewportSizeRef = useRef({ width: 0, height: 0 });
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
  /** Incremented on each `enterSpace` so stale `fetchBootstrap` completions are ignored. */
  const spaceNavGenerationRef = useRef(0);
  const viewportToastCooldownUntilRef = useRef(0);
  const activeSpaceIdRef = useRef(activeSpaceId);
  const navigationPathRef = useRef(navigationPath);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const connectionSourceIdRef = useRef<string | null>(null);
  const connectionRosterAnchorRef = useRef<{ factionNodeId: string; rosterEntryId: string } | null>(
    null,
  );
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
  /** Latest space + pan for debounced localStorage write (avoids stale closure writing wrong space). */
  const cameraPersistSnapshotRef = useRef<{
    spaceId: string;
    tx: number;
    ty: number;
    zoom: number;
  }>({ spaceId: ROOT_SPACE_ID, tx: 0, ty: 0, zoom: 1 });
  const itemServerUpdatedAtRef = useRef<Map<string, string>>(new Map());
  /** Item ids with an in-flight create request; PATCH waits for create to settle. */
  const pendingCreatePromisesRef = useRef<Map<string, Promise<void>>>(new Map());
  /** While undo restores a deleted row, collab merge must not tombstone it before POST /items completes. */
  const remoteTombstoneExemptIdsRef = useRef<Set<string>>(new Set());
  const syncCursorRef = useRef<string>(new Date(0).toISOString());
  /** Fingerprint of last merged server `item_links` graph — detects remote edge changes for toast. */
  const pollGraphEdgesSigRef = useRef<string | null>(null);
  /** Matches `GET …/changes` + `GET …/graph` `itemLinksRevision` — skip full graph when unchanged. */
  const lastItemLinksRevisionRef = useRef<string | null>(null);
  const graphMergeQueueRef = useRef({
    debounceTimer: null as number | null,
    inFlight: false,
    rerun: false,
    pendingToast: false,
  });
  const mergeRemoteGraphEdgesImplRef = useRef<(showToastIfChanged: boolean) => Promise<void>>(
    async () => {},
  );
  const focusDirtyRef = useRef(false);
  const inlineContentDirtyIdsRef = useRef<Set<string>>(new Set());
  /** Item ids with an in-flight `apiPatchItem` (versioned PATCH from `patchItemWithVersion`). */
  const savingContentIdsRef = useRef<Set<string>>(new Set());
  /** Local ids protected from stale remote rows for a short optimistic window. */
  const optimisticProtectedIdsRef = useRef<Set<string>>(new Set());
  const optimisticProtectedTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastFormatRangeRef = useRef<Range | null>(null);

  useEffect(
    () => () => {
      for (const timer of itemContentPatchTimersRef.current.values()) {
        clearTimeout(timer);
        neonSyncUnbumpPending();
      }
      itemContentPatchTimersRef.current.clear();
    },
    [],
  );
  const [historyEpoch, setHistoryEpoch] = useState(0);

  graphRef.current = graph;
  viewRef.current = { scale, tx: translateX, ty: translateY };
  cameraPersistSnapshotRef.current = {
    spaceId: activeSpaceId,
    tx: translateX,
    ty: translateY,
    zoom: scale,
  };
  viewportSizeRef.current = viewportSize;
  maxZIndexRef.current = maxZIndex;
  stackModalRef.current = stackModal;
  stackDragRef.current = stackDrag;
  stackModalCardHeightsRef.current = stackModalCardHeights;
  activeSpaceIdRef.current = activeSpaceId;
  navigationPathRef.current = navigationPath;
  selectedNodeIdsRef.current = selectedNodeIds;
  draggedNodeIdsRef.current = draggedNodeIds;
  connectionSourceIdRef.current = connectionSourceId;
  focusOpenRef.current = focusOpen;
  galleryOpenRef.current = galleryOpen;
  paletteOpenRef.current = paletteOpen;
  lorePanelOpenRef.current = lorePanelOpen;
  activeNodeIdRef.current = activeNodeId;
  galleryNodeIdRef.current = galleryNodeId;
  itemConflictQueueRef.current = itemConflictQueue;

  useEffect(() => {
    setGalleryDraftNotesDocKey(jsonStableStringify(galleryDraftNotesDoc));
  }, [galleryDraftNotesDoc]);
  useEffect(() => {
    setGalleryBaselineNotesDocKey(jsonStableStringify(galleryBaselineNotesDoc));
  }, [galleryBaselineNotesDoc]);
  useEffect(() => {
    setFocusBodyDocKey(jsonStableStringify(focusBodyDoc));
  }, [focusBodyDoc]);
  useEffect(() => {
    setFocusBaselineBodyDocKey(jsonStableStringify(focusBaselineBodyDoc));
  }, [focusBaselineBodyDoc]);

  const modKeyHints = useModKeyHints();
  const recentPaletteTier: WorkspaceBootTierTag = workspaceCacheTierForNeonSession(heartgardenBootApi);
  const { items: recentItems, push: pushRecentItem, pruneIds: pruneRecentItems } =
    useRecentItems(recentPaletteTier);
  const { items: recentFolders, push: pushRecentFolder, pruneIds: pruneRecentFolders } =
    useRecentFolders(recentPaletteTier);

  useEffect(() => {
    if (loreCanvasBodyEditEntityId && !selectedNodeIds.includes(loreCanvasBodyEditEntityId)) {
      setLoreCanvasBodyEditEntityId(null);
    }
  }, [selectedNodeIds, loreCanvasBodyEditEntityId]);

  useEffect(() => {
    if (!pendingFolderTitleSelectId) return;
    let cancelled = false;
    let attempts = 0;
    const folderId = pendingFolderTitleSelectId;
    const tryFocusAndSelect = () => {
      if (cancelled) return;
      const escapedFolderId = folderId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const editor = shellRef.current?.querySelector<HTMLElement>(
        `[data-node-id="${escapedFolderId}"] [data-folder-title-editor="true"]`,
      );
      if (!editor) {
        if (attempts < 10) {
          attempts += 1;
          requestAnimationFrame(tryFocusAndSelect);
        } else {
          setPendingFolderTitleSelectId((current) => (current === folderId ? null : current));
        }
        return;
      }
      editor.focus({ preventScroll: true });
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      setPendingFolderTitleSelectId((current) => (current === folderId ? null : current));
    };
    requestAnimationFrame(tryFocusAndSelect);
    return () => {
      cancelled = true;
    };
  }, [pendingFolderTitleSelectId]);

  useEffect(() => {
    if (!connectionSourceId) connectionRosterAnchorRef.current = null;
  }, [connectionSourceId]);

  useEffect(() => {
    if (!threadRosterNotice) return;
    const t = window.setTimeout(() => setThreadRosterNotice(null), 6500);
    return () => window.clearTimeout(t);
  }, [threadRosterNotice]);

  useEffect(() => {
    if (!collabConnectionsNotice) return;
    const t = window.setTimeout(() => setCollabConnectionsNotice(null), 5500);
    return () => window.clearTimeout(t);
  }, [collabConnectionsNotice]);

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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Alt") return;
      setAltHeld(true);
      document.body.dataset.hgAltHeld = "1";
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Alt") return;
      setAltHeld(false);
      delete document.body.dataset.hgAltHeld;
      setAltGraphCard(null);
      setAltHighlightRect(null);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      delete document.body.dataset.hgAltHeld;
    };
  }, [setAltHighlightRect]);

  useEffect(() => {
    if (!altHeld || !activeBraneId) return;
    const CACHE_TTL_MS = 12_000;
    let raf = 0;
    let lastTerm: string | null = null;
    let mentionAbort: AbortController | null = null;
    let searchAbort: AbortController | null = null;
    const onMove = (e: PointerEvent) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        const hit = readWordUnderPointer(e.clientX, e.clientY);
        if (!hit) {
          lastTerm = null;
          mentionAbort?.abort();
          searchAbort?.abort();
          mentionAbort = null;
          searchAbort = null;
          setAltGraphCard(null);
          setAltHighlightRect(null);
          return;
        }
        const term = hit.word.toLowerCase();
        // Hot path: imperative DOM updates avoid per-frame React re-renders.
        setAltHighlightRect({
          left: hit.rect.left,
          top: hit.rect.top,
          width: Math.max(8, hit.rect.width),
          height: Math.max(8, hit.rect.height),
        });
        setAltGraphCardPos(hit.rect.left + 8, hit.rect.bottom + 8);
        if (term === lastTerm) {
          return;
        }
        lastTerm = term;
        setAltGraphCard({
          term,
          mentions: [],
          searchItems: [],
          loadingMentions: true,
          loadingSearch: true,
        });
        mentionAbort?.abort();
        searchAbort?.abort();

        const now = Date.now();
        const mentionCached = altMentionCacheRef.current.get(term);
        if (mentionCached && now - mentionCached.at < CACHE_TTL_MS) {
          setAltGraphCard((prev) =>
            prev && prev.term === term
              ? { ...prev, mentions: mentionCached.items, loadingMentions: false }
              : prev,
          );
        } else {
          mentionAbort = new AbortController();
        }

        const searchCacheKey = `${activeSpaceId || "__none__"}::${term}`;
        const searchCached = altSearchCacheRef.current.get(searchCacheKey);
        if (searchCached && now - searchCached.at < CACHE_TTL_MS) {
          setAltGraphCard((prev) =>
            prev && prev.term === term
              ? { ...prev, searchItems: searchCached.items, loadingSearch: false }
              : prev,
          );
        } else {
          searchAbort = new AbortController();
        }

        void (async () => {
          try {
            if (mentionAbort) {
              const mentionRes = await fetch(
                `/api/mentions?term=${encodeURIComponent(term)}&braneId=${encodeURIComponent(activeBraneId)}`,
                { signal: mentionAbort.signal },
              );
              const mentionData = (await mentionRes.json()) as {
                ok?: boolean;
                items?: Array<{
                  itemId: string;
                  title: string;
                  mentionCount: number;
                  snippet?: string | null;
                }>;
              };
              if (mentionData.ok) {
                const items = mentionData.items ?? [];
                altMentionCacheRef.current.set(term, { at: Date.now(), items });
                setAltGraphCard((prev) =>
                  prev && prev.term === term
                    ? { ...prev, mentions: items, loadingMentions: false }
                    : prev,
                );
              }
            }
          } catch {
            setAltGraphCard((prev) =>
              prev && prev.term === term ? { ...prev, loadingMentions: false } : prev,
            );
          }
        })();
        void (async () => {
          try {
            if (searchAbort) {
              const searchParams = new URLSearchParams();
              searchParams.set("q", term);
              searchParams.set("mode", "hybrid");
              searchParams.set("limit", "12");
              if (isUuidLike(activeSpaceId)) searchParams.set("spaceId", activeSpaceId);
              const searchRes = await fetch(`/api/search?${searchParams.toString()}`, {
                signal: searchAbort.signal,
              });
              const searchData = (await searchRes.json()) as {
                ok?: boolean;
                items?: Array<{ id: string; title?: string | null; itemType?: string | null }>;
              };
              if (searchData.ok) {
                const items = searchData.items ?? [];
                altSearchCacheRef.current.set(searchCacheKey, { at: Date.now(), items });
                setAltGraphCard((prev) =>
                  prev && prev.term === term
                    ? { ...prev, searchItems: items, loadingSearch: false }
                    : prev,
                );
              } else {
                setAltGraphCard((prev) =>
                  prev && prev.term === term
                    ? { ...prev, searchItems: [], loadingSearch: false }
                    : prev,
                );
              }
            }
          } catch {
            setAltGraphCard((prev) =>
              prev && prev.term === term ? { ...prev, loadingSearch: false } : prev,
            );
          }
        })();
      });
    };
    const onClick = (e: PointerEvent) => {
      if (!altHeld) return;
      const hit = readWordUnderPointer(e.clientX, e.clientY);
      if (!hit) {
        setAltGraphCard(null);
        setAltHighlightRect(null);
        return;
      }
      if (!graphOverlayOpen) setGraphOverlayOpen(true);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAltGraphCard(null);
      setAltHighlightRect(null);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerdown", onClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      mentionAbort?.abort();
      searchAbort?.abort();
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [activeBraneId, activeSpaceId, altHeld, graphOverlayOpen, setAltHighlightRect, setAltGraphCardPos]);

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

  const markOptimisticProtectedId = useCallback((id: string, ttlMs = 3500) => {
    optimisticProtectedIdsRef.current.add(id);
    const prevTimer = optimisticProtectedTimerRef.current.get(id);
    if (prevTimer) clearTimeout(prevTimer);
    const nextTimer = setTimeout(() => {
      optimisticProtectedTimerRef.current.delete(id);
      optimisticProtectedIdsRef.current.delete(id);
    }, ttlMs);
    optimisticProtectedTimerRef.current.set(id, nextTimer);
  }, []);

  const clearOptimisticProtectedId = useCallback((id: string) => {
    const prevTimer = optimisticProtectedTimerRef.current.get(id);
    if (prevTimer) clearTimeout(prevTimer);
    optimisticProtectedTimerRef.current.delete(id);
    optimisticProtectedIdsRef.current.delete(id);
  }, []);

  const enqueueItemConflict = useCallback((item: CanvasItem) => {
    markOptimisticProtectedId(item.id, 120_000);
    setItemConflictQueue((q) => {
      const deduped = q.filter((i) => i.id !== item.id);
      return [...deduped, item].slice(-8);
    });
  }, [markOptimisticProtectedId]);

  const resolveBaseUpdatedAt = useCallback(
    (itemId: string) => itemServerUpdatedAtRef.current.get(itemId),
    [],
  );

  const patchItemWithVersion = useCallback(
    async (itemId: string, patch: Record<string, unknown>) => {
      const pendingCreate = pendingCreatePromisesRef.current.get(itemId);
      if (pendingCreate) {
        await pendingCreate.catch(() => {});
      }
      if (!graphRef.current.entities[itemId]) return false;
      savingContentIdsRef.current.add(itemId);
      try {
        const patchOpts = {
          resolveBaseUpdatedAt: () => resolveBaseUpdatedAt(itemId),
        };
        const r = await apiPatchItem(itemId, patch, patchOpts);
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
            setGalleryDraftNotesDoc(structuredClone(EMPTY_HG_DOC));
            setGalleryBaselineTitle("");
            setGalleryBaselineNotesDoc(structuredClone(EMPTY_HG_DOC));
          }
          return false;
        }
        if (!r.ok && "conflict" in r && r.conflict) {
          const serverAt = r.item.updatedAt;
          if (typeof serverAt === "string" && serverAt.length > 0) {
            itemServerUpdatedAtRef.current.set(itemId, serverAt);
            const r2 = await apiPatchItem(itemId, { ...patch, baseUpdatedAt: serverAt });
            if (r2.ok) {
              if (r2.item.updatedAt) itemServerUpdatedAtRef.current.set(itemId, r2.item.updatedAt);
              return true;
            }
            if (!r2.ok && "conflict" in r2 && r2.conflict) {
              if (!patchTouchesItemContent(patch)) {
                setGraph((prev) => applyServerCanvasItemToGraph(prev, r2.item));
                if (r2.item.updatedAt) itemServerUpdatedAtRef.current.set(r2.item.id, r2.item.updatedAt);
                return false;
              }
              const serverAt3 = r2.item.updatedAt;
              if (typeof serverAt3 === "string" && serverAt3.length > 0) {
                itemServerUpdatedAtRef.current.set(itemId, serverAt3);
                const r3 = await apiPatchItem(itemId, { ...patch, baseUpdatedAt: serverAt3 });
                if (r3.ok) {
                  if (r3.item.updatedAt) itemServerUpdatedAtRef.current.set(itemId, r3.item.updatedAt);
                  return true;
                }
                if (!r3.ok && "conflict" in r3 && r3.conflict) {
                  if (r3.item.updatedAt) itemServerUpdatedAtRef.current.set(itemId, r3.item.updatedAt);
                }
              }
              enqueueItemConflict(r2.item);
              return false;
            }
          }
          if (!patchTouchesItemContent(patch)) {
            setGraph((prev) => applyServerCanvasItemToGraph(prev, r.item));
            if (r.item.updatedAt) itemServerUpdatedAtRef.current.set(r.item.id, r.item.updatedAt);
            return false;
          }
          enqueueItemConflict(r.item);
        }
        return false;
      } finally {
        savingContentIdsRef.current.delete(itemId);
      }
    },
    [enqueueItemConflict, pruneRecentFolders, pruneRecentItems, resolveBaseUpdatedAt],
  );

  const applyItemConflictFromServer = useCallback(() => {
    const it = itemConflictQueueRef.current[0];
    if (!it) return;
    clearOptimisticProtectedId(it.id);
    setGraph((prev) => applyServerCanvasItemToGraph(prev, it));
    if (it.updatedAt) itemServerUpdatedAtRef.current.set(it.id, it.updatedAt);
    queueMicrotask(() => {
      const e = graphRef.current.entities[it.id];
      if (e && e.kind === "content" && activeNodeIdRef.current === it.id) {
        const projected = projectBodyHtmlForFocus(e, e.bodyHtml);
        if (contentEntityUsesHgDoc(e)) {
          const doc = hgDocForContentEntity(e);
          setFocusBodyDoc(structuredClone(doc));
          setFocusBaselineBodyDoc(structuredClone(doc));
          setFocusBody("");
          setFocusBaselineBody("");
        } else {
          setFocusBody(projected);
          setFocusBaselineBody(projected);
        }
        setFocusTitle(e.title);
        setFocusBaselineTitle(e.title);
      }
    });
    setItemConflictQueue((q) => q.slice(1));
  }, [clearOptimisticProtectedId]);

  const schedulePersistContentBody = useCallback(
    (entityId: string) => {
      if (!persistNeonRef.current || !isUuidLike(entityId)) return;
      const prevT = itemContentPatchTimersRef.current.get(entityId);
      const isFirstTimerForEntity = !prevT;
      if (prevT) clearTimeout(prevT);
      if (isFirstTimerForEntity) neonSyncBumpPending();
      markOptimisticProtectedId(entityId, 8000);
      const t = setTimeout(() => {
        itemContentPatchTimersRef.current.delete(entityId);
        neonSyncUnbumpPending();
        const ent = graphRef.current.entities[entityId];
        if (!ent || ent.kind !== "content") {
          clearOptimisticProtectedId(entityId);
          return;
        }
        const clearAiMeta = isAiReviewPending(ent.entityMeta) && !contentEntityHasHgAiPending(ent);
        const patch: Record<string, unknown> = {
          contentText: contentPlainTextForEntity(ent),
          contentJson: buildContentJsonForContentEntity(ent),
        };
        if (clearAiMeta) {
          patch.entityMetaMerge = { aiReview: AI_REVIEW_CLEARED };
          setGraph((p) => {
            const cur = p.entities[entityId];
            if (!cur || cur.kind !== "content") return p;
            return {
              ...p,
              entities: {
                ...p.entities,
                [entityId]: {
                  ...cur,
                  entityMeta: { ...cur.entityMeta, aiReview: AI_REVIEW_CLEARED },
                },
              },
            };
          });
        }
        void patchItemWithVersion(entityId, patch);
      }, 450);
      itemContentPatchTimersRef.current.set(entityId, t);
    },
    [clearOptimisticProtectedId, markOptimisticProtectedId, patchItemWithVersion],
  );

  const keepLocalVersionForConflict = useCallback(() => {
    const serverItem = itemConflictQueueRef.current[0];
    if (!serverItem) return;
    clearOptimisticProtectedId(serverItem.id);
    if (serverItem.updatedAt) {
      itemServerUpdatedAtRef.current.set(serverItem.id, serverItem.updatedAt);
    }
    setItemConflictQueue((q) => q.slice(1));
    const ent = graphRef.current.entities[serverItem.id];
    if (ent && ent.kind === "content" && persistNeonRef.current && isUuidLike(serverItem.id)) {
      const patch: Record<string, unknown> = {
        title: ent.title,
        contentText: contentPlainTextForEntity(ent),
        contentJson: buildContentJsonForContentEntity(ent),
      };
      void patchItemWithVersion(serverItem.id, patch);
    }
  }, [clearOptimisticProtectedId, patchItemWithVersion]);

  const dismissConflictHead = useCallback(() => {
    const serverItem = itemConflictQueueRef.current[0];
    if (serverItem?.updatedAt) {
      itemServerUpdatedAtRef.current.set(serverItem.id, serverItem.updatedAt);
    }
    setItemConflictQueue((q) => q.slice(1));
    if (serverItem && persistNeonRef.current && isUuidLike(serverItem.id)) {
      clearOptimisticProtectedId(serverItem.id);
      const ent = graphRef.current.entities[serverItem.id];
      if (ent && ent.kind === "content") {
        schedulePersistContentBody(serverItem.id);
      }
    }
  }, [clearOptimisticProtectedId, schedulePersistContentBody]);

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
    const dimUpdates: { id: string; width: number; height: number }[] = [];
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
      const measured = measureArchitecturalNodePlacement(id, primary);
      const width = measured?.width ?? geo.width;
      const height = measured?.height ?? geo.height;
      if (measured) {
        const prevW =
          e.kind === "folder" ? e.width ?? FOLDER_CARD_WIDTH : e.width ?? UNIFIED_NODE_WIDTH;
        const prevH =
          e.kind === "folder" ? e.height ?? FOLDER_CARD_HEIGHT : e.height ?? 280;
        if (Math.abs(width - prevW) > 0.5 || Math.abs(height - prevH) > 0.5) {
          dimUpdates.push({ id, width, height });
        }
      }
      const patch: Record<string, unknown> = {
        spaceId: primary,
        x: geo.x,
        y: geo.y,
        width,
        height,
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
    if (dimUpdates.length > 0) {
      setGraph((prev) => {
        const next = shallowCloneGraph(prev);
        for (const { id, width, height } of dimUpdates) {
          const ent = next.entities[id];
          if (ent) next.entities[id] = { ...ent, width, height };
        }
        return next;
      });
    }
    persistNeonFolderInnerSpaceParentsAfterLayout(ids, g);
  }, [patchItemWithVersion, persistNeonFolderInnerSpaceParentsAfterLayout, setGraph]);

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
        const projected = projectBodyHtmlForFocus(restored, restored.bodyHtml);
        if (contentEntityUsesHgDoc(restored)) {
          const doc = hgDocForContentEntity(restored);
          setFocusBodyDoc(structuredClone(doc));
          setFocusBaselineBodyDoc(structuredClone(doc));
          setFocusBody("");
          setFocusBaselineBody("");
        } else {
          setFocusBody(projected);
          setFocusBaselineBody(projected);
        }
        setFocusBaselineTitle(restored.title);
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
        const projected = projectBodyHtmlForFocus(restored, restored.bodyHtml);
        if (contentEntityUsesHgDoc(restored)) {
          const doc = hgDocForContentEntity(restored);
          setFocusBodyDoc(structuredClone(doc));
          setFocusBaselineBodyDoc(structuredClone(doc));
          setFocusBody("");
          setFocusBaselineBody("");
        } else {
          setFocusBody(projected);
          setFocusBaselineBody(projected);
        }
        setFocusBaselineTitle(restored.title);
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
    const key = findHgDocSurfaceKeyFromSelection();
    const api = key ? getHgDocEditor(key) : null;
    if (api?.undo()) {
      playVigilUiSound("tap");
      return;
    }
    if (undoPastRef.current.length === 0) return;
    undo();
    playVigilUiSound("tap");
  }, [undo]);

  const redoFromDock = useCallback(() => {
    const key = findHgDocSurfaceKeyFromSelection();
    const api = key ? getHgDocEditor(key) : null;
    if (api?.redo()) {
      playVigilUiSound("tap");
      return;
    }
    if (undoFutureRef.current.length === 0) return;
    redo();
    playVigilUiSound("tap");
  }, [redo]);

  void historyEpoch;
  const canUndo =
    undoPastRef.current.length > 0 ||
    !!getHgDocEditor("focus-body")?.canUndo?.() ||
    !!getHgDocEditor("focus-lore-notes")?.canUndo?.() ||
    !!getHgDocEditor("gallery-notes")?.canUndo?.() ||
    (selectedNodeIds.length === 1
      ? !!getHgDocEditor(`canvas-${selectedNodeIds[0]!}`)?.canUndo?.()
      : false);
  const canRedo =
    undoFutureRef.current.length > 0 ||
    !!getHgDocEditor("focus-body")?.canRedo?.() ||
    !!getHgDocEditor("focus-lore-notes")?.canRedo?.() ||
    !!getHgDocEditor("gallery-notes")?.canRedo?.() ||
    (selectedNodeIds.length === 1
      ? !!getHgDocEditor(`canvas-${selectedNodeIds[0]!}`)?.canRedo?.()
      : false);

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
    async (connectionId: string, snapIn?: CanvasPinConnection) => {
      /** `graphRef` tracks last *rendered* graph; right after `setGraph` the new connection is not in the ref yet. */
      const snap = snapIn ?? graphRef.current.connections[connectionId];
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
    } catch (e) {
      neonSyncReportAuxiliaryFailure({
        operation: "DELETE /api/item-links",
        message: e instanceof Error ? e.message : "Network error",
        cause: "network",
      });
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

  /**
   * Sets `item_links.link_type` on a thread. If the new `linkType` maps to a
   * canonical picker kind (`pin`, `bond`, `affiliation`, `contract`,
   * `conflict`, `history`), ALSO recolor the thread to that kind's signature
   * color so color + link_type stay locked.
   */
  const setConnectionLinkType = useCallback(
    (connectionId: string, linkType: string) => {
      const cur = graphRef.current.connections[connectionId];
      if (!cur) return;
      const currentLt = cur.linkType ?? "pin";
      const kind = CONNECTION_KINDS_IN_ORDER.find((k) => linkTypeForConnectionKind(k) === linkType);
      const nextColor = kind ? colorForConnectionKind(kind) : null;
      const colorChanges = nextColor !== null && cur.color !== nextColor;
      const linkTypeChanges = currentLt !== linkType;
      if (!colorChanges && !linkTypeChanges) return;
      recordUndoBeforeMutation();
      const patch: { linkType?: string; color?: string } = {};
      if (linkTypeChanges) patch.linkType = linkType;
      if (colorChanges && nextColor) patch.color = nextColor;
      setConnectionSyncPatch(connectionId, patch);
      if (linkTypeChanges) void syncLinkTypeConnection(connectionId, linkType);
      if (colorChanges && nextColor) void syncColorConnection(connectionId, nextColor);
    },
    [recordUndoBeforeMutation, setConnectionSyncPatch, syncColorConnection, syncLinkTypeConnection],
  );

  const createConnection = useCallback(
    (
      sourceEntityId: string,
      targetEntityId: string,
      opts?: { skipUndo?: boolean },
    ) => {
      const connectionId = createId();
      if (!opts?.skipUndo) recordUndoBeforeMutation();
      const prev = graphRef.current;
      if (
        !prev.entities[sourceEntityId] ||
        !prev.entities[targetEntityId] ||
        sourceEntityId === targetEntityId
      ) {
        return;
      }
      const now = Date.now();
      const newConnection: CanvasPinConnection = {
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
        linkType: linkTypeForConnectionKind(connectionKind),
        slackMultiplier: DEFAULT_LINK_SLACK_MULTIPLIER,
        createdAt: now,
        updatedAt: now,
        syncState: "local-only",
        syncError: null,
      };
      setGraph((p) => {
        if (!p.entities[sourceEntityId] || !p.entities[targetEntityId] || sourceEntityId === targetEntityId)
          return p;
        const next = shallowCloneGraph(p);
        next.connections[connectionId] = newConnection;
        return next;
      });
      void syncCreateConnection(connectionId, newConnection);
    },
    [connectionColor, connectionKind, createId, recordUndoBeforeMutation, syncCreateConnection],
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

  /**
   * Recolor a thread. The new `color` snaps to the nearest picker kind and we
   * write BOTH the canonical color AND its `link_type` so color + kind stay
   * locked (see `connection-kind-colors.ts`).
   */
  const recolorConnection = useCallback(
    (connectionId: string, color: string) => {
      const current = graphRef.current.connections[connectionId];
      if (!current) return;
      const kind = snapColorToConnectionKind(color);
      const { color: canonicalColor, linkType: canonicalLinkType } = canonicalPairForKind(kind);
      const colorChanges = current.color !== canonicalColor;
      const linkTypeChanges = (current.linkType ?? "pin") !== canonicalLinkType;
      if (!colorChanges && !linkTypeChanges) return;
      recordUndoBeforeMutation();
      const patch: { color?: string; linkType?: string } = {};
      if (colorChanges) patch.color = canonicalColor;
      if (linkTypeChanges) patch.linkType = canonicalLinkType;
      setConnectionSyncPatch(connectionId, patch);
      if (colorChanges) void syncColorConnection(connectionId, canonicalColor);
      if (linkTypeChanges) void syncLinkTypeConnection(connectionId, canonicalLinkType);
    },
    [
      recordUndoBeforeMutation,
      setConnectionSyncPatch,
      syncColorConnection,
      syncLinkTypeConnection,
    ],
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

  /**
   * Picker change: set the active kind for NEW threads, and — when exactly
   * two cards are selected — retcon all threads BETWEEN those two cards to
   * the canonical (color, link_type) pair for the picked kind.
   */
  const applyConnectionKind = useCallback(
    (nextKind: ConnectionKind) => {
      setConnectionKind(nextKind);
      const selected = selectedNodeIdsRef.current;
      if (selected.length !== 2) return;
      const [a, b] = selected;
      const nextColor = colorForConnectionKind(nextKind);
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

  /**
   * Legacy thread migration: any connection whose (color, link_type) isn't a
   * canonical picker pair gets snapped to the nearest kind and rewritten with
   * the canonical pair. Runs once per connection id (tracked via ref) and
   * skips undo so the history stack stays meaningful. Only fires after
   * bootstrap has resolved to avoid racing with the initial graph hydrate.
   */
  const migratedConnectionIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (scenario === "default" && !canvasBootstrapResolved) return;
    const seen = migratedConnectionIdsRef.current;
    const patches: Array<{ id: string; color: string; linkType: string }> = [];
    for (const conn of Object.values(graph.connections)) {
      if (seen.has(conn.id)) continue;
      seen.add(conn.id);
      if (isCanonicalConnectionPair({ color: conn.color, linkType: conn.linkType })) continue;
      const kind = canonicalKindForConnection({ color: conn.color, linkType: conn.linkType });
      const pair = canonicalPairForKind(kind);
      if (conn.color === pair.color && (conn.linkType ?? "pin") === pair.linkType) continue;
      patches.push({ id: conn.id, color: pair.color, linkType: pair.linkType });
    }
    if (patches.length === 0) return;
    for (const p of patches) {
      const current = graphRef.current.connections[p.id];
      if (!current) continue;
      const colorChanged = current.color !== p.color;
      const linkTypeChanged = (current.linkType ?? "pin") !== p.linkType;
      if (!colorChanged && !linkTypeChanged) continue;
      const patch: { color?: string; linkType?: string } = {};
      if (colorChanged) patch.color = p.color;
      if (linkTypeChanged) patch.linkType = p.linkType;
      setConnectionSyncPatch(p.id, patch);
      if (colorChanged) void syncColorConnection(p.id, p.color);
      if (linkTypeChanged) void syncLinkTypeConnection(p.id, p.linkType);
    }
  }, [
    graph.connections,
    scenario,
    canvasBootstrapResolved,
    setConnectionSyncPatch,
    syncColorConnection,
    syncLinkTypeConnection,
  ]);

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
      const { width: vw, height: vh } = viewportSizeRef.current;
      const worldRectCullSim =
        vw > 0 && vh > 0
          ? worldRectFromViewport(tx, ty, pinScale, vw, vh, CULL_MARGIN_WORLD)
          : { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
      const cullExcSim = buildCullExceptionEntityIds({
        selectedNodeIds: selectedNodeIdsRef.current,
        draggedNodeIds: draggedNodeIdsRef.current,
        connectionSourceId: connectionSourceIdRef.current,
      });
      Object.values(graphSnap.connections).forEach((connection) => {
        const source = graphSnap.entities[connection.sourceEntityId];
        const target = graphSnap.entities[connection.targetEntityId];
        if (!source || !target) return;
        if (!source.slots[spaceId] || !target.slots[spaceId]) return;
        if (
          vw > 0 &&
          vh > 0 &&
          !connectionIntersectsWorldRect(connection, graphSnap, spaceId, worldRectCullSim, cullExcSim)
        ) {
          return;
        }
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
    if (!paletteOpen) return EMPTY_PALETTE_ITEMS;
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
  }, [paletteOpen, activeSpaceId, graph.entities, graph.spaces]);

  const paletteSpaces = useMemo<PaletteSpace[]>(() => {
    if (!paletteOpen) return EMPTY_PALETTE_SPACES;
    return Object.values(graph.spaces).map((space) => {
      const path = buildPathToSpace(space.id, graph.spaces, graph.rootSpaceId)
        .map((id) =>
          id === graph.rootSpaceId ? ROOT_SPACE_DISPLAY_NAME : graph.spaces[id]?.name ?? "Unknown",
        )
        .join(" / ");
      return { id: space.id, name: space.name, pathLabel: path };
    });
  }, [paletteOpen, graph.rootSpaceId, graph.spaces]);

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

  const minimapLayoutKey = useMemo(
    () => minimapLayoutSignature(graph, activeSpaceId),
    [graph, activeSpaceId],
  );

  useEffect(() => {
    const preActivateGate = scenario === "default" && !bootLayerDismissed && !canvasSessionActivated;
    if (
      focusOpen ||
      galleryOpen ||
      stackModal ||
      paletteOpen ||
      lorePanelOpen ||
      loreReviewPanelOpen ||
      preActivateGate
    ) {
      setViewportToastOpen(false);
      return;
    }
    const id = window.setTimeout(() => {
      const bounds = computeSpaceContentBounds(graph, activeSpaceId, collapsedStacks);
      if (!bounds) {
        setViewportToastOpen(false);
        return;
      }
      const vw = Math.max(1, viewportSize.width);
      const vh = Math.max(1, viewportSize.height);
      const vpRect = viewportWorldRect(translateX, translateY, scale, vw, vh);
      if (!isContentMostlyOffScreen(bounds, vpRect)) {
        setViewportToastOpen(false);
        return;
      }
      if (Date.now() < viewportToastCooldownUntilRef.current) return;
      setViewportToastOpen(true);
    }, 450);
    return () => window.clearTimeout(id);
  }, [
    activeSpaceId,
    bootLayerDismissed,
    canvasSessionActivated,
    collapsedStacks,
    focusOpen,
    galleryOpen,
    graph,
    lorePanelOpen,
    loreReviewPanelOpen,
    paletteOpen,
    scale,
    scenario,
    stackModal,
    translateX,
    translateY,
    viewportSize.height,
    viewportSize.width,
  ]);

  const cullExceptionEntityIds = useMemo(
    () =>
      buildCullExceptionEntityIds({
        selectedNodeIds,
        draggedNodeIds,
        connectionSourceId,
      }),
    [selectedNodeIds, draggedNodeIds, connectionSourceId],
  );

  const worldCullRect = useMemo(
    () =>
      worldRectFromViewport(
        translateX,
        translateY,
        scale,
        Math.max(1, viewportSize.width),
        Math.max(1, viewportSize.height),
        CULL_MARGIN_WORLD,
      ),
    [translateX, translateY, scale, viewportSize.width, viewportSize.height],
  );

  const visibleStandaloneEntities = useMemo(
    () =>
      standaloneEntities.filter((entity) =>
        entityIntersectsWorldRect(entity, activeSpaceId, worldCullRect, cullExceptionEntityIds),
      ),
    [standaloneEntities, activeSpaceId, worldCullRect, cullExceptionEntityIds],
  );

  const visibleCollapsedStacks = useMemo(
    () =>
      collapsedStacks.filter(({ entities }) =>
        collapsedStackIntersectsWorldRect(entities, activeSpaceId, worldCullRect, cullExceptionEntityIds),
      ),
    [collapsedStacks, activeSpaceId, worldCullRect, cullExceptionEntityIds],
  );

  const visibleActiveSpaceConnections = useMemo(
    () =>
      activeSpaceConnections.filter((connection) =>
        connectionIntersectsWorldRect(
          connection,
          graph,
          activeSpaceId,
          worldCullRect,
          cullExceptionEntityIds,
        ),
      ),
    [activeSpaceConnections, graph, activeSpaceId, worldCullRect, cullExceptionEntityIds],
  );

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

  const collapsedStacksRef = useRef(collapsedStacks);
  const selectedNodeIdsForBoundsRef = useRef(selectedNodeIds);
  useEffect(() => {
    collapsedStacksRef.current = collapsedStacks;
  }, [collapsedStacks]);
  useEffect(() => {
    selectedNodeIdsForBoundsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  useEffect(() => {
    const collapsedForBounds = collapsedStacksRef.current;
    const selectedForBounds = selectedNodeIdsForBoundsRef.current;
    if (collapsedForBounds.length === 0) {
      setStackFocusBoundsById((prev) =>
        Object.keys(prev).length === 0 ? prev : EMPTY_STACK_BOUNDS,
      );
      return;
    }
    const next: Record<string, { left: number; top: number; width: number; height: number }> = {};
    const domRoot: ParentNode = shellRef.current ?? document;
    collapsedForBounds.forEach(({ stackId, entities }) => {
      const selected = entities.some((entity) => selectedForBounds.includes(entity.id));
      if (!selected) return;
      const container = domRoot.querySelector<HTMLElement>(
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
  }, [stackFocusBoundsEffectKey]);

  useEffect(() => {
    const collapsedForBounds = collapsedStacksRef.current;
    if (collapsedForBounds.length === 0) {
      setStackHoverBoundsById((prev) =>
        Object.keys(prev).length === 0 ? prev : EMPTY_STACK_BOUNDS,
      );
      return;
    }
    const next: Record<string, { left: number; top: number; width: number; height: number }> = {};
    const domRoot: ParentNode = shellRef.current ?? document;
    collapsedForBounds.forEach(({ stackId }) => {
      const container = domRoot.querySelector<HTMLElement>(
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
          const nextHtml = canonicalizeCharacterBodyHtml(entity, normalizedHtml);
          if (entity.bodyHtml === nextHtml) return;
          recordUndoBeforeMutation();
          setGraph((p) => {
            const e = p.entities[id];
            if (!e || e.kind !== "content") return p;
            const nextHtmlInner = canonicalizeCharacterBodyHtml(e, normalizedHtml);
            if (e.bodyHtml === nextHtmlInner) return p;
            return {
              ...p,
              entities: {
                ...p.entities,
                [id]: { ...e, bodyHtml: nextHtmlInner, bodyDoc: undefined },
              },
            };
          });
          schedulePersistContentBody(id);
        },
        options?.immediate ? 0 : 120,
      );
    },
    [queueGraphCommit, recordUndoBeforeMutation, schedulePersistContentBody],
  );

  const updateNodeHgDoc = useCallback(
    (id: string, doc: JSONContent, options?: { immediate?: boolean }) => {
      const html = hgDocToHtml(doc);
      queueGraphCommit(
        `content-body:${id}`,
        () => {
          const entity = graphRef.current.entities[id];
          if (!entity || entity.kind !== "content") return;
          const nextDocKey = jsonStableStringify(doc);
          const entityDocKey = jsonStableStringify(entity.bodyDoc);
          if (entityDocKey === nextDocKey && entity.bodyHtml === html)
            return;
          recordUndoBeforeMutation();
          setGraph((p) => {
            const e = p.entities[id];
            if (!e || e.kind !== "content") return p;
            const currentDocKey = jsonStableStringify(e.bodyDoc);
            if (currentDocKey === nextDocKey && e.bodyHtml === html) return p;
            return {
              ...p,
              entities: {
                ...p.entities,
                [id]: { ...e, bodyDoc: doc, bodyHtml: html },
              },
            };
          });
          schedulePersistContentBody(id);
        },
        options?.immediate ? 0 : 120,
      );
    },
    [queueGraphCommit, recordUndoBeforeMutation, schedulePersistContentBody],
  );

  const handleNodeBodyCommit = useCallback(
    (id: string, payload: CanvasBodyCommitPayload) => {
      if (payload.kind === "hgDoc") {
        updateNodeHgDoc(id, payload.doc);
      } else {
        updateNodeBody(id, payload.html);
      }
    },
    [updateNodeBody, updateNodeHgDoc],
  );

  const updateFactionRoster = useCallback(
    (entityId: string, roster: FactionRosterEntry[]) => {
      const ent = graphRef.current.entities[entityId];
      if (!ent || ent.kind !== "content" || ent.loreCard?.kind !== "faction") return;
      const prev = ent.factionRoster ?? [];
      if (JSON.stringify(prev) === JSON.stringify(roster)) return;
      recordUndoBeforeMutation();
      setGraph((p) => {
        const cur = p.entities[entityId];
        if (!cur || cur.kind !== "content" || cur.loreCard?.kind !== "faction") return p;
        return {
          ...p,
          entities: {
            ...p.entities,
            [entityId]: { ...cur, factionRoster: roster },
          },
        };
      });
      if (focusOpenRef.current && activeNodeIdRef.current === entityId) {
        setFocusBaselineFactionRoster(roster);
      }
      const merged = { ...ent, factionRoster: roster } as CanvasContentEntity;
      void patchItemWithVersion(entityId, {
        contentText: contentPlainTextForEntity(merged),
        contentJson: buildContentJsonForContentEntity(merged),
      });
    },
    [patchItemWithVersion, recordUndoBeforeMutation],
  );

  const acceptAiReviewForEntity = useCallback(
    (entityId: string) => {
      const ent = graphRef.current.entities[entityId];
      if (!ent || ent.kind !== "content") return;
      const docPending = ent.bodyDoc != null && hgDocJsonHasHgAiPending(ent.bodyDoc);
      const htmlPending = htmlStringHasHgAiPending(ent.bodyHtml);
      const hasPendingMarkup = docPending || htmlPending;
      if (!hasPendingMarkup) {
        if (!isAiReviewPending(ent.entityMeta)) return;
        setGraph((p) => {
          const cur = p.entities[entityId];
          if (!cur || cur.kind !== "content") return p;
          return {
            ...p,
            entities: {
              ...p.entities,
              [entityId]: {
                ...cur,
                entityMeta: { ...cur.entityMeta, aiReview: AI_REVIEW_CLEARED },
              },
            },
          };
        });
        void patchItemWithVersion(entityId, {
          entityMetaMerge: { aiReview: AI_REVIEW_CLEARED },
        });
        return;
      }
      recordUndoBeforeMutation();
      const useHg = contentEntityUsesHgDoc(ent);
      let nextDoc: JSONContent | null | undefined = ent.bodyDoc;
      let nextHtml = ent.bodyHtml;
      if (docPending && useHg && ent.bodyDoc) {
        nextDoc = stripHgAiPendingFromHgDocJson(structuredClone(ent.bodyDoc));
        nextHtml = hgDocToHtml(nextDoc);
      } else if (htmlPending) {
        nextHtml = stripHgAiPendingFromHtml(ent.bodyHtml);
        nextDoc = useHg ? htmlFragmentToHgDocDoc(nextHtml) : undefined;
      } else {
        if (ent.bodyDoc) {
          nextDoc = stripHgAiPendingFromHgDocJson(structuredClone(ent.bodyDoc));
        }
        nextHtml = stripHgAiPendingFromHtml(ent.bodyHtml);
        nextDoc = undefined;
      }
      const merged: CanvasContentEntity = {
        ...ent,
        bodyDoc: useHg ? nextDoc ?? undefined : undefined,
        bodyHtml: nextHtml,
        entityMeta: { ...ent.entityMeta, aiReview: AI_REVIEW_CLEARED },
      };
      setGraph((p) => {
        const cur = p.entities[entityId];
        if (!cur || cur.kind !== "content") return p;
        return {
          ...p,
          entities: {
            ...p.entities,
            [entityId]: merged,
          },
        };
      });
      if (focusOpenRef.current && activeNodeIdRef.current === entityId) {
        if (contentEntityUsesHgDoc(merged)) {
          const doc = hgDocForContentEntity(merged);
          setFocusBodyDoc(structuredClone(doc));
          setFocusBaselineBodyDoc(structuredClone(doc));
        } else {
          const normalizedBody =
            merged.theme === "task"
              ? normalizeChecklistMarkup(merged.bodyHtml, {
                  taskItem: styles.taskItem,
                  taskCheckbox: styles.taskCheckbox,
                  taskText: styles.taskText,
                  done: styles.done,
                })
              : merged.bodyHtml;
          const projected = projectBodyHtmlForFocus(merged, normalizedBody);
          setFocusBody(projected);
          setFocusBaselineBody(projected);
        }
      }
      void patchItemWithVersion(entityId, {
        contentText: contentPlainTextForEntity(merged),
        contentJson: buildContentJsonForContentEntity(merged),
        entityMetaMerge: { aiReview: AI_REVIEW_CLEARED },
      });
    },
    [
      patchItemWithVersion,
      recordUndoBeforeMutation,
      setFocusBaselineBody,
      setFocusBaselineBodyDoc,
      setFocusBody,
      setFocusBodyDoc,
    ],
  );

  const setInlineBodyDraftDirty = useCallback((entityId: string, dirty: boolean) => {
    const s = inlineContentDirtyIdsRef.current;
    if (dirty) s.add(entityId);
    else s.delete(entityId);
  }, []);

  const queueMediaUploadPick = useCallback((pending: { mode: "focus" | "canvas"; id: string }) => {
    pendingMediaUploadRef.current = pending;
    mediaFileInputRef.current?.click();
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
          const aid = activeNodeIdRef.current;
          const ent = aid ? graphRef.current.entities[aid] : null;
          if (ent?.kind === "content" && contentEntityUsesHgDoc(ent)) {
            getHgDocEditor("focus-body")?.insertImageFromDataUrl(dataUrl, alt);
            return;
          }
          setFocusBody((prev) =>
            applyImageDataUrlToArchitecturalMediaBody(
              prev,
              dataUrl,
              alt,
              bodyUsesLorePortraitMediaSlot(prev)
                ? lorePortraitSlotUsesV9(prev)
                  ? loreEntityCardStyles.charSkPortraitImg
                  : loreEntityCardStyles.char3dPortraitImg
                : styles.mediaImage,
              { uploadButtonClass: styles.mediaUploadBtn },
            ),
          );
          return;
        }
        const entity = graphRef.current.entities[pending.id];
        if (!entity || entity.kind !== "content") return;
        if (contentEntityUsesHgDoc(entity)) {
          getHgDocEditor(`canvas-${pending.id}`)?.insertImageFromDataUrl(dataUrl, alt);
          return;
        }
        const portraitClass = bodyUsesLorePortraitMediaSlot(entity.bodyHtml)
          ? lorePortraitSlotUsesV9(entity.bodyHtml)
            ? loreEntityCardStyles.charSkPortraitImg
            : loreEntityCardStyles.char3dPortraitImg
          : styles.mediaImage;
        updateNodeBody(
          pending.id,
          applyImageDataUrlToArchitecturalMediaBody(entity.bodyHtml, dataUrl, alt, portraitClass, {
            uploadButtonClass: styles.mediaUploadBtn,
          }),
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
      const ex = (e.target as HTMLElement).closest(`[data-expand-btn="true"]`);
      if (ex && !ex.closest(`.${styles.nodeHeader}`)) e.preventDefault();
    };
    const onUploadClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest("[data-architectural-media-upload]");
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      const ownerFromBtn = t.getAttribute("data-media-owner-id");
      if (ownerFromBtn) {
        queueMediaUploadPick({ mode: "canvas", id: ownerFromBtn });
        return;
      }
      const inFocusBody = t.closest("[data-focus-body-editor], [data-hg-doc-editor]");
      const nodeHost = t.closest("[data-node-id]");
      if (inFocusBody && focusOpenRef.current && activeNodeIdRef.current) {
        queueMediaUploadPick({
          mode: "focus",
          id: activeNodeIdRef.current,
        });
      } else if (nodeHost instanceof HTMLElement && nodeHost.dataset.nodeId) {
        queueMediaUploadPick({
          mode: "canvas",
          id: nodeHost.dataset.nodeId,
        });
      } else {
        return;
      }
    };
    shell.addEventListener("mousedown", stopCaretDriftOnButton, true);
    shell.addEventListener("click", onUploadClick, true);
    return () => {
      shell.removeEventListener("mousedown", stopCaretDriftOnButton, true);
      shell.removeEventListener("click", onUploadClick, true);
    };
  }, [queueMediaUploadPick]);

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
    const projected = projectBodyHtmlForFocus(entity, normalizedBody);
    if (contentEntityUsesHgDoc(entity)) {
      const doc = hgDocForContentEntity(entity);
      setFocusBodyDoc(structuredClone(doc));
      setFocusBaselineBodyDoc(structuredClone(doc));
      setFocusBody("");
      setFocusBaselineBody("");
    } else {
      setFocusBody(projected);
      setFocusBaselineBody(projected);
    }
    setFocusBaselineTitle(entity.title);
    setFocusBaselineFactionRoster(entity.loreCard?.kind === "faction" ? (entity.factionRoster ?? []) : []);
    setFocusOpen(true);
  }, [graph.entities, graph.spaces, pushRecentItem]);

  const closeMediaGallery = useCallback(() => {
    setGalleryOpen(false);
    setGalleryNodeId(null);
    setGalleryDraftTitle("");
    setGalleryDraftNotesDoc(structuredClone(EMPTY_HG_DOC));
    setGalleryBaselineTitle("");
    setGalleryBaselineNotesDoc(structuredClone(EMPTY_HG_DOC));
  }, []);

  const openMediaGallery = useCallback((id: string) => {
    const entity = graph.entities[id];
    if (!entity || entity.kind !== "content" || entity.theme !== "media") return;
    const notes = getArchitecturalMediaNotes(entity.bodyHtml);
    setGalleryNodeId(id);
    setGalleryDraftTitle(entity.title);
    const notesDoc = htmlFragmentToHgDocDoc(notes);
    setGalleryDraftNotesDoc(structuredClone(notesDoc));
    setGalleryBaselineTitle(entity.title);
    setGalleryBaselineNotesDoc(structuredClone(notesDoc));
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
    const notesHtml = hgDocToHtml(
      getHgDocEditor("gallery-notes")?.getJSON() ?? galleryDraftNotesDoc,
    );
    const nextBody = setArchitecturalMediaNotes(entity.bodyHtml, notesHtml);
    const clearAiMeta = isAiReviewPending(entity.entityMeta) && !htmlStringHasHgAiPending(nextBody);
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
              bodyHtml: setArchitecturalMediaNotes(e.bodyHtml, notesHtml),
              entityMeta: clearAiMeta
                ? { ...e.entityMeta, aiReview: AI_REVIEW_CLEARED }
                : e.entityMeta,
            },
          },
        };
      });
      if (persistNeonRef.current && isUuidLike(galleryNodeId)) {
        const gid = galleryNodeId;
        const nextBodyPersist = setArchitecturalMediaNotes(entity.bodyHtml, notesHtml);
        queueMicrotask(() => {
          const ent = graphRef.current.entities[gid];
          if (!ent || ent.kind !== "content") return;
          void patchItemWithVersion(gid, {
            title: nextTitle,
            contentText: htmlToPlainText(nextBodyPersist),
            contentJson: buildContentJsonForContentEntity({
              ...ent,
              title: nextTitle,
              bodyHtml: nextBodyPersist,
            }),
            ...(clearAiMeta
              ? { entityMetaMerge: { aiReview: AI_REVIEW_CLEARED } }
              : {}),
          });
        });
      }
    closeMediaGallery();
  }, [
    closeMediaGallery,
    galleryDraftNotesDoc,
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

  const handleNodeExpandRef = useRef(handleNodeExpand);
  handleNodeExpandRef.current = handleNodeExpand;

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const onExpandKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const t = (e.target as HTMLElement).closest(`[data-expand-btn="true"]`);
      if (!t || !shell.contains(t) || t.closest(`.${styles.nodeHeader}`)) return;
      e.preventDefault();
      const inFocus = t.closest("[data-focus-body-editor='true']");
      if (inFocus && focusOpenRef.current && activeNodeIdRef.current) {
        handleNodeExpandRef.current(activeNodeIdRef.current);
        return;
      }
      const node = t.closest<HTMLElement>("[data-node-id]");
      const id = node?.dataset.nodeId;
      if (id) handleNodeExpandRef.current(id);
    };
    shell.addEventListener("keydown", onExpandKeyDown, true);
    return () => shell.removeEventListener("keydown", onExpandKeyDown, true);
  }, []);

  useEffect(() => {
    if (!galleryOpen || !galleryNodeId) return;
    const e = graph.entities[galleryNodeId];
    if (!e || e.kind !== "content" || e.theme !== "media") {
      closeMediaGallery();
    }
  }, [closeMediaGallery, galleryNodeId, galleryOpen, graph.entities]);

  const deriveLoreFocusResolvedBodyAndTitle = useCallback(
    (
      entity: CanvasContentEntity,
      normalizedFocusBody: string,
      fallbackTitle: string,
    ): { bodyHtml: string; title: string } => {
      const factionTemplate = bodyHtmlImpliesFactionArchive091(entity.bodyHtml)
        ? entity.bodyHtml
        : getLoreNodeSeedBodyHtml("faction", "v4", { factionRailSeed: entity.id });
      const nextBody = shouldRenderLoreCharacterCredentialCanvasNode(entity)
        ? focusDocumentHtmlToCharacterV11Body(normalizedFocusBody, entity.bodyHtml, entity.id)
        : shouldRenderLoreLocationCanvasNode(entity)
          ? focusDocumentHtmlToLocationBody(normalizedFocusBody, entity.bodyHtml)
          : shouldRenderLoreFactionArchive091CanvasNode(entity)
            ? withFactionArchiveObjectIdInRails(
                focusDocumentHtmlToFactionBody(normalizedFocusBody, factionTemplate),
                entity.id,
              )
            : normalizedFocusBody;
      const nextTitle = shouldRenderLoreLocationCanvasNode(entity)
        ? plainPlaceNameFromLocationBodyHtml(nextBody).trim() || defaultTitleForLoreKind("location")
        : shouldRenderLoreFactionArchive091CanvasNode(entity)
          ? plainFactionPrimaryNameFromArchiveBodyHtml(nextBody).trim() ||
            defaultTitleForLoreKind("faction")
          : fallbackTitle.trim() || "Untitled";
      return { bodyHtml: nextBody, title: nextTitle };
    },
    [],
  );

  const saveFocusAndClose = useCallback(() => {
    if (!activeNodeId) {
      setFocusOpen(false);
      setActiveNodeId(null);
      return;
    }
    const entityPre = graphRef.current.entities[activeNodeId];
    const hgDefault = entityPre?.kind === "content" && contentEntityUsesHgDoc(entityPre);
    const focusDoc = hgDefault
      ? getHgDocEditor("focus-body")?.getJSON() ?? focusBodyDoc
      : focusBodyDoc;
    const normalizedFocusBody = hgDefault
      ? hgDocToHtml(focusDoc)
      : normalizeChecklistMarkup(focusBody, {
          taskItem: styles.taskItem,
          taskCheckbox: styles.taskCheckbox,
          taskText: styles.taskText,
          done: styles.done,
        });

    if (activeNodeId) {
      const entity = graphRef.current.entities[activeNodeId];
      if (entity && entity.kind === "content") {
        const { bodyHtml: nextBodyResolved, title: nextTitleResolved } =
          deriveLoreFocusResolvedBodyAndTitle(entity, normalizedFocusBody, focusTitle);
        const bodyChanged = hgDefault
          ? jsonStableStringify(focusDoc) !== focusBaselineBodyDocKey
          : entity.bodyHtml !== nextBodyResolved;
        if (entity.title !== nextTitleResolved || bodyChanged) {
          recordUndoBeforeMutation();
        }
      }
      setGraph((prev) => {
        const entity = prev.entities[activeNodeId];
        if (!entity || entity.kind !== "content") return prev;
        const { bodyHtml: nextBody, title: nextTitle } = deriveLoreFocusResolvedBodyAndTitle(
          entity,
          normalizedFocusBody,
          focusTitle,
        );
        const nextBodyDoc = hgDefault ? structuredClone(focusDoc) : undefined;
        const clearAiMeta =
          isAiReviewPending(entity.entityMeta) &&
          !contentEntityHasHgAiPending({
            ...entity,
            title: nextTitle,
            bodyHtml: nextBody,
            bodyDoc: nextBodyDoc,
          });
        return {
          ...prev,
          entities: {
            ...prev.entities,
            [activeNodeId]: {
              ...entity,
              title: nextTitle,
              bodyHtml: nextBody,
              bodyDoc: nextBodyDoc,
              entityMeta: clearAiMeta
                ? { ...entity.entityMeta, aiReview: AI_REVIEW_CLEARED }
                : entity.entityMeta,
            },
          },
        };
      });
      if (persistNeonRef.current && isUuidLike(activeNodeId)) {
        const aid = activeNodeId;
        markOptimisticProtectedId(aid, 15_000);
        queueMicrotask(() => {
          const ent = graphRef.current.entities[aid];
          if (!ent || ent.kind !== "content") {
            clearOptimisticProtectedId(aid);
            return;
          }
          const { bodyHtml: nextBody, title: nextTitle } = deriveLoreFocusResolvedBodyAndTitle(
            ent,
            normalizedFocusBody,
            focusTitle,
          );
          const merged: CanvasContentEntity = {
            ...ent,
            title: nextTitle,
            bodyHtml: nextBody,
            bodyDoc: hgDefault ? structuredClone(focusDoc) : undefined,
          };
          const clearAiMeta =
            isAiReviewPending(ent.entityMeta) && !contentEntityHasHgAiPending(merged);
          const persistedMerged = clearAiMeta
            ? {
                ...merged,
                entityMeta: { ...merged.entityMeta, aiReview: AI_REVIEW_CLEARED },
              }
            : merged;
          void patchItemWithVersion(aid, {
            title: nextTitle,
            contentText: contentPlainTextForEntity(persistedMerged),
            contentJson: buildContentJsonForContentEntity(persistedMerged),
            ...(clearAiMeta
              ? { entityMetaMerge: { aiReview: AI_REVIEW_CLEARED } }
              : {}),
          });
        });
      }
    }
    setFocusOpen(false);
    setActiveNodeId(null);
  }, [
    activeNodeId,
    clearOptimisticProtectedId,
    deriveLoreFocusResolvedBodyAndTitle,
    focusBody,
    focusBodyDoc,
    focusBaselineBodyDocKey,
    focusTitle,
    markOptimisticProtectedId,
    patchItemWithVersion,
    recordUndoBeforeMutation,
  ]);

  const discardFocusAndClose = useCallback(() => {
    setFocusOpen(false);
    setActiveNodeId(null);
  }, []);

  const focusDirty = useMemo(() => {
    const ent = activeNodeId ? graph.entities[activeNodeId] : null;
    const hgDefault = ent?.kind === "content" && contentEntityUsesHgDoc(ent);
    const bodyDirty = hgDefault
      ? focusBodyDocKey !== focusBaselineBodyDocKey
      : focusBody !== focusBaselineBody;
    const rosterDirty =
      ent?.kind === "content" && ent.loreCard?.kind === "faction"
        ? JSON.stringify(ent.factionRoster ?? []) !== JSON.stringify(focusBaselineFactionRoster)
        : false;
    return (
      normalizedFocusTitle(focusTitle) !== normalizedFocusTitle(focusBaselineTitle) ||
      bodyDirty ||
      rosterDirty
    );
  }, [
    activeNodeId,
    graph.entities,
    focusTitle,
    focusBaselineTitle,
    focusBody,
    focusBaselineBody,
    focusBodyDocKey,
    focusBaselineBodyDocKey,
    focusBaselineFactionRoster,
  ]);

  /** What kind of focus overlay to render for the active content node. */
  const focusSurface = useMemo(():
    | "default-doc"
    | "code"
    | "character-hybrid"
    | "location-hybrid"
    | "faction-hybrid" => {
    if (!focusOpen || !activeNodeId) return "default-doc";
    const ent = graph.entities[activeNodeId];
    if (!ent || ent.kind !== "content") return "default-doc";
    if (shouldRenderLoreCharacterCredentialCanvasNode(ent)) return "character-hybrid";
    if (shouldRenderLoreLocationCanvasNode(ent)) return "location-hybrid";
    if (shouldRenderLoreFactionArchive091CanvasNode(ent)) return "faction-hybrid";
    if (ent.theme === "code") return "code";
    return "default-doc";
  }, [focusOpen, activeNodeId, graph.entities]);

  useEffect(() => {
    focusDirtyRef.current = focusDirty;
  }, [focusDirty]);

  const collabNeonActive =
    scenario === "default" &&
    canvasBootstrapResolved &&
    persistNeonRef.current &&
    isUuidLike(activeSpaceId);

  const mergeRemoteGraphEdgesImpl = useCallback(
    async (showToastIfChanged: boolean) => {
      if (scenario !== "default" || !canvasBootstrapResolved) return;
      if (!persistNeonRef.current) return;
      if (!isUuidLike(activeSpaceId)) return;
      try {
        const res = await fetch(`/api/spaces/${encodeURIComponent(activeSpaceId)}/graph`);
        const data = (await res.json()) as {
          ok?: boolean;
          edges?: GraphEdge[];
          itemLinksRevision?: string;
        };
        if (!data?.ok || !data.edges) return;
        const sig = [...data.edges]
          .map((e) => e.id)
          .sort()
          .join("\n");
        const prevSig = pollGraphEdgesSigRef.current;
        pollGraphEdgesSigRef.current = sig;
        if (typeof data.itemLinksRevision === "string") {
          lastItemLinksRevisionRef.current = data.itemLinksRevision;
        }
        setGraph((prev) =>
          mergeHydratedDbConnections(prev, data.edges!, {
            defaultFolderPin: CONNECTION_PIN_DEFAULT_FOLDER,
            defaultContentPin: CONNECTION_PIN_DEFAULT_CONTENT,
            fallbackColor: CONNECTION_DEFAULT_COLOR,
          }),
        );
        if (showToastIfChanged && prevSig !== null && prevSig !== sig) {
          setCollabConnectionsNotice(
            "Connections were updated (another tab, automation, or background sync).",
          );
        }
      } catch (e) {
        neonSyncSpaceChangeSyncBreadcrumb(
          `mergeRemoteGraphEdges: ${e instanceof Error ? e.message : "error"}`,
        );
      }
    },
    [activeSpaceId, scenario, canvasBootstrapResolved, setGraph],
  );

  useEffect(() => {
    mergeRemoteGraphEdgesImplRef.current = mergeRemoteGraphEdgesImpl;
  }, [mergeRemoteGraphEdgesImpl]);

  const enqueueRemoteGraphMerge = useCallback((wantToastOnChange: boolean) => {
    const q = graphMergeQueueRef.current;
    if (wantToastOnChange) q.pendingToast = true;
    if (q.inFlight) {
      q.rerun = true;
      return;
    }
    if (q.debounceTimer != null) {
      window.clearTimeout(q.debounceTimer);
      q.debounceTimer = null;
    }
    q.debounceTimer = window.setTimeout(() => {
      q.debounceTimer = null;
      void (async () => {
        const qq = graphMergeQueueRef.current;
        if (qq.inFlight) {
          qq.rerun = true;
          return;
        }
        qq.inFlight = true;
        try {
          do {
            qq.rerun = false;
            const toast = qq.pendingToast;
            qq.pendingToast = false;
            await mergeRemoteGraphEdgesImplRef.current(toast);
          } while (qq.rerun);
        } finally {
          qq.inFlight = false;
        }
      })();
    }, HEARTGARDEN_GRAPH_REFRESH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    const queue = graphMergeQueueRef.current;
    return () => {
      if (queue.debounceTimer != null) window.clearTimeout(queue.debounceTimer);
      queue.debounceTimer = null;
    };
  }, []);

  useEffect(() => {
    const protectedTimers = optimisticProtectedTimerRef.current;
    const protectedIds = optimisticProtectedIdsRef.current;
    return () => {
      for (const timer of protectedTimers.values()) {
        clearTimeout(timer);
      }
      protectedTimers.clear();
      protectedIds.clear();
    };
  }, []);

  const onAfterSpaceChangeMerge = useCallback(
    (info: { itemLinksRevision?: string }) => {
      const rev = info.itemLinksRevision;
      if (typeof rev !== "string") {
        enqueueRemoteGraphMerge(false);
        return;
      }
      if (rev === lastItemLinksRevisionRef.current) return;
      enqueueRemoteGraphMerge(true);
    },
    [enqueueRemoteGraphMerge],
  );

  useHeartgardenSpaceChangeSync({
    enabled: collabNeonActive,
    hasRemotePeers: presencePeers.length > 0,
    refreshNonce: realtimeRefreshNonce,
    activeSpaceId,
    syncCursorRef,
    focusOpenRef,
    focusDirtyRef,
    activeNodeIdRef,
    inlineContentDirtyIdsRef,
    savingContentIdsRef,
    optimisticProtectedIdsRef,
    remoteTombstoneExemptIdsRef,
    setGraph,
    itemServerUpdatedAtRef,
    onAfterSpaceChangeMerge,
  });

  const { connectedRef: realtimeConnectedRef } = useHeartgardenRealtimeSpaceSync({
    enabled: collabNeonActive,
    activeSpaceId,
    onInvalidate: (detail) => {
      setRealtimeRefreshNonce((n) => n + 1);
      if (detail?.reason === "item-links.changed") {
        enqueueRemoteGraphMerge(true);
      }
    },
  });

  useEffect(() => {
    if (!collabNeonActive || !isUuidLike(activeSpaceId)) return;
    let inFlight = false;
    let pollAbort: AbortController | null = null;
    const id = window.setInterval(() => {
      if (realtimeConnectedRef.current) return;
      if (inFlight) return;
      inFlight = true;
      pollAbort = new AbortController();
      void (async () => {
        try {
          const res = await fetch(
            `/api/spaces/${encodeURIComponent(activeSpaceId)}/link-revision`,
            { signal: pollAbort.signal },
          );
          const raw: unknown = await res.json();
          if (
            !res.ok ||
            typeof raw !== "object" ||
            raw === null ||
            (raw as { ok?: unknown }).ok !== true
          ) {
            return;
          }
          const rev = (raw as { itemLinksRevision?: unknown }).itemLinksRevision;
          if (typeof rev !== "string") return;
          if (rev === lastItemLinksRevisionRef.current) return;
          enqueueRemoteGraphMerge(true);
        } catch (error) {
          if (isAbortError(error)) return;
          /* ignore */
        } finally {
          inFlight = false;
          pollAbort = null;
        }
      })();
    }, HEARTGARDEN_GRAPH_REFRESH_FALLBACK_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      pollAbort?.abort();
    };
  }, [activeSpaceId, collabNeonActive, enqueueRemoteGraphMerge, realtimeConnectedRef]);

  const presencePayloadForHeartbeat = useCallback(() => {
    const v = viewRef.current;
    return {
      camera: { x: v.tx, y: v.ty, zoom: v.scale },
      pointer: localPointerWorldRef.current,
    };
  }, []);

  const presenceIdentityForHeartbeat = useCallback(() => {
    if (!presenceIdentityEnabled) {
      return { displayName: null, sigil: null };
    }
    const clientId = getOrCreatePresenceClientId();
    if (!clientId) {
      return { displayName: null, sigil: null };
    }
    const profile = readPresenceProfile(clientId);
    return {
      displayName: profile.displayName,
      sigil: profile.sigil,
    };
  }, [presenceIdentityEnabled]);

  const onPresencePeersUpdate = useCallback((peers: SpacePresencePeer[]) => {
    setPresencePeers(peers);
  }, []);

  useHeartgardenPresenceHeartbeat({
    enabled: collabNeonActive,
    activeSpaceId,
    getPayload: presencePayloadForHeartbeat,
    getIdentity: presenceIdentityForHeartbeat,
    onPeersUpdate: onPresencePeersUpdate,
  });

  useEffect(() => {
    if (!collabNeonActive) return;
    const el = viewportRef.current;
    if (!el) return;
    let raf = 0;
    const flush = () => {
      raf = 0;
      const clientId = getOrCreatePresenceClientId();
      if (!clientId) return;
      const v = viewRef.current;
      const identity = presenceIdentityForHeartbeat();
      void postPresencePayload(activeSpaceId, clientId, {
        camera: { x: v.tx, y: v.ty, zoom: v.scale },
        pointer: localPointerWorldRef.current,
        displayName: identity.displayName,
        sigil: identity.sigil,
      });
    };
    const scheduleFlush = () => {
      const now = Date.now();
      if (now - lastPointerPresencePostRef.current < HEARTGARDEN_PRESENCE_POINTER_FLUSH_MIN_MS) {
        return;
      }
      lastPointerPresencePostRef.current = now;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(flush);
    };
    const onMove = (e: PointerEvent) => {
      if (document.visibilityState === "hidden") return;
      const v = viewRef.current;
      const worldX = (e.clientX - v.tx) / v.scale;
      const worldY = (e.clientY - v.ty) / v.scale;
      localPointerWorldRef.current = { x: worldX, y: worldY };
      scheduleFlush();
    };
    const onLeave = () => {
      localPointerWorldRef.current = null;
      scheduleFlush();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [collabNeonActive, activeSpaceId, presenceIdentityForHeartbeat]);

  const galleryDirty = useMemo(
    () =>
      !!galleryOpen &&
      !!galleryNodeId &&
      (normalizedFocusTitle(galleryDraftTitle) !== normalizedFocusTitle(galleryBaselineTitle) ||
        galleryDraftNotesDocKey !== galleryBaselineNotesDocKey),
    [
      galleryBaselineNotesDocKey,
      galleryBaselineTitle,
      galleryDraftNotesDocKey,
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

  /** Resets so world (0,0) is viewport-centered (`defaultCamera`) and syncs storage — see `AGENTS.md` (Canvas camera). */
  const recenterToOrigin = useCallback(() => {
    const { width, height } = viewportCssSizeForDefaultCamera(
      viewportRef.current,
      viewportSizeRef.current.width,
      viewportSizeRef.current.height,
    );
    const cam = defaultCamera(width, height);
    setTranslateX(cam.x);
    setTranslateY(cam.y);
    setScale(cam.zoom);
    if (isUuidLike(activeSpaceIdRef.current)) {
      writeSpaceCamera(activeSpaceIdRef.current, cam);
    }
  }, []);

  const makeWikiLinkAssist = useCallback(
    (excludeEntityId?: string): WikiLinkAssistConfig | null => {
      if (isRestrictedLayer) return null;
      if (!isUuidLike(activeSpaceId)) return null;
      return {
        enabled: true,
        excludeEntityId,
        getLocalItems: () => {
          const g = graphRef.current;
          const sid = activeSpaceIdRef.current;
          const ids = g.spaces[sid]?.entityIds ?? [];
          const out: { id: string; title: string }[] = [];
          for (const id of ids) {
            const e = g.entities[id];
            if (!e) continue;
            out.push({ id, title: e.title || "Untitled" });
          }
          return out;
        },
        fetchRemoteSuggest: cloudLinksBar
          ? async (q, signal) => {
              const sid = activeSpaceIdRef.current;
              if (!isUuidLike(sid)) return [];
              const params = new URLSearchParams({ q, mode: "hybrid" });
              params.set("spaceId", sid);
              const res = await fetch(`/api/search/suggest?${params}`, { signal });
              const data = (await res.json()) as {
                ok?: boolean;
                suggestions?: { id: string; title: string }[];
              };
              if (!data.ok || !Array.isArray(data.suggestions)) return [];
              return data.suggestions.map((s) => ({ id: s.id, title: s.title }));
            }
          : undefined,
      };
    },
    [activeSpaceId, cloudLinksBar, isRestrictedLayer],
  );

  const applyFitAllToViewport = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const w = rect?.width ?? viewportSizeRef.current.width ?? window.innerWidth;
    const h = rect?.height ?? viewportSizeRef.current.height ?? window.innerHeight;
    const next = fitCameraToActiveSpaceContent(
      graphRef.current,
      activeSpaceIdRef.current,
      w,
      h,
      MIN_ZOOM,
      MAX_ZOOM,
    );
    if (!next) {
      recenterToOrigin();
      return;
    }
    setScale(next.scale);
    setTranslateX(next.translateX);
    setTranslateY(next.translateY);
    playVigilUiSound("select");
  }, [recenterToOrigin]);

  const onMinimapPanWorldDelta = useCallback((dw: number, dh: number) => {
    const s = viewRef.current.scale;
    setTranslateX((tx) => tx - dw * s);
    setTranslateY((ty) => ty - dh * s);
  }, []);

  const onMinimapCenterOnWorld = useCallback((wx: number, wy: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const w = rect?.width ?? viewportSizeRef.current.width ?? window.innerWidth;
    const h = rect?.height ?? viewportSizeRef.current.height ?? window.innerHeight;
    const s = viewRef.current.scale;
    setTranslateX(w / 2 - wx * s);
    setTranslateY(h / 2 - wy * s);
  }, []);

  const onViewportToastShow = useCallback(() => {
    setViewportToastOpen(false);
    applyFitAllToViewport();
  }, [applyFitAllToViewport]);

  const onViewportToastDismiss = useCallback(() => {
    viewportToastCooldownUntilRef.current = Date.now() + 20_000;
    setViewportToastOpen(false);
  }, []);

  const toggleMinimapOpen = useCallback(() => {
    setMinimapOpen((prev) => {
      const next = !prev;
      writeCanvasMinimapVisibleToStorage(next);
      return next;
    });
    playVigilUiSound("tap");
  }, []);

  const viewportWheelZoomRef = useRef(updateTransformFromMouse);
  viewportWheelZoomRef.current = updateTransformFromMouse;

  useEffect(() => {
    if (!isUuidLike(activeSpaceId)) return;
    if (cameraPersistTimerRef.current) clearTimeout(cameraPersistTimerRef.current);
    cameraPersistTimerRef.current = setTimeout(() => {
      cameraPersistTimerRef.current = null;
      const snap = cameraPersistSnapshotRef.current;
      if (!isUuidLike(snap.spaceId)) return;
      writeSpaceCamera(snap.spaceId, { x: snap.tx, y: snap.ty, zoom: snap.zoom });
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
    pollGraphEdgesSigRef.current = null;
    lastItemLinksRevisionRef.current = null;
    void (async () => {
      try {
        const res = await fetch(`/api/spaces/${encodeURIComponent(activeSpaceId)}/graph`);
        const data = (await res.json()) as {
          ok?: boolean;
          edges?: GraphEdge[];
          itemLinksRevision?: string;
        };
        if (cancelled || !data?.ok || !data.edges) return;
        pollGraphEdgesSigRef.current = [...data.edges]
          .map((e) => e.id)
          .sort()
          .join("\n");
        if (typeof data.itemLinksRevision === "string") {
          lastItemLinksRevisionRef.current = data.itemLinksRevision;
        }
        setGraph((prev) =>
          mergeHydratedDbConnections(prev, data.edges!, {
            defaultFolderPin: CONNECTION_PIN_DEFAULT_FOLDER,
            defaultContentPin: CONNECTION_PIN_DEFAULT_CONTENT,
            fallbackColor: CONNECTION_DEFAULT_COLOR,
          }),
        );
      } catch (e) {
        neonSyncSpaceChangeSyncBreadcrumb(
          `poll graph edges: ${e instanceof Error ? e.message : "error"}`,
        );
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

  /** Hydrates graph from bootstrap and sets camera to `defaultCamera` (world origin centered — see `AGENTS.md`). */
  const applyBootstrapData = useCallback((data: BootstrapResponse, maxZi: number) => {
    if (!data.spaceId) return;
    const braneId = (data as BootstrapResponse & { braneId?: string | null }).braneId ?? null;
    setActiveBraneId(braneId);
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
    const { width, height } = viewportCssSizeForDefaultCamera(
      viewportRef.current,
      viewportSizeRef.current.width,
      viewportSizeRef.current.height,
    );
    const cam = defaultCamera(width, height);
    setTranslateX(cam.x);
    setTranslateY(cam.y);
    setScale(cam.zoom);
    writeSpaceCamera(data.spaceId, cam);
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
    setActiveBraneId(null);
    const freshGraph = buildHeartgardenDemoLocalGraph();
    setGraph(freshGraph);
    setActiveSpaceId(freshGraph.rootSpaceId);
    setNavigationPath([freshGraph.rootSpaceId]);
    const { width, height } = viewportCssSizeForDefaultCamera(
      viewportRef.current,
      viewportSizeRef.current.width,
      viewportSizeRef.current.height,
    );
    const demoCam = defaultCamera(width, height);
    setTranslateX(demoCam.x);
    setTranslateY(demoCam.y);
    setScale(demoCam.zoom);
    writeSpaceCamera(freshGraph.rootSpaceId, demoCam);
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

  const bootApiLoaded = heartgardenBootApi.loaded;
  const bootGateEnabled = heartgardenBootApi.gateEnabled;
  const bootSessionValid = heartgardenBootApi.sessionValid;
  const bootSessionTier = heartgardenBootApi.sessionTier;

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

    const boot = heartgardenBootApiRef.current;
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
      let failure: Extract<BootstrapFetchDetail, { ok: false }> | null = null;
      try {
        const result = await fetchBootstrapDetailed();
        if (cancelled) return;
        if (result.ok) {
          setBootstrapErrorSummary(null);
          ingestLiveBootstrap(result.data);
        } else {
          failure = result;
        }
      } catch (e) {
        /* `ingestLiveBootstrap` crashed or `fetchBootstrapDetailed` rethrew (AbortError). */
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        failure = {
          ok: false,
          cause: "network",
          message: e instanceof Error ? e.message : String(e),
        };
      }
      if (failure) {
        setBootstrapErrorSummary(summarizeBootstrapError(failure));
        const b = heartgardenBootApiRef.current;
        const strictGmWorkspace = !b.gateEnabled || b.sessionTier === "access";
        const skipCache =
          strictGmWorkspace ||
          !b.loaded ||
          (b.gateEnabled && !b.sessionValid) ||
          (b.gateEnabled && b.sessionTier === "demo");
        if (skipCache) {
          /* Open gate + no Neon: README local-only demo — avoids an empty board + blocking overlay. */
          if (!b.gateEnabled) {
            applyDemoLocalCanvas();
          } else {
            setNeonWorkspaceOk(false);
            setWorkspaceViewFromCache(false);
            persistNeonRef.current = false;
            neonSyncSetCloudEnabled(false);
            setGraph(createBootstrapPendingGraph());
            setActiveSpaceId(ROOT_SPACE_ID);
            setNavigationPath([ROOT_SPACE_ID]);
            {
              const cam = defaultCamera();
              setTranslateX(cam.x);
              setTranslateY(cam.y);
              setScale(cam.zoom);
            }
          }
        } else {
          const tier = workspaceCacheTierForNeonSession(b);
          const cached = readWorkspaceViewCache(tier);
          if (cached?.bootstrap?.spaceId) {
            setNeonWorkspaceOk(false);
            setWorkspaceViewFromCache(true);
            persistNeonRef.current = false;
            neonSyncSetCloudEnabled(false);
            applyBootstrapDataRef.current(cached.bootstrap, cached.maxZIndex);
          } else if (!b.gateEnabled && !strictGmWorkspace) {
            /* README: without Neon, open gate runs local-only demo — same as demo PIN tier. */
            applyDemoLocalCanvas();
          } else {
            setNeonWorkspaceOk(false);
            setWorkspaceViewFromCache(false);
            persistNeonRef.current = false;
            neonSyncSetCloudEnabled(false);
            setGraph(createBootstrapPendingGraph());
            setActiveSpaceId(ROOT_SPACE_ID);
            setNavigationPath([ROOT_SPACE_ID]);
            {
              const cam = defaultCamera();
              setTranslateX(cam.x);
              setTranslateY(cam.y);
              setScale(cam.zoom);
            }
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
  }, [
    scenario,
    ingestLiveBootstrap,
    applyDemoLocalCanvas,
    bootApiLoaded,
    bootGateEnabled,
    bootSessionValid,
    bootSessionTier,
  ]);

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
        setBootstrapErrorSummary(null);
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
  }, [
    scenario,
    workspaceViewFromCache,
    ingestLiveBootstrap,
    bootApiLoaded,
    bootGateEnabled,
    bootSessionValid,
    bootSessionTier,
  ]);

  useLayoutEffect(() => {
    setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    // Non-default shell: seed camera so world (0,0) is centered — `AGENTS.md` (Canvas camera).
    // Default scenario: leave translate to bootstrap, which applies camera in one batch.
    if (scenario !== "default") {
      const cam = defaultCamera(window.innerWidth, window.innerHeight);
      setTranslateX(cam.x);
      setTranslateY(cam.y);
      setScale(cam.zoom);
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
    const { width: w, height: h } = viewportCssSizeForDefaultCamera(
      viewportRef.current,
      viewportSizeRef.current.width,
      viewportSizeRef.current.height,
    );
    return {
      x: (w / 2 - translateX) / scale,
      y: (h / 2 - translateY) / scale,
    };
  }, [scale, translateX, translateY]);

  const commitSmartLoreImport = useCallback(async () => {
    const rev = loreSmartReview;
    const planForApply = loreSmartPlanWithTargetOverrides;
    if (!rev || !planForApply) return;
    const attemptId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `import-apply-${Date.now()}`;
    const reportFailure = (detail: LoreImportFailureDetail) => {
      console.error(
        "[lore-import]",
        detail.stage,
        detail.operation,
        detail.httpStatus ?? "no_http_status",
        detail.message,
        { attemptId: detail.attemptId, jobId: detail.jobId, phase: detail.phase },
      );
      playVigilUiSound("caution");
      setLoreImportFailure(detail);
    };
    if (!persistNeonRef.current || !isUuidLike(activeSpaceId)) {
      reportFailure(
        createLoreImportFailureDetail({
          attemptId,
          stage: "apply",
          operation: "POST /api/lore/import/apply",
          message: "Importing to the canvas requires a connected Neon space (not local demo mode).",
          fileName: rev.fileName,
          spaceId: activeSpaceId,
          recommendedAction: "Switch to a connected Neon workspace before applying import changes.",
        }),
      );
      return;
    }
    const center = centerCoords();
    const acceptedMergeProposalIds = Object.entries(loreSmartAcceptedMergeIds)
      .filter(([, v]) => v)
      .map(([id]) => id);
    setLoreImportFailure(null);
    setLoreImportCommitting(true);
    playVigilUiSound("button");
    try {
      const res = await fetch("/api/lore/import/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Heartgarden-Import-Attempt": attemptId,
        },
        body: JSON.stringify({
          spaceId: activeSpaceId,
          importBatchId: planForApply.importBatchId,
          plan: planForApply,
          layout: { originX: center.x - 140, originY: center.y - 120 },
          includeSourceCard:
            planForApply.userContext?.granularity === "one_note"
              ? false
              : loreSmartIncludeSource,
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
      const rawText = await res.text();
      const data = parseLoreImportJsonBody(rawText) as {
        ok?: boolean;
        status?: "applied" | "needs_follow_up";
        error?: string;
        linkWarnings?: string[];
        followUp?: LoreImportOtherFollowUp;
        resolvedClarificationAnswers?: ClarificationAnswer[];
      };
      if (!res.ok || !data.ok) {
        reportFailure(
          createLoreImportFailureDetail({
            attemptId,
            stage: "apply",
            operation: "POST /api/lore/import/apply",
            message: typeof data.error === "string" ? data.error : `Apply failed (HTTP ${res.status})`,
            responseSnippet: rawText,
            httpStatus: res.status,
            jobId: planForApply.importBatchId,
            fileName: rev.fileName,
            spaceId: activeSpaceId,
            recommendedAction:
              "Review required clarifications/merges and retry. If this persists, copy diagnostics and share it.",
          }),
        );
        return;
      }
      if (data.status === "needs_follow_up" && data.followUp) {
        setLoreSmartOtherFollowUp(data.followUp);
        setLoreSmartManualQuestionId(null);
        if (Array.isArray(data.resolvedClarificationAnswers)) {
          setLoreSmartClarificationAnswers(data.resolvedClarificationAnswers);
        }
        playVigilUiSound("caution");
        return;
      }
      setLoreSmartOtherFollowUp(null);
      setLoreSmartManualQuestionId(null);
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
      setLoreSmartTargetSpaceByNoteId({});
      setLoreSmartRelatedOpenByNoteId({});
      setLoreSmartSpaceSearchQuery("");
      setLoreSmartSpaceSearchResults([]);
      setLoreSmartManualQuestionId(null);
    } catch (error) {
      reportFailure(
        createLoreImportFailureDetail({
          attemptId,
          stage: "apply",
          operation: "POST /api/lore/import/apply",
          message: error instanceof Error ? error.message : "Apply request failed",
          jobId: rev.plan.importBatchId,
          fileName: rev.fileName,
          spaceId: activeSpaceId,
          recommendedAction:
            "Retry apply once. If it fails again, copy support snapshot and include the import batch id.",
        }),
      );
    } finally {
      setLoreImportCommitting(false);
    }
  }, [
    activeSpaceId,
    centerCoords,
    loreSmartAcceptedMergeIds,
    loreSmartClarificationAnswers,
    loreSmartIncludeSource,
    loreSmartPlanWithTargetOverrides,
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
        return newSpaceId;
      }

      recordUndoBeforeMutation();
      const snapshot = graphRef.current;
      const folder = snapshot.entities[folderId];
      if (!folder || folder.kind !== "folder") return null;
      const existingChildId = snapshot.spaces[folder.childSpaceId] ? folder.childSpaceId : null;
      const resolved = existingChildId ?? createId();
      if (!existingChildId) {
        setGraph((prev) => {
          const folderCurrent = prev.entities[folderId];
          if (!folderCurrent || folderCurrent.kind !== "folder") return prev;
          if (prev.spaces[folderCurrent.childSpaceId]) return prev;
          const next = shallowCloneGraph(prev);
          const parentSpaceId = next.spaces[activeSpaceId]?.id ?? next.rootSpaceId;
          next.spaces[resolved] = {
            id: resolved,
            name: folderCurrent.title || "Untitled Folder",
            parentSpaceId,
            entityIds: [],
          };
          next.entities[folderId] = { ...folderCurrent, childSpaceId: resolved };
          return next;
        });
      }
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
    (spaceId: string, opts?: { cameraOverride?: CameraState }) => {
      const snap = graphRef.current;
      if (!snap.spaces[spaceId] || spaceId === activeSpaceIdRef.current) return;

      const navGen = ++spaceNavGenerationRef.current;
      const targetSpaceId = spaceId;
      const cameraOverride = opts?.cameraOverride;

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
        if (isUuidLike(targetSpaceId)) {
          // Arrival: world (0,0) centered unless following a remote viewport (`heartgarden-space-camera` + AGENTS.md).
          const { width, height } = viewportCssSizeForDefaultCamera(
            viewportRef.current,
            viewportSizeRef.current.width,
            viewportSizeRef.current.height,
          );
          const cam: CameraState =
            cameraOverride != null ? clampFollowCamera(cameraOverride) : defaultCamera(width, height);
          setTranslateX(cam.x);
          setTranslateY(cam.y);
          setScale(cam.zoom);
          writeSpaceCamera(targetSpaceId, cam);
        } else if (!merged) {
          /* Local seed spaces use string ids; same centered default as UUID spaces. */
          const { width, height } = viewportCssSizeForDefaultCamera(
            viewportRef.current,
            viewportSizeRef.current.width,
            viewportSizeRef.current.height,
          );
          const cam = defaultCamera(width, height);
          setTranslateX(cam.x);
          setTranslateY(cam.y);
          setScale(cam.zoom);
        }
        setActiveSpaceId(targetSpaceId);
        setNavigationPath(buildPathToSpace(targetSpaceId, g.spaces, g.rootSpaceId));
        setSelectedNodeIds([]);
      };

      const stillCurrent = () => navGen === spaceNavGenerationRef.current;

      if (!canvasEffectsEnabledRef.current) {
        void (async () => {
          let merged: CanvasGraph | null = null;
          let bootstrapMaxZ: number | null = null;
          // REVIEW_2026-04-22-2 H8: accumulate sync cursor + per-item updatedAt
          // bumps locally and only commit them to the persistent refs after the
          // stillCurrent() guard, so a superseded enterSpace never rewinds the
          // active space's sync cursor or injects bootstrap updatedAt values
          // for a space that is no longer active.
          const pendingUpdatedAtBumps: Array<readonly [string, string]> = [];
          let pendingCursorIso: string | null = null;
          try {
            if (persistNeonRef.current && isUuidLike(targetSpaceId)) {
              const data = await fetchBootstrap(targetSpaceId);
              if (data && data.demo === false && data.spaceId) {
                merged = mergeBootstrapView(graphRef.current, data);
                if (data.items.length > 0) {
                  bootstrapMaxZ = Math.max(...data.items.map((i) => i.zIndex), 100);
                }
                let maxMs = Date.parse(syncCursorRef.current);
                if (!Number.isFinite(maxMs)) maxMs = 0;
                for (const it of data.items) {
                  if (it.updatedAt) {
                    pendingUpdatedAtBumps.push([it.id, it.updatedAt] as const);
                    const t = Date.parse(it.updatedAt);
                    if (Number.isFinite(t) && t > maxMs) maxMs = t;
                  }
                }
                pendingCursorIso = new Date(maxMs).toISOString();
              }
            }
          } catch {
            /* ignore */
          }
          if (!stillCurrent()) return;
          for (const [id, ua] of pendingUpdatedAtBumps) {
            itemServerUpdatedAtRef.current.set(id, ua);
          }
          if (pendingCursorIso !== null) {
            syncCursorRef.current = pendingCursorIso;
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
        // REVIEW_2026-04-22-2 H8: buffer sync-cursor + updatedAt mutations until
        // after the stillCurrent() guard; otherwise a superseded enterSpace can
        // rewind the now-active space's cursor or poison its updatedAt map.
        const pendingUpdatedAtBumps: Array<readonly [string, string]> = [];
        let pendingCursorIso: string | null = null;
        try {
          if (persistNeonRef.current && isUuidLike(targetSpaceId)) {
            const data = await fetchBootstrap(targetSpaceId);
            if (data && data.demo === false && data.spaceId) {
              merged = mergeBootstrapView(graphRef.current, data);
              if (data.items.length > 0) {
                bootstrapMaxZ = Math.max(...data.items.map((i) => i.zIndex), 100);
              }
              let maxMs = Date.parse(syncCursorRef.current);
              if (!Number.isFinite(maxMs)) maxMs = 0;
              for (const it of data.items) {
                if (it.updatedAt) {
                  pendingUpdatedAtBumps.push([it.id, it.updatedAt] as const);
                  const t = Date.parse(it.updatedAt);
                  if (Number.isFinite(t) && t > maxMs) maxMs = t;
                }
              }
              pendingCursorIso = new Date(maxMs).toISOString();
            }
          }
        } finally {
          const elapsedAfterFetch = now() - tNav;
          const waitFadeOutEnd = Math.max(0, VIEWPORT_SCENE_FADE_MS - elapsedAfterFetch);
          if (waitFadeOutEnd > 0) await sleep(waitFadeOutEnd);

          if (!stillCurrent()) return;
          for (const [id, ua] of pendingUpdatedAtBumps) {
            itemServerUpdatedAtRef.current.set(id, ua);
          }
          if (pendingCursorIso !== null) {
            syncCursorRef.current = pendingCursorIso;
          }
          applySpaceNavigation(merged, bootstrapMaxZ);

          const elapsedBeforeRelease = now() - tNav;
          const waitUntilCenter = Math.max(0, VIEWPORT_TRANSITION_CENTER_MS - elapsedBeforeRelease);
          if (waitUntilCenter > 0) await sleep(waitUntilCenter);

          if (stillCurrent()) {
            setNavTransitionActive(false);
          }
        }
      })();
    },
    [],
  );

  const handleFollowPresencePeer = useCallback(
    (peer: SpacePresencePeer) => {
      const peerName = presenceNameForClient(
        peer.clientId,
        presenceIdentityEnabled ? sanitizePresenceDisplayName(peer.displayName) : null,
      );
      const snap = graphRef.current;
      if (!snap.spaces[peer.activeSpaceId]) return;

      if (focusOpen || galleryOpen || stackModal != null) {
        const confirmCopy = presenceIdentityEnabled
          ? `Close the open card, gallery, or stack and jump to ${peerName}'s view?`
          : "Close the open card, gallery, or stack and jump to this collaborator’s view?";
        if (
          !window.confirm(confirmCopy)
        ) {
          return;
        }
        setFocusOpen(false);
        setGalleryOpen(false);
        setStackModal(null);
        setActiveNodeId(null);
      }

      const cam = clampFollowCamera(peer.camera);

      if (peer.activeSpaceId === activeSpaceIdRef.current) {
        setTranslateX(cam.x);
        setTranslateY(cam.y);
        setScale(cam.zoom);
        return;
      }

      enterSpace(peer.activeSpaceId, { cameraOverride: cam });
    },
    [focusOpen, galleryOpen, stackModal, enterSpace, presenceIdentityEnabled],
  );

  const collabPeerChips = useMemo((): CollabPeerPresenceChip[] => {
    const formatLastSeen = (updatedAtIso: string): string => {
      const t = Date.parse(updatedAtIso);
      if (!Number.isFinite(t)) return "unknown";
      const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
      if (sec < 60) return `${sec}s ago`;
      const min = Math.round(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.round(min / 60);
      return `${hr}h ago`;
    };

    const now = Date.now();
    const chips: CollabPeerPresenceChip[] = presencePeers.map((p) => {
      const short = p.clientId.slice(-4).toLowerCase();
      const spaceName = graph.spaces[p.activeSpaceId]?.name ?? "Space";
      const t = Date.parse(p.updatedAt);
      const stale = !Number.isFinite(t) || now - t > 60_000;
      const name = presenceNameForClient(
        p.clientId,
        presenceIdentityEnabled ? sanitizePresenceDisplayName(p.displayName) : null,
      );
      const initials = presenceInitialsFromName(name);
      const sigil = presenceSigilLabel(p.sigil);
      return {
        clientId: p.clientId,
        kind: "peer",
        emoji: presenceIdentityEnabled ? undefined : presenceEmojiForClientId(p.clientId),
        initials: initials.length > 0 ? initials : "??",
        displayName: presenceIdentityEnabled ? name : presenceFallbackAliasForClientId(p.clientId),
        sigilLabel: presenceIdentityEnabled ? sigil : undefined,
        title: presenceIdentityEnabled
          ? `${spaceName} · ${name} · last seen ${formatLastSeen(p.updatedAt)}${stale ? " · may be stale" : ""}`
          : `${spaceName} · …${short}${stale ? " · may be stale" : ""}`,
        ariaLabel: presenceIdentityEnabled
          ? `Follow collaborator ${name}`
          : `Follow collaborator ending …${short}`,
        muted: stale,
        onFollow: () => handleFollowPresencePeer(p),
      };
    });
    if (!presenceIdentityEnabled || chips.length <= 3) return chips;
    const visible = chips.slice(0, 3);
    const hidden = chips.length - visible.length;
    if (hidden <= 0) return visible;
    visible.push({
      clientId: "__overflow__",
      kind: "overflow",
      initials: `+${hidden}`,
      displayName: `${hidden} more`,
      sigilLabel: undefined,
      title: `${hidden} additional collaborators`,
      ariaLabel: `${hidden} additional collaborators`,
      muted: false,
      onFollow: () => {
        /* informational overflow chip */
      },
    });
    return visible;
  }, [presencePeers, graph.spaces, handleFollowPresencePeer, presenceIdentityEnabled]);

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
      if (
        !ent ||
        ent.kind !== "content" ||
        ent.theme === "media" ||
        shouldRenderLoreCharacterCredentialCanvasNode(ent) ||
        shouldRenderLoreLocationCanvasNode(ent) ||
        shouldRenderLoreFactionArchive091CanvasNode(ent)
      ) {
        return null;
      }
      const focusPlain =
        ent.kind === "content" && contentEntityUsesHgDoc(ent)
          ? hgDocToPlainText(getHgDocEditor("focus-body")?.getJSON() ?? focusBodyDoc)
          : stripLegacyHtmlToPlainText(focusBody);
      return {
        title: focusTitle.trim(),
        bodyText: focusPlain,
        excludeItemId:
          ent.persistedItemId && isUuidLike(ent.persistedItemId)
            ? ent.persistedItemId
            : undefined,
        targetLabel: focusTitle.trim() || "Focused note",
      };
    }
    if (selectedNodeIds.length === 1) {
      const ent = graph.entities[selectedNodeIds[0]!];
      if (
        !ent ||
        ent.kind !== "content" ||
        ent.theme === "media" ||
        shouldRenderLoreCharacterCredentialCanvasNode(ent) ||
        shouldRenderLoreLocationCanvasNode(ent) ||
        shouldRenderLoreFactionArchive091CanvasNode(ent)
      ) {
        return null;
      }
      return {
        title: (ent.title ?? "").trim(),
        bodyText: contentPlainTextForEntity(ent),
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
    focusBodyDoc,
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
      { id: "create-media", label: "Create image card", hint: "Add a media card", icon: <ImageSquare size={14} weight="bold" /> },
      { id: "create-folder", label: "Create folder", hint: "Add folder and child space", icon: <Folder size={14} weight="bold" /> },
      {
        id: "create-character",
        label: "Create character",
        hint: `Lore character — ${loreVariantChoiceLabel("character", defaultLoreCardVariantForKind("character"))} layout`,
        keywords: ["lore", "character", "person", "npc", "cast"],
        icon: <User size={14} weight="bold" />,
      },
      {
        id: "create-organization",
        label: "Create organization",
        hint: `Lore organization — ${loreVariantChoiceLabel("faction", defaultLoreCardVariantForKind("faction"))} layout`,
        keywords: [
          "lore",
          "organization",
          "faction",
          "company",
          "guild",
          "letterhead",
          "monogram",
          "framed",
          "memo",
        ],
        icon: <UsersThree size={14} weight="bold" />,
      },
      {
        id: "create-location",
        label: "Create location",
        hint: `Lore place — ${loreVariantChoiceLabel("location", defaultLoreCardVariantForKind("location"))} layout`,
        keywords: ["lore", "location", "place", "coverage", "map", "region"],
        icon: <MapPin size={14} weight="bold" />,
      },
      { id: "export-json", label: "Export graph JSON", hint: "Download the current graph", icon: <DownloadSimple size={14} weight="bold" /> },
      {
        id: "toggle-canvas-effects",
        label: "Toggle canvas effects",
        hint: "Flow transitions, vignette, ambient grid",
        keywords: ["motion", "transition", "performance", "effects", "lean"],
        icon: <Lightning size={14} weight="bold" />,
      },
      { id: "zoom-fit", label: "Zoom to fit", hint: "Fit visible cards into the viewport", icon: <BoundingBox size={14} weight="bold" /> },
      {
        id: "zoom-selection",
        label: "Zoom to selection",
        hint: "Frame selected cards",
        keywords: ["selection", "frame", "focus"],
        icon: <Scan size={14} weight="bold" />,
      },
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
        label: "Toggle link graph",
        hint: "Force-directed item_links view for this space",
        keywords: ["graph", "links", "network", "edges"],
        icon: <Graph size={14} weight="bold" />,
      },
      {
        id: "import-lore",
        label: "Import lore file",
        hint: "PDF / DOCX / markdown → text + Claude entity extract (beta)",
        keywords: ["import", "pdf", "docx", "markdown", "upload"],
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
          markOptimisticProtectedId(entityId);
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
            void (async () => {
              if (!persistNeonRef.current || !isUuidLike(entityId)) return;
              let ent = graphRef.current.entities[entityId];
              if (ent?.kind !== "folder") return;
              const withTargetScheme = (folder: CanvasFolderEntity) => {
                if (scheme == null) {
                  const updated = { ...folder };
                  delete updated.folderColorScheme;
                  return updated;
                }
                return { ...folder, folderColorScheme: scheme };
              };
              let ok = await patchItemWithVersion(entityId, {
                contentJson: buildContentJsonForFolderEntity(withTargetScheme(ent)),
              });
              if (!ok) {
                await new Promise<void>((resolve) => window.setTimeout(resolve, 220));
                ent = graphRef.current.entities[entityId];
                if (ent?.kind === "folder") {
                  ok = await patchItemWithVersion(entityId, {
                    contentJson: buildContentJsonForFolderEntity(withTargetScheme(ent)),
                  });
                }
              }
              if (!ok) {
                clearOptimisticProtectedId(entityId);
                return;
              }
              markOptimisticProtectedId(entityId, 1400);
            })();
          });
        },
        120,
      );
    },
    [
      clearOptimisticProtectedId,
      markOptimisticProtectedId,
      patchItemWithVersion,
      queueGraphCommit,
      recordUndoBeforeMutation,
    ],
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

  const createNewNode = useCallback((type: NodeTheme, loreVariant?: LoreCardVariant) => {
    if (isRestrictedLayer && type === "media") return;
    // Strict GM is for mirroring production when Neon persistence is on; local-only / demo / E2E
    // (`persistNeonRef` false) must still be able to mutate the canvas.
    if (
      strictGmWorkspaceSession &&
      persistNeonRef.current &&
      !isUuidLike(activeSpaceId)
    ) {
      window.alert(
        "This GM workspace is in strict sync mode. New items are disabled until a live Neon workspace is connected.",
      );
      return;
    }
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
    const tapeRotation =
      type === "faction" ? -1.2 : (Math.random() - 0.5) * 6;
    const nextZ = maxZIndexRef.current + 1;
    setMaxZIndex(nextZ);

    if (persistNeonRef.current && isUuidLike(activeSpaceId)) {
      const spaceId = activeSpaceId;
      if (type === "folder") {
        const fx = center.x - FOLDER_CARD_WIDTH / 2 + (Math.random() * 60 - 30);
        const fy = center.y - FOLDER_CARD_HEIGHT / 2 + (Math.random() * 60 - 30);
        const entityId = createId();
        const childSpaceId = createId();
        const optimisticFolder: CanvasFolderEntity = {
          id: entityId,
          title: "New Folder",
          kind: "folder",
          theme: "folder",
          childSpaceId,
          rotation,
          width: FOLDER_CARD_WIDTH,
          height: FOLDER_CARD_HEIGHT,
          tapeRotation: 0,
          stackId: null,
          stackOrder: null,
          slots: { [spaceId]: { x: fx, y: fy } },
        };
        setGraph((prev) => {
          const next = shallowCloneGraph(prev);
          next.spaces[childSpaceId] = {
            id: childSpaceId,
            name: "New Folder",
            parentSpaceId: spaceId,
            entityIds: [],
          };
          next.entities[entityId] = optimisticFolder;
          const sp = next.spaces[spaceId];
          if (sp) {
            next.spaces[spaceId] = { ...sp, entityIds: [...sp.entityIds, entityId] };
          }
          return next;
        });
        setSelectedNodeIds([entityId]);
        setPendingFolderTitleSelectId(entityId);
        const createPromise = (async () => {
          try {
            const spaceRes = await apiCreateSpace("New Folder", spaceId, { id: childSpaceId });
            if (!spaceRes.ok || !spaceRes.space?.id) {
              itemServerUpdatedAtRef.current.delete(entityId);
              setGraph((prev) => {
                const next = removeEntitiesFromGraphAfterRemoteDelete(prev, [entityId]);
                delete next.spaces[childSpaceId];
                return next;
              });
              setSelectedNodeIds((prev) => prev.filter((id) => id !== entityId));
              if (activeNodeIdRef.current === entityId) {
                setFocusOpen(false);
                setActiveNodeId(null);
              }
              window.alert(
                spaceRes.error?.trim() ||
                  "Could not create folder space. Check sync status or try again.",
              );
              return;
            }
            const itemRes = await apiCreateItem(spaceId, {
              id: entityId,
              itemType: "folder",
              x: fx,
              y: fy,
              width: FOLDER_CARD_WIDTH,
              height: FOLDER_CARD_HEIGHT,
              title: "New Folder",
              contentJson: buildContentJsonForFolderEntity(optimisticFolder),
              zIndex: nextZ,
            });
            if (!itemRes.ok || !itemRes.item) {
              itemServerUpdatedAtRef.current.delete(entityId);
              setGraph((prev) => {
                const next = removeEntitiesFromGraphAfterRemoteDelete(prev, [entityId]);
                delete next.spaces[childSpaceId];
                return next;
              });
              setSelectedNodeIds((prev) => prev.filter((id) => id !== entityId));
              if (activeNodeIdRef.current === entityId) {
                setFocusOpen(false);
                setActiveNodeId(null);
              }
              window.alert(
                itemRes.error?.trim() ||
                  "Could not create folder on the canvas. Check sync status or try again.",
              );
              return;
            }
            if (itemRes.item.updatedAt) {
              itemServerUpdatedAtRef.current.set(entityId, itemRes.item.updatedAt);
            }
          } catch (e) {
            itemServerUpdatedAtRef.current.delete(entityId);
            setGraph((prev) => {
              const next = removeEntitiesFromGraphAfterRemoteDelete(prev, [entityId]);
              delete next.spaces[childSpaceId];
              return next;
            });
            setSelectedNodeIds((prev) => prev.filter((id) => id !== entityId));
            if (activeNodeIdRef.current === entityId) {
              setFocusOpen(false);
              setActiveNodeId(null);
            }
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
        pendingCreatePromisesRef.current.set(entityId, createPromise);
        void createPromise.finally(() => {
          if (pendingCreatePromisesRef.current.get(entityId) === createPromise) {
            pendingCreatePromisesRef.current.delete(entityId);
          }
        });
        return;
      }

      let title = "New Note";
      const width = UNIFIED_NODE_WIDTH;
      let contentTheme: ContentTheme = "default";
      if (type === "code") contentTheme = "code";
      else if (type === "media") contentTheme = "media";
      else if (type === "task") contentTheme = "task";

      const entityId = createId();
      let bodyHtml = "";
      let bodyDoc: JSONContent | undefined;
      let loreCard: LoreCard | undefined;

      if (isLoreCreateNodeType(type)) {
        title = defaultTitleForLoreKind(type);
        const resolvedVariant = resolveLoreVariantForCreate(type, loreVariant);
        loreCard = { kind: type, variant: resolvedVariant };
        const locationStripSeed =
          type === "location" && resolvedVariant === "v3"
            ? globalThis.crypto?.randomUUID?.() ?? `loc-${Date.now()}`
            : undefined;
        bodyHtml = getLoreNodeSeedBodyHtml(
          type,
          resolvedVariant,
          locationStripSeed != null ? { locationStripSeed } : undefined,
        );
      } else if (type === "code") {
        title = "Snippet";
        bodyDoc = legacyCodeBodyHtmlToHgDocSeed("// [IN] Compose shard at cursor…");
        bodyHtml = hgDocToHtml(bodyDoc);
      } else if (type === "media") {
        title = "Untitled photo";
        bodyHtml = buildEmptyArchitecturalMediaBodyHtml({
          mediaFrameClass: styles.mediaFrame,
          imageSlotImgClass: styles.imageSlotImg,
          placeholderImgClasses: heartgardenMediaPlaceholderClassList("neutral"),
          mediaImageActionsClass: styles.mediaImageActions,
          mediaUploadBtnClass: styles.mediaUploadBtn,
          uploadLabel: mediaUploadActionLabel(false),
        });
      } else if (type === "task") {
        title = "Checklist";
        bodyDoc = newTaskHgDocSeed();
        bodyHtml = hgDocToHtml(bodyDoc);
      } else {
        bodyDoc = newDefaultHgDocSeed();
        bodyHtml = hgDocToHtml(bodyDoc);
      }

      const optimisticNode: CanvasContentEntity = {
        id: entityId,
        title,
        kind: "content",
        rotation,
        width,
        height: 280,
        theme: contentTheme,
        tapeVariant:
          loreCard != null
            ? tapeVariantForLoreCard(loreCard.kind, loreCard.variant)
            : tapeVariantForTheme(contentTheme),
        tapeRotation,
        bodyHtml,
        ...(bodyDoc != null ? { bodyDoc } : {}),
        loreCard,
        ...(loreCard?.kind === "faction" ? { factionRoster: createDefaultFactionRosterSeed() } : {}),
        stackId: null,
        stackOrder: null,
        slots: { [spaceId]: { x, y } },
      };
      setGraph((prev) => {
        const next = shallowCloneGraph(prev);
        next.entities[entityId] = optimisticNode;
        const sp = next.spaces[spaceId];
        if (sp) {
          next.spaces[spaceId] = { ...sp, entityIds: [...sp.entityIds, entityId] };
        }
        return next;
      });

      const createItemBody: Record<string, unknown> = {
        id: entityId,
        itemType: architecturalItemType(optimisticNode),
        x,
        y,
        width,
        height: 280,
        title,
        contentText: contentPlainTextForEntity(optimisticNode),
        contentJson: buildContentJsonForContentEntity(optimisticNode),
        zIndex: nextZ,
      };
      if (loreCard) createItemBody.entityType = loreCard.kind;

      const createPromise = (async () => {
        try {
          const itemRes = await apiCreateItem(spaceId, createItemBody);
          if (!itemRes.ok || !itemRes.item) {
            itemServerUpdatedAtRef.current.delete(entityId);
            setGraph((prev) => removeEntitiesFromGraphAfterRemoteDelete(prev, [entityId]));
            window.alert(
              itemRes.error?.trim() ||
                "Could not create item on the canvas. Check sync status or try again.",
            );
            return;
          }
          if (itemRes.item.updatedAt) {
            itemServerUpdatedAtRef.current.set(entityId, itemRes.item.updatedAt);
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
            return;
          }
          setGraph((prev) => {
            const next = shallowCloneGraph(prev);
            next.entities[entityId] = { ...entity, id: entityId };
            return next;
          });
        } catch (e) {
          itemServerUpdatedAtRef.current.delete(entityId);
          setGraph((prev) => removeEntitiesFromGraphAfterRemoteDelete(prev, [entityId]));
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
      pendingCreatePromisesRef.current.set(entityId, createPromise);
      void createPromise.finally(() => {
        if (pendingCreatePromisesRef.current.get(entityId) === createPromise) {
          pendingCreatePromisesRef.current.delete(entityId);
        }
      });
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
          height: FOLDER_CARD_HEIGHT,
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
      setSelectedNodeIds([entityId]);
      setPendingFolderTitleSelectId(entityId);
      return;
    }

    const id = createId();
    let title = "New Note";
    const width = UNIFIED_NODE_WIDTH;
    let contentTheme: ContentTheme = "default";
    if (type === "code") contentTheme = "code";
    else if (type === "media") contentTheme = "media";
    else if (type === "task") contentTheme = "task";

    let bodyHtml = "";
    let bodyDoc: JSONContent | undefined;
    let loreCard: LoreCard | undefined;

    if (isLoreCreateNodeType(type)) {
      title = defaultTitleForLoreKind(type);
      const resolvedVariant = resolveLoreVariantForCreate(type, loreVariant);
      loreCard = { kind: type, variant: resolvedVariant };
      const locationStripSeed = type === "location" && resolvedVariant === "v3" ? id : undefined;
      bodyHtml = getLoreNodeSeedBodyHtml(
        type,
        resolvedVariant,
        locationStripSeed != null ? { locationStripSeed } : undefined,
      );
    } else if (type === "code") {
      title = "Snippet";
      bodyDoc = legacyCodeBodyHtmlToHgDocSeed("// [IN] Compose shard at cursor…");
      bodyHtml = hgDocToHtml(bodyDoc);
    } else if (type === "media") {
      title = "Untitled photo";
      bodyHtml = buildEmptyArchitecturalMediaBodyHtml({
        mediaFrameClass: styles.mediaFrame,
        imageSlotImgClass: styles.imageSlotImg,
        placeholderImgClasses: heartgardenMediaPlaceholderClassList("neutral"),
        mediaImageActionsClass: styles.mediaImageActions,
        mediaUploadBtnClass: styles.mediaUploadBtn,
        uploadLabel: mediaUploadActionLabel(false),
      });
    } else if (type === "task") {
      title = "Checklist";
      bodyDoc = newTaskHgDocSeed();
      bodyHtml = hgDocToHtml(bodyDoc);
    } else {
      bodyDoc = newDefaultHgDocSeed();
      bodyHtml = hgDocToHtml(bodyDoc);
    }

    const nextNode = {
      id,
      title,
      kind: "content" as const,
      rotation,
      width,
      height: 280,
      theme: contentTheme,
      tapeVariant:
        loreCard != null
          ? tapeVariantForLoreCard(loreCard.kind, loreCard.variant)
          : tapeVariantForTheme(contentTheme),
      tapeRotation,
      bodyHtml,
      ...(bodyDoc != null ? { bodyDoc } : {}),
      loreCard,
      ...(loreCard?.kind === "faction" ? { factionRoster: createDefaultFactionRosterSeed() } : {}),
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
  }, [
    activeSpaceId,
    centerCoords,
    createId,
    isRestrictedLayer,
    recordUndoBeforeMutation,
    strictGmWorkspaceSession,
  ]);

  const createSingleImportedNote = useCallback(
    async (args: { title: string; text: string }) => {
      const title = args.title.trim().slice(0, 255) || "Imported document";
      const text = args.text.trim().slice(0, 120_000);
      if (!text) return false;
      const center = centerCoords();
      const x = center.x - 170 + (Math.random() * 40 - 20);
      const y = center.y - 110 + (Math.random() * 40 - 20);
      const rotation = (Math.random() - 0.5) * 4;
      const tapeRotation = (Math.random() - 0.5) * 6;
      const bodyHtml = `<p>${text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>")}</p>`;
      const nextZ = maxZIndexRef.current + 1;
      setMaxZIndex(nextZ);

      if (persistNeonRef.current && isUuidLike(activeSpaceId)) {
        const spaceId = activeSpaceId;
        const tempNode: CanvasContentEntity = {
          id: "",
          title,
          kind: "content",
          rotation,
          width: UNIFIED_NODE_WIDTH,
          height: 280,
          theme: "default",
          tapeVariant: tapeVariantForTheme("default"),
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
          width: UNIFIED_NODE_WIDTH,
          height: 280,
          title,
          contentText: text,
          contentJson: buildContentJsonForContentEntity(tempNode),
          zIndex: nextZ,
          entityType: "lore",
        });
        if (!itemRes.ok || !itemRes.item) return false;
        if (itemRes.item.updatedAt) {
          itemServerUpdatedAtRef.current.set(itemRes.item.id, itemRes.item.updatedAt);
        }
        const entity = canvasItemToEntity(itemRes.item, spaceId);
        if (!entity) return false;
        setGraph((prev) => {
          const next = shallowCloneGraph(prev);
          next.entities[entity.id] = entity;
          const sp = next.spaces[spaceId];
          if (sp) {
            next.spaces[spaceId] = { ...sp, entityIds: [...sp.entityIds, entity.id] };
          }
          return next;
        });
        setSelectedNodeIds([entity.id]);
        return true;
      }

      const id = createId();
      const nextNode: CanvasContentEntity = {
        id,
        title,
        kind: "content",
        rotation,
        width: UNIFIED_NODE_WIDTH,
        height: 280,
        theme: "default",
        tapeVariant: tapeVariantForTheme("default"),
        tapeRotation,
        bodyHtml,
        stackId: null,
        stackOrder: null,
        slots: { [activeSpaceId]: { x, y } },
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
      setSelectedNodeIds([id]);
      return true;
    },
    [activeSpaceId, centerCoords, createId],
  );

  const executeLoreImportWithParsed = useCallback(
    async (args: {
      parsedText: string;
      parsedFileName: string;
      parsedSuggestedTitle: string;
      sourceFileName: string;
      userContext: LoreImportUserContext;
      attemptId: string;
      planningAbort: AbortController;
      reportFailure: (detail: LoreImportFailureDetail) => void;
      unknownMessage: (error: unknown, fallback: string) => string;
    }) => {
      const {
        parsedText,
        parsedFileName,
        parsedSuggestedTitle,
        sourceFileName,
        userContext,
        attemptId,
        planningAbort,
        reportFailure,
        unknownMessage,
      } = args;
      const parsed = {
        text: parsedText,
        fileName: parsedFileName,
        suggestedTitle: parsedSuggestedTitle,
      };
      const file = { name: sourceFileName };
      const spaceId = activeSpaceIdRef.current;
      if (userContext.granularity === "one_note") {
        const ok = await createSingleImportedNote({
          title: parsed.suggestedTitle || parsed.fileName || file.name,
          text: parsedText,
        });
        if (!ok) {
          reportFailure(
            createLoreImportFailureDetail({
              attemptId,
              stage: "apply",
              operation: "create_single_import_note",
              message:
                "Could not create the imported note on the current canvas. Check sync status and retry.",
              fileName: parsed.fileName ?? file.name,
              spaceId,
              recommendedAction:
                "Retry import once. If this keeps failing, open sync status and include the attempt id.",
            }),
          );
        } else {
          playVigilUiSound("celebration");
        }
        return;
      }
      const useSmart = persistNeonRef.current && isUuidLike(spaceId) && parsedText.trim().length > 0;

      if (useSmart) {
        loreSmartPlanningAttemptRef.current = attemptId;
        setLoreSmartPlanningJobId(null);
        setLoreSmartReview(null);
        setLoreSmartAcceptedMergeIds({});
        setLoreSmartClarificationAnswers([]);
        setLoreSmartOtherFollowUp(null);
        setLoreSmartManualQuestionId(null);
        setLoreSmartTargetSpaceByNoteId({});
        setLoreSmartRelatedOpenByNoteId({});
        setLoreSmartSpaceSearchQuery("");
        setLoreSmartSpaceSearchResults([]);
        setLoreSmartIncludeSource(true);
        setLoreSmartPlanning(true);
        loreSmartPlanningStartedAtRef.current = Date.now();
        setLoreSmartPlanningEvents([]);
        setLoreSmartPlanningDetailsOpen(false);
        setLoreSmartPlanningProgress({ phase: "queued" });
        const applySmartPlanToUi = (plan: LoreImportPlan) => {
          const normalizedPlan = filterAutoResolvedClarifications(plan);
          setLoreSmartReview({
            plan: normalizedPlan,
            sourceText: parsedText,
            sourceTitle: parsed.suggestedTitle,
            fileName: parsed.fileName,
          });
          setLoreSmartClarificationAnswers([]);
          setLoreSmartOtherFollowUp(null);
          setLoreSmartManualQuestionId(null);
          const nextTargetSpaces: Record<string, string | null> = {};
          for (const note of normalizedPlan.notes) {
            nextTargetSpaces[note.clientId] = note.targetSpaceId ?? null;
          }
          setLoreSmartTargetSpaceByNoteId(nextTargetSpaces);
          setLoreSmartRelatedOpenByNoteId({});
          setLoreSmartSpaceSearchQuery("");
          setLoreSmartSpaceSearchResults([]);
          const nextMerge: Record<string, boolean> = {};
          for (const m of normalizedPlan.mergeProposals) {
            nextMerge[m.id] = false;
          }
          setLoreSmartAcceptedMergeIds(nextMerge);
        };
        let planningFailed = false;
        const reportPlanningFailure = (detail: LoreImportFailureDetail) => {
          planningFailed = true;
          setLoreSmartPlanningProgress({
            phase: "failed",
            message: detail.message,
            meta: detail.errorCode ? { errorCode: detail.errorCode } : undefined,
          });
          reportFailure(detail);
        };
        const tryDirectPlanFallback = async (queueFailureHint?: string): Promise<boolean> => {
          setLoreSmartPlanningProgress({
            phase: "fallback_plan",
            message: "Smart queue unavailable; planning directly",
            meta: queueFailureHint ? { queueFailureHint } : undefined,
          });
          const planRes = await fetch("/api/lore/import/plan", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Heartgarden-Import-Attempt": attemptId,
            },
            signal: planningAbort.signal,
            body: JSON.stringify({
              text: parsedText,
              spaceId,
              fileName: parsed.fileName,
              userContext,
              persistReview: false,
            }),
          });
          const planRaw = await planRes.text();
          const planBody = parseLoreImportJsonBody(planRaw) as {
            ok?: boolean;
            error?: string;
            plan?: LoreImportPlan;
          };
          if (!planRes.ok || !planBody.ok || !planBody.plan) {
            return false;
          }
          applySmartPlanToUi(planBody.plan);
          return true;
        };
        try {
          const jobRes = await fetch("/api/lore/import/jobs", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Heartgarden-Import-Attempt": attemptId,
            },
            signal: planningAbort.signal,
            body: JSON.stringify({
              text: parsedText,
              spaceId,
              fileName: parsed.fileName,
              userContext,
            }),
          });
          const jobRaw = await jobRes.text();
          const jobBody = parseLoreImportJsonBody(jobRaw) as {
            ok?: boolean;
            error?: string;
            detail?: string;
            hint?: string;
            errorCode?: string;
            dbCode?: string;
            dbTable?: string;
            dbColumn?: string;
            dbConstraint?: string;
            retryable?: boolean;
            jobId?: string;
          };
          if (!jobRes.ok || !jobBody.ok || !jobBody.jobId) {
            const queueFailureHint = summarizeQueueCreateFailure({
              status: jobRes.status,
              error: typeof jobBody.error === "string" ? jobBody.error : undefined,
              detail: typeof jobBody.detail === "string" ? jobBody.detail : undefined,
              hint: typeof jobBody.hint === "string" ? jobBody.hint : undefined,
              errorCode: typeof jobBody.errorCode === "string" ? jobBody.errorCode : undefined,
              dbCode: typeof jobBody.dbCode === "string" ? jobBody.dbCode : undefined,
            });
            console.warn("[lore-import] smart queue unavailable; using direct fallback", {
              attemptId,
              status: jobRes.status,
              queueFailureHint,
              errorCode: jobBody.errorCode,
              dbCode: jobBody.dbCode,
            });
            const usedFallback = await tryDirectPlanFallback(queueFailureHint).catch(() => false);
            if (usedFallback) return;
            reportPlanningFailure(
              createLoreImportFailureDetail({
                attemptId,
                stage: "job_create",
                operation: "POST /api/lore/import/jobs",
                message:
                  typeof jobBody.error === "string"
                    ? jobBody.error
                    : typeof jobBody.detail === "string"
                      ? jobBody.detail
                      : `Could not start import job (HTTP ${jobRes.status})`,
                responseSnippet: jobRaw,
                httpStatus: jobRes.status,
                errorCode:
                  typeof jobBody.errorCode === "string"
                    ? jobBody.errorCode
                    : typeof jobBody.dbCode === "string"
                      ? jobBody.dbCode
                      : undefined,
                serverDetail: typeof jobBody.detail === "string" ? jobBody.detail : undefined,
                serverHint: typeof jobBody.hint === "string" ? jobBody.hint : undefined,
                dbCode: typeof jobBody.dbCode === "string" ? jobBody.dbCode : undefined,
                dbTable: typeof jobBody.dbTable === "string" ? jobBody.dbTable : undefined,
                dbColumn: typeof jobBody.dbColumn === "string" ? jobBody.dbColumn : undefined,
                dbConstraint:
                  typeof jobBody.dbConstraint === "string" ? jobBody.dbConstraint : undefined,
                retryable: typeof jobBody.retryable === "boolean" ? jobBody.retryable : undefined,
                fileName: parsed.fileName ?? file.name,
                spaceId,
                recommendedAction:
                  "Confirm Neon/database is reachable and try again. If this repeats, share the snapshot.",
              }),
            );
          } else {
            const jobId = jobBody.jobId;
            setLoreSmartPlanningJobId(jobId);
            /** ~12 min — smart planning can run many LLM + vault passes on large sources. */
            const maxAttempts = 720;
            let pollFailed = false;
            let planFailed = false;
            let planReady = false;
            let stablePhaseCount = 0;
            let lastPhase = "";
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
              if (planningAbort.signal.aborted) return;
              const poll = await fetch(
                `/api/lore/import/jobs/${jobId}?spaceId=${encodeURIComponent(spaceId)}`,
                {
                  headers: { "X-Heartgarden-Import-Attempt": attemptId },
                  signal: planningAbort.signal,
                },
              );
              const pollRaw = await poll.text();
              const st = parseLoreImportJsonBody(pollRaw) as {
                ok?: boolean;
                status?: string;
                plan?: LoreImportPlan;
                error?: string;
                errorCode?: string;
                lastPhase?: string;
                attemptId?: string;
                progress?: LoreImportJobProgress;
                events?: unknown[];
              };
              if (!poll.ok || !st.ok) {
                reportPlanningFailure(
                  createLoreImportFailureDetail({
                    attemptId,
                    stage: "job_poll",
                    operation: "GET /api/lore/import/jobs/[jobId]",
                    message:
                      typeof st.error === "string"
                        ? st.error
                        : `Import job status request failed (HTTP ${poll.status})`,
                    responseSnippet: pollRaw,
                    httpStatus: poll.status,
                    jobId,
                    phase:
                      typeof st.lastPhase === "string"
                        ? st.lastPhase
                        : typeof st.progress?.phase === "string"
                          ? st.progress.phase
                          : undefined,
                    errorCode: typeof st.errorCode === "string" ? st.errorCode : undefined,
                    fileName: parsed.fileName ?? file.name,
                    spaceId,
                    recommendedAction:
                      "Wait a few seconds and retry import. If this repeats, copy the snapshot and include the job id.",
                  }),
                );
                pollFailed = true;
                break;
              }
              if (st.progress) {
                setLoreSmartPlanningProgress(st.progress);
                const phase = String(st.progress.phase ?? "");
                if (phase && phase === lastPhase) stablePhaseCount += 1;
                else {
                  stablePhaseCount = 0;
                  lastPhase = phase;
                }
              }
              if (Array.isArray(st.events)) {
                setLoreSmartPlanningEvents(normalizeLoreImportJobEvents(st.events));
              }
              if (st.status === "ready" && st.plan) {
                planReady = true;
                applySmartPlanToUi(st.plan);
                return;
              }
              if (st.status === "failed") {
                reportPlanningFailure(
                  createLoreImportFailureDetail({
                    attemptId,
                    stage: "plan_failed",
                    operation: "GET /api/lore/import/jobs/[jobId]",
                    message:
                      typeof st.error === "string"
                        ? st.error
                        : "Smart import plan failed. Try again or split the file.",
                    responseSnippet: pollRaw,
                    httpStatus: poll.status,
                    jobId,
                    phase:
                      typeof st.lastPhase === "string"
                        ? st.lastPhase
                        : typeof st.progress?.phase === "string"
                          ? st.progress.phase
                          : undefined,
                    errorCode: typeof st.errorCode === "string" ? st.errorCode : undefined,
                    fileName: parsed.fileName ?? file.name,
                    spaceId,
                    recommendedAction:
                      "Try splitting the source file into smaller chunks, then retry. Share snapshot if failure persists.",
                  }),
                );
                planFailed = true;
                break;
              }
              const delayMs = stablePhaseCount >= 12 ? 3000 : stablePhaseCount >= 6 ? 2000 : 1000;
              await abortableDelay(delayMs, planningAbort.signal);
            }
            if (!planReady && !pollFailed && !planFailed) {
              reportPlanningFailure(
                createLoreImportFailureDetail({
                  attemptId,
                  stage: "timeout",
                  operation: "GET /api/lore/import/jobs/[jobId]",
                  message:
                    "Import planning is taking too long. The server may still be working in the background.",
                  jobId,
                  phase: lastPhase || "unknown",
                  fileName: parsed.fileName ?? file.name,
                  spaceId,
                  recommendedAction:
                    "Wait 30-60 seconds and retry. If this keeps timing out on the same phase, split the source and rerun.",
                }),
              );
            }
          }
        } catch (error) {
          if (isAbortError(error) || planningAbort.signal.aborted) {
            console.info("[lore-import] planning cancelled by user", { attemptId });
            return;
          }
          const queueFailureHint = unknownMessage(error, "Smart import job request failed.");
          console.warn("[lore-import] smart queue request threw; using direct fallback", {
            attemptId,
            queueFailureHint,
          });
          const usedFallback = await tryDirectPlanFallback(queueFailureHint).catch(() => false);
          if (usedFallback) return;
          reportPlanningFailure(
            createLoreImportFailureDetail({
              attemptId,
              stage: "job_create",
              operation: "POST /api/lore/import/jobs",
              message: unknownMessage(error, "Smart import job request failed."),
              fileName: parsed.fileName ?? file.name,
              spaceId,
              recommendedAction:
                "Check network/boot session and retry import. Copy diagnostics if this keeps failing.",
            }),
          );
        } finally {
          if (
            loreSmartPlanningAbortRef.current === planningAbort &&
            loreSmartPlanningAttemptRef.current === attemptId
          ) {
            setLoreSmartPlanningJobId(null);
            if (!planningFailed) {
              setLoreSmartPlanning(false);
              setLoreSmartPlanningProgress(null);
              loreSmartPlanningStartedAtRef.current = null;
              setLoreSmartPlanningEvents([]);
              setLoreSmartPlanningDetailsOpen(false);
            }
            loreSmartPlanningAttemptRef.current = null;
          }
        }
        return;
      }

      reportFailure(
        createLoreImportFailureDetail({
          attemptId,
          stage: "parse",
          operation: "smart_import_prerequisite",
          message: "Smart import requires a connected Neon space. Connect your workspace and retry.",
          fileName: parsed.fileName ?? file.name,
          spaceId,
          recommendedAction: "Switch to a connected Neon workspace, then retry this import.",
        }),
      );
    },
    [createSingleImportedNote],
  );

  const onLoreImportFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const isPdfFile = file.name.toLowerCase().endsWith(".pdf");
      const selection = loreImportSelection;
      const userContext = mapSelectionToUserContext(selection, file.name);
      const attemptId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `import-attempt-${Date.now()}`;
      loreSmartPlanningAttemptRef.current = null;
      loreSmartPlanningAbortRef.current?.abort();
      const planningAbort = new AbortController();
      loreSmartPlanningAbortRef.current = planningAbort;
      setLoreImportFailure(null);
      const reportFailure = (detail: LoreImportFailureDetail) => {
        console.error(
          "[lore-import]",
          detail.stage,
          detail.operation,
          detail.httpStatus ?? "no_http_status",
          detail.message,
          { attemptId: detail.attemptId, jobId: detail.jobId, phase: detail.phase },
        );
        playVigilUiSound("caution");
        setLoreImportFailure(detail);
      };
      const unknownMessage = (error: unknown, fallback: string) =>
        error instanceof Error ? error.message : fallback;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("context", JSON.stringify(userContext));
      const localPdfParsePayload = async (
        reason: "preflight_oversize" | "http_413_fallback",
      ): Promise<{
        ok: true;
        text: string;
        fileName: string;
        suggestedTitle: string;
      } | null> => {
        try {
          const local = await parsePdfInBrowser(file, planningAbort.signal);
          console.info("[lore-import] parse pdf local fallback success", {
            attemptId,
            fileName: file.name,
            fileBytes: file.size,
            reason,
            pageCount: local.pageCount,
            parsedPages: local.parsedPages,
            failedPages: local.failedPages,
            truncated: local.truncated,
          });
          return {
            ok: true,
            text: local.text,
            fileName: file.name,
            suggestedTitle: loreImportSuggestedTitle(file.name),
          };
        } catch (error) {
          if (isAbortError(error)) throw error;
          const detail = error instanceof Error ? error.message : String(error);
          reportFailure(
            createLoreImportFailureDetail({
              attemptId,
              stage: "parse",
              operation: "parse_pdf_client_fallback",
              message: `PDF parse failed in browser (${detail})`,
              fileName: file.name,
              spaceId: activeSpaceIdRef.current,
              recommendedAction:
                "Try a smaller PDF or export to text/markdown, then retry. If this repeats, copy the snapshot and share it.",
            }),
          );
          return null;
        }
      };
      try {
        let parseRes: Response | null = null;
        let parseRaw = "";
        let parsed = null as null | {
          ok?: boolean;
          error?: string;
          detail?: string;
          text?: string;
          fileName?: string;
          suggestedTitle?: string;
        };
        if (isPdfFile && shouldUseLocalPdfParse(file)) {
          parsed = await localPdfParsePayload("preflight_oversize");
          if (!parsed) return;
        } else {
          parseRes = await fetch("/api/lore/import/parse", {
            method: "POST",
            body: fd,
            headers: { "X-Heartgarden-Import-Attempt": attemptId },
            signal: planningAbort.signal,
          });
          parseRaw = await parseRes.text();
          parsed = parseLoreImportJsonBody(parseRaw) as {
            ok?: boolean;
            error?: string;
            detail?: string;
            text?: string;
            fileName?: string;
            suggestedTitle?: string;
          };
        }
        if (!parsed || !parsed.ok || typeof parsed.text !== "string") {
          if (parseRes?.status === 413 && isPdfFile) {
            const fallbackParsed = await localPdfParsePayload("http_413_fallback");
            if (fallbackParsed) {
              parsed = fallbackParsed;
            } else {
              return;
            }
          }
        }
        if (!parsed || !parsed.ok || typeof parsed.text !== "string") {
          const parsedError = typeof parsed?.error === "string" ? parsed.error : undefined;
          const parsedDetail = typeof parsed?.detail === "string" ? parsed.detail : undefined;
          reportFailure(
            createLoreImportFailureDetail({
              attemptId,
              stage: "parse",
              operation: "POST /api/lore/import/parse",
              message: parsedError || parsedDetail || `Parse failed (HTTP ${parseRes?.status ?? "unknown"})`,
              responseSnippet: parseRaw,
              httpStatus: parseRes?.status,
              fileName: file.name,
              spaceId: activeSpaceIdRef.current,
              recommendedAction:
                "Check file type/content and retry. If this repeats, copy the snapshot and share it.",
            }),
          );
          return;
        }

        setLoreImportPreparedSource({
          text: parsed.text,
          fileName: parsed.fileName || file.name,
          suggestedTitle: parsed.suggestedTitle || loreImportSuggestedTitle(file.name),
        });
        setLoreImportPopoverOpen(true);
        playVigilUiSound("select");
      } catch (error) {
        if (isAbortError(error) || planningAbort.signal.aborted) {
          console.info("[lore-import] import parse cancelled by user", { attemptId });
          return;
        }
        reportFailure(
          createLoreImportFailureDetail({
            attemptId,
            stage: "unknown",
              operation: "onLoreImportFileChange",
            message: unknownMessage(error, "Import request failed"),
            fileName: file.name,
            spaceId: activeSpaceIdRef.current,
            recommendedAction:
              "Retry import. If this repeats, copy support snapshot and include the stage/attempt id.",
          }),
        );
      }
      finally {
        if (loreSmartPlanningAbortRef.current === planningAbort) {
          loreSmartPlanningAbortRef.current = null;
        }
      }
    },
    [loreImportSelection],
  );

  const continuePreparedLoreImport = useCallback(async () => {
    const prepared = loreImportPreparedSource;
    if (!prepared) {
      playVigilUiSound("caution");
      return;
    }
    setLoreImportPopoverOpen(false);
    const userContext = mapSelectionToUserContext(loreImportSelection, prepared.fileName);
    const attemptId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `import-attempt-${Date.now()}`;
    loreSmartPlanningAttemptRef.current = null;
    loreSmartPlanningAbortRef.current?.abort();
    const planningAbort = new AbortController();
    loreSmartPlanningAbortRef.current = planningAbort;
    setLoreImportFailure(null);
    const reportFailure = (detail: LoreImportFailureDetail) => {
      console.error(
        "[lore-import]",
        detail.stage,
        detail.operation,
        detail.httpStatus ?? "no_http_status",
        detail.message,
        { attemptId: detail.attemptId, jobId: detail.jobId, phase: detail.phase },
      );
      playVigilUiSound("caution");
      setLoreImportFailure(detail);
    };
    const unknownMessage = (error: unknown, fallback: string) =>
      error instanceof Error ? error.message : fallback;
    try {
      await executeLoreImportWithParsed({
        parsedText: prepared.text,
        parsedFileName: prepared.fileName,
        parsedSuggestedTitle: prepared.suggestedTitle,
        sourceFileName: prepared.fileName,
        userContext,
        attemptId,
        planningAbort,
        reportFailure,
        unknownMessage,
      });
    } finally {
      if (loreSmartPlanningAbortRef.current === planningAbort) {
        loreSmartPlanningAbortRef.current = null;
      }
    }
  }, [executeLoreImportWithParsed, loreImportPreparedSource, loreImportSelection]);

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
    if (actionId === "create-character") {
      createNewNode("character");
      playVigilUiSound("select");
      return;
    }
    if (actionId === "create-organization") {
      createNewNode("faction");
      playVigilUiSound("select");
      return;
    }
    if (actionId === "create-location") {
      createNewNode("location");
      playVigilUiSound("select");
      return;
    }
    if (actionId === "export-json") {
      playVigilUiSound("button");
      exportGraphJson();
      return;
    }
    if (actionId === "toggle-canvas-effects") {
      setCanvasEffectsEnabled((v) => !v);
      playVigilUiSound("select");
      return;
    }
    if (actionId === "zoom-fit") {
      applyFitAllToViewport();
      return;
    }
    if (actionId === "zoom-selection") {
      const ids = selectedNodeIdsRef.current.filter((id) =>
        (graphRef.current.spaces[activeSpaceIdRef.current]?.entityIds ?? []).includes(id),
      );
      if (ids.length === 0) {
        playVigilUiSound("caution");
        return;
      }
      const viewport = viewportRef.current?.getBoundingClientRect();
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const next = fitCameraToSelection(
        graphRef.current,
        activeSpaceIdRef.current,
        ids,
        width,
        height,
        MIN_ZOOM,
        MAX_ZOOM,
      );
      if (next) {
        setScale(next.scale);
        setTranslateX(next.translateX);
        setTranslateY(next.translateY);
      }
      playVigilUiSound("select");
      return;
    }
    if (actionId === "recenter") {
      recenterToOrigin();
      playVigilUiSound("select");
      return;
    }
    if (actionId === "ask-lore") {
      setLorePanelOpen((v) => !v);
      playVigilUiSound("select");
      return;
    }
    if (actionId === "link-graph") {
      setGraphOverlayOpen((v) => !v);
      playVigilUiSound("select");
      return;
    }
    if (actionId === "import-lore") {
      playVigilUiSound("select");
      beginLoreImportFilePick();
      return;
    }
    if (actionId === "check-lore-consistency") {
      if (bootLayerVisible) {
        playVigilUiSound("caution");
        return;
      }
      setLoreReviewError(null);
      setLoreReviewPanelOpen(true);
      playVigilUiSound("select");
      return;
    }
  }, [
    applyFitAllToViewport,
    bootLayerVisible,
    createNewNode,
    exportGraphJson,
    isRestrictedLayer,
    beginLoreImportFilePick,
    recenterToOrigin,
    setCanvasEffectsEnabled,
    setGraphOverlayOpen,
    setLorePanelOpen,
    setLoreReviewError,
    setLoreReviewPanelOpen,
  ]);

  const updateDropTargets = useCallback(
    (draggedEntityId: string, pointerClientX?: number, pointerClientY?: number) => {
      const domRoot: ParentNode = shellRef.current ?? document;
      const draggedGroup =
        draggedNodeIdsRef.current.length > 0 ? draggedNodeIdsRef.current : [draggedEntityId];
      const draggedEntity = graph.entities[draggedEntityId];
      const sharedStackId =
        draggedEntity?.stackId &&
        draggedGroup.every((id) => graph.entities[id]?.stackId === draggedEntity.stackId)
          ? draggedEntity.stackId
          : null;
      const draggedEl = sharedStackId
        ? domRoot.querySelector<HTMLElement>(`[data-stack-container='true'][data-stack-id='${sharedStackId}']`)
        : domRoot.querySelector<HTMLElement>(`[data-node-id="${draggedEntityId}"]`);
      let dragRect: DOMRect | null = null;
      if (sharedStackId && draggedEl) {
        dragRect = unionBoundingRectFromStackLayers(draggedEl);
      }
      if (!dragRect && draggedEl) {
        dragRect = draggedEl.getBoundingClientRect();
      }
      if (!dragRect) {
        const rects = draggedGroup
          .map((id) => domRoot.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.getBoundingClientRect())
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
      Array.from(domRoot.querySelectorAll<HTMLElement>("[data-folder-drop='true']")).forEach(
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
        Array.from(domRoot.querySelectorAll<HTMLElement>("[data-stack-target]")).forEach(
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

  const handleDropRef = useRef(handleDrop);
  handleDropRef.current = handleDrop;
  const updateDropTargetsRef = useRef(updateDropTargets);
  updateDropTargetsRef.current = updateDropTargets;
  const persistNeonItemsLayoutRef = useRef(persistNeonItemsLayout);
  persistNeonItemsLayoutRef.current = persistNeonItemsLayout;
  // REVIEW_2026-04-22-2 H3: coalesce drop-target hit-tests to at most one per
  // animation frame. Each call to `updateDropTargets` performs many
  // `getBoundingClientRect` reads; running it unthrottled on every pointermove
  // causes per-frame layout thrash on dense canvases. A single pending rAF
  // handle is sufficient because the hit-test only needs the newest pointer
  // position, which we already stash in `dragPointerScreenRef`.
  const dropTargetRafHandleRef = useRef<number | null>(null);
  const dropTargetPendingDraggedIdRef = useRef<string | null>(null);
  const scheduleUpdateDropTargets = (draggedId: string) => {
    dropTargetPendingDraggedIdRef.current = draggedId;
    if (dropTargetRafHandleRef.current !== null) return;
    const run = () => {
      dropTargetRafHandleRef.current = null;
      const pendingId = dropTargetPendingDraggedIdRef.current;
      dropTargetPendingDraggedIdRef.current = null;
      if (!pendingId) return;
      const { x, y } = dragPointerScreenRef.current;
      updateDropTargetsRef.current(pendingId, x, y);
    };
    if (typeof requestAnimationFrame === "function") {
      dropTargetRafHandleRef.current = requestAnimationFrame(run);
    } else {
      dropTargetRafHandleRef.current = window.setTimeout(run, 16) as unknown as number;
    }
  };
  // Coalesce pan translate updates to one per animation frame. High-resolution
  // pointer devices fire `pointermove` 500–1000Hz; calling `setTranslateX` /
  // `setTranslateY` on every event has tripped React 19's nested-update guard
  // when other camera-derived effects re-run between frames. rAF caps state
  // updates to display refresh rate while keeping the latest pointer position.
  const panRafHandleRef = useRef<number | null>(null);
  const panPendingTranslateRef = useRef<{ tx: number; ty: number } | null>(null);
  const cancelPanRaf = () => {
    if (panRafHandleRef.current === null) return;
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(panRafHandleRef.current);
    } else {
      window.clearTimeout(panRafHandleRef.current);
    }
    panRafHandleRef.current = null;
  };
  const flushPanPending = () => {
    const next = panPendingTranslateRef.current;
    panPendingTranslateRef.current = null;
    if (!next) return;
    setTranslateX((prev) => (prev === next.tx ? prev : next.tx));
    setTranslateY((prev) => (prev === next.ty ? prev : next.ty));
  };
  const schedulePanTranslate = (nextTx: number, nextTy: number) => {
    panPendingTranslateRef.current = { tx: nextTx, ty: nextTy };
    if (panRafHandleRef.current !== null) return;
    const run = () => {
      panRafHandleRef.current = null;
      flushPanPending();
    };
    if (typeof requestAnimationFrame === "function") {
      panRafHandleRef.current = requestAnimationFrame(run);
    } else {
      panRafHandleRef.current = window.setTimeout(run, 16) as unknown as number;
    }
  };

  useEffect(() => {
    // Window-level listeners are intentionally stable; handlers must read mutable refs, not stale closure state.
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
        const nextTx = event.clientX - panStartRef.current.x;
        const nextTy = event.clientY - panStartRef.current.y;
        schedulePanTranslate(nextTx, nextTy);
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
      const spaceId = activeSpaceIdRef.current;
      setGraph((prev) => {
        const nextEntities = { ...prev.entities };
        let changed = false;
        draggedIds.forEach((id) => {
          const entity = prev.entities[id];
          const offset = dragOffsetsRef.current[id];
          if (!entity || !offset) return;
          const currentSlot = entity.slots[spaceId];
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
              [spaceId]: {
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
      scheduleUpdateDropTargets(draggedIds[0]);
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

      // Cancel any queued rAF and apply the latest pan position synchronously
      // so the camera lands exactly where the pointer ended (no trailing frame).
      if (panRafHandleRef.current !== null) {
        cancelPanRaf();
        flushPanPending();
      }
      isPanningRef.current = false;
      setIsPanning(false);
      if (draggedNodeIdsRef.current.length > 0) {
        const ids = [...draggedNodeIdsRef.current];
        // REVIEW_2026-04-22-2 H3: cancel any pending rAF hit-test before we do
        // the final synchronous one, so the trailing frame can't fire stale.
        if (dropTargetRafHandleRef.current !== null) {
          if (typeof cancelAnimationFrame === "function") {
            cancelAnimationFrame(dropTargetRafHandleRef.current);
          } else {
            window.clearTimeout(dropTargetRafHandleRef.current);
          }
          dropTargetRafHandleRef.current = null;
          dropTargetPendingDraggedIdRef.current = null;
        }
        updateDropTargetsRef.current(ids[0], dragPointerScreenRef.current.x, dragPointerScreenRef.current.y);
        void handleDropRef.current(ids).then(() => {
          if (!persistNeonRef.current) return;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              persistNeonItemsLayoutRef.current(ids);
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
      parentDropHoveredRef.current = false;
      setParentDropHovered(false);
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
      cancelPanRaf();
      panPendingTranslateRef.current = null;
    };
    /* Intentionally no deps: handleDrop/updateDropTargets change every pan frame via centerCoords →
     * re-binding window listeners on those deps causes max update depth during pan (pointermove).
     * `schedulePanTranslate` is recreated each render but only references stable refs + setters. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              persistNeonItemsLayoutRef.current(persistIds);
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
          requestAnimationFrame(() => persistNeonItemsLayoutRef.current(ordered));
        }
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp, true);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp, true);
    };
  }, [closeStackModal, stackModal, viewportSize]);

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
      if (target.closest("[data-hg-sync-popover='true']")) return;
      /* Draw/cut must complete even when the click lands on TipTap (`data-hg-doc-editor`); only skip in move mode. */
      if (connectionMode === "move" && target.closest("[data-hg-doc-editor]")) {
        return;
      }
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
            const row = target.closest<HTMLElement>("[data-faction-roster-entry-id]");
            const rowHost = row?.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
            if (row?.dataset.factionRosterEntryId && rowHost === nodeId) {
              connectionRosterAnchorRef.current = {
                factionNodeId: nodeId,
                rosterEntryId: row.dataset.factionRosterEntryId,
              };
            } else {
              connectionRosterAnchorRef.current = null;
            }
            setConnectionSourceId(nodeId);
          } else if (connectionSourceId === nodeId) {
            setConnectionSourceId(null);
          } else {
            const endpointA = connectionSourceId;
            const endpointB = nodeId;
            let rosterEntryId = resolveFactionRosterEntryIdFromDrawTarget(
              target,
              endpointA,
              endpointB,
            );
            if (!rosterEntryId && connectionRosterAnchorRef.current) {
              const anchor = connectionRosterAnchorRef.current;
              if (anchor.factionNodeId === endpointA || anchor.factionNodeId === endpointB) {
                rosterEntryId = anchor.rosterEntryId;
              }
            }
            connectionRosterAnchorRef.current = null;
            setConnectionSourceId(null);

            const semanticEval = runSemanticThreadLinkEvaluation(
              graphRef.current.entities,
              endpointA,
              endpointB,
              rosterEntryId,
            );

            if (semanticEval.kind === "block") {
              setThreadRosterNotice(semanticEval.message);
              return;
            }

            if (semanticEval.kind === "connect_and_patch") {
              recordUndoBeforeMutation();
              createConnection(endpointA, endpointB, { skipUndo: true });
              const { patch } = semanticEval;
              const patchedForNeon: CanvasContentEntity[] = [];
              setGraph((prev) => {
                const entities = { ...prev.entities };
                for (const [eid, updater] of Object.entries(patch.entityUpdates)) {
                  const cur = entities[eid];
                  if (cur?.kind !== "content") continue;
                  const next = updater(cur);
                  entities[eid] = next;
                  if (isUuidLike(eid)) patchedForNeon.push(next);
                }
                return { ...prev, entities };
              });
              if (persistNeonRef.current) {
                const seenPersist = new Set<string>();
                for (const merged of patchedForNeon) {
                  if (seenPersist.has(merged.id)) continue;
                  seenPersist.add(merged.id);
                  void patchItemWithVersion(merged.id, {
                    contentText: contentPlainTextForEntity(merged),
                    contentJson: buildContentJsonForContentEntity(merged),
                  });
                }
              }
            } else {
              createConnection(endpointA, endpointB);
            }

            if (semanticEval.kind === "connect_only" && semanticEval.notice) {
              setThreadRosterNotice(semanticEval.notice);
            }
          }
          return;
        }
        if (connectionMode === "cut") {
          return;
        }
      }

      if (focusOpenRef.current || galleryOpenRef.current) return;
      if (activeTool === "pan" || spacePanRef.current) return;
      if (event.button !== 0) return;
      if (target.closest("[data-stack-container='true']")) return;
      /* Folder face (.folderFront) must arm drag/select like other cards; only the title
       * editor, chrome buttons, and note bodies opt out. Double-click to open uses React
       * onDoubleClick on ArchitecturalFolderCard (with stopPropagation). */
      const inBody = !!target.closest(`.${styles.nodeBody}`);
      const loroOrdoDragChrome = targetIsLoreLocationOrdoCanvasDragChrome(target);
      const facArcDragChrome = targetIsLoreFactionArchiveCanvasDragChrome(target);
      const inLoreLocationOrdoV7Canvas = !!target.closest(
        '[data-hg-canvas-role="lore-location"][data-lore-variant="v7"]',
      );
      const inLoreFactionArchiveCanvas = !!target.closest(
        '[data-hg-canvas-role="lore-faction"][data-lore-variant="v4"]',
      );
      const inContent =
        (inBody &&
          !targetIsLoreCharacterV11CanvasDragChrome(target) &&
          !loroOrdoDragChrome &&
          !facArcDragChrome) ||
        /* ORDO v7 uses LoreLocationOrdoV7Slab without `.nodeBody`; treat the slab as content unless the hit is the drag handle. */
        (inLoreLocationOrdoV7Canvas && !loroOrdoDragChrome) ||
        (inLoreFactionArchiveCanvas && !facArcDragChrome) ||
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
            const sel = selectedNodeIdsRef.current;
            const spaceEntityIds =
              graphRef.current.spaces[activeSpaceIdRef.current]?.entityIds ?? [];
            const inSpace = new Set(spaceEntityIds);
            const dragGroup =
              sel.includes(nodeId) && sel.length > 1
                ? [nodeId, ...sel.filter((id) => id !== nodeId && inSpace.has(id))]
                : [nodeId];
            recordUndoBeforeMutation();
            setSelectedNodeIds(dragGroup);
            draggedNodeIdsRef.current = dragGroup;
            setDraggedNodeIds(dragGroup);
            dragPointerScreenRef.current = { x: event.clientX, y: event.clientY };

            const { tx, ty, scale: viewScale } = viewRef.current;
            const mouseCanvasX = (event.clientX - tx) / viewScale;
            const mouseCanvasY = (event.clientY - ty) / viewScale;
            const offsets: Record<string, { x: number; y: number }> = {};
            const spaceId = activeSpaceIdRef.current;
            dragGroup.forEach((id) => {
              const dragEntity = graphRef.current.entities[id];
              const slot = dragEntity?.slots[spaceId];
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
      if (!expandBtn || expandBtn.closest(`.${styles.nodeHeader}`)) return;
      const entity = expandBtn.closest<HTMLElement>(`[data-node-id]`);
      const id = entity?.dataset.nodeId;
      if (id) {
        handleNodeExpand(id);
        return;
      }
      if (
        expandBtn.closest("[data-focus-body-editor='true']") &&
        focusOpenRef.current &&
        activeNodeIdRef.current
      ) {
        handleNodeExpand(activeNodeIdRef.current);
      }
    };

    const onDoubleClick = (event: MouseEvent) => {
      const target = pointerEventTargetElement(event.target);
      if (!target) return;

      if (connectionMode === "draw" || connectionMode === "cut") {
        if (focusOpenRef.current || galleryOpenRef.current || stackModalRef.current) return;
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

      const node = graphRef.current.entities[id];
      if (
        node?.kind === "content" &&
        node.theme === "media" &&
        target.closest("[data-image-open-gallery]")
      ) {
        handleNodeExpand(id);
        return;
      }

      /* Lore character plate has no `.nodeHeader`; treat the body like other cards (dblclick → focus). */
      const inLoreCharCanvas =
        node?.kind === "content" &&
        !!target.closest('[data-hg-canvas-role="lore-character-v11"]') &&
        !!target.closest(`.${styles.nodeBody}`);
      if (inLoreCharCanvas) {
        if (
          target.closest("[data-expand-btn='true']") ||
          target.closest("[data-architectural-media-upload='true']")
        ) {
          return;
        }
        openFocusMode(id);
        return;
      }

      const inLoreLocationOrdoCanvas =
        node?.kind === "content" &&
        !!target.closest('[data-hg-canvas-role="lore-location"][data-lore-variant="v7"]');
      if (inLoreLocationOrdoCanvas) {
        if (target.closest("[data-expand-btn='true']")) {
          return;
        }
        openFocusMode(id);
        return;
      }

      const inLoreFactionArchive091Canvas =
        node?.kind === "content" &&
        !!target.closest('[data-hg-canvas-role="lore-faction"][data-lore-variant="v4"]');
      if (inLoreFactionArchive091Canvas) {
        if (target.closest("[data-expand-btn='true']")) {
          return;
        }
        openFocusMode(id);
        return;
      }

      const editableWithinNode =
        isEditableTarget(event.target) ||
        !!target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']");
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
    activeTool,
    connectionMode,
    connectionSourceId,
    createConnection,
    handleNodeExpand,
    openFocusMode,
    openFolder,
    patchItemWithVersion,
    recordUndoBeforeMutation,
    setGraph,
    setThreadRosterNotice,
    updateNodeBody,
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
      let idsToRemove: string[] = [];
      let spaceRoots: string[] = [];
      let moveOps: ReturnType<typeof collectFolderPopOutPlan>["entityMoves"] = [];
      let reparentOps: ReturnType<typeof collectFolderPopOutPlan>["spaceReparents"] = [];
      recordUndoBeforeMutation();
      setGraph((prev) => {
        const folderIds = entityIds.filter((id) => prev.entities[id]?.kind === "folder");
        const popOutPlan = collectFolderPopOutPlan(prev, folderIds);
        const graphAfterPopOut = applyFolderPopOutPlan(prev, popOutPlan);
        const closure = collectDeletionClosure(graphAfterPopOut, entityIds);
        idsToRemove = closure.entityIds;
        const spaceIds = closure.spaceIds;
        spaceRoots = filterSpaceDeletionRoots(spaceIds, graphAfterPopOut);
        const idsToRemoveSet = new Set(idsToRemove);
        const spaceIdsToRemoveSet = new Set(spaceIds);
        moveOps = popOutPlan.entityMoves.filter((move) => !idsToRemoveSet.has(move.entityId));
        reparentOps = popOutPlan.spaceReparents.filter(
          (reparent) => !spaceIdsToRemoveSet.has(reparent.spaceId),
        );
        const next = applyFolderPopOutPlan(prev, popOutPlan);
        const entityIdsToDelete = new Set(idsToRemove);
        Object.values(next.spaces).forEach((space) => {
          next.spaces[space.id] = {
            ...space,
            entityIds: space.entityIds.filter((id) => !entityIdsToDelete.has(id)),
          };
        });

        idsToRemove.forEach((entityId) => {
          delete next.entities[entityId];
        });
        closure.spaceIds.forEach((spaceId) => {
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
        void (async () => {
          const moveResults = await Promise.all(
            moveOps.map(async (move) => {
              if (!isUuidLike(move.entityId)) return true;
              const result = await apiPatchItem(move.entityId, {
                spaceId: move.toSpaceId,
                x: move.newSlot.x,
                y: move.newSlot.y,
              });
              return result.ok === true;
            }),
          );
          const reparentResults = await Promise.all(
            reparentOps.map(async (reparent) => {
              if (!isUuidLike(reparent.spaceId)) return true;
              return apiPatchSpaceParent(reparent.spaceId, reparent.newParentId);
            }),
          );
          if (moveResults.some((ok) => !ok) || reparentResults.some((ok) => !ok)) {
            neonSyncReportAuxiliaryFailure({
              operation: "folder delete pop-out persistence",
              message:
                "Could not persist one or more pop-out moves; skipped remote deletes to avoid data loss.",
              cause: "http",
            });
            return;
          }
          await Promise.all(
            idsToRemove.map(async (id) => {
              if (!isUuidLike(id)) return;
              await apiDeleteItem(id);
            }),
          );
          await Promise.all(
            spaceRoots.map(async (sid) => {
              if (!isUuidLike(sid)) return;
              await apiDeleteSpaceSubtree(sid);
            }),
          );
        })();
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
      const editId = loreCanvasBodyEditEntityId;
      if (editId && selectedNodeIdsRef.current.includes(editId)) {
        event.preventDefault();
        setLoreCanvasBodyEditEntityId(null);
        return;
      }
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
    loreCanvasBodyEditEntityId,
    parentSpaceId,
    setParentDropHover,
    stackModal,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (paletteOpenRef.current || lorePanelOpenRef.current) return;
      const isDeleteKey = event.key === "Delete" || event.key === "Backspace";
      if (!isDeleteKey) return;
      if (focusOpen || galleryOpen) return;
      const ids = selectedNodeIdsRef.current;
      if (ids.length === 0) return;
      const target = event.target;
      if (isEditableTarget(target)) {
        if (!shouldAllowCanvasDeleteWhileEditableBodyFocused(target, ids, event)) return;
        event.preventDefault();
        event.stopPropagation();
      } else {
        event.preventDefault();
      }
      deleteEntitySelection([...ids]);
    };

    /* Capture: run before TipTap / contenteditable handlers so we can remove the node instead of editing. */
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [deleteEntitySelection, focusOpen, galleryOpen]);

  const onViewportPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary) return;
      if (focusOpenRef.current || galleryOpenRef.current || stackModalRef.current) return;

      // Middle mouse drag always pans (tool-agnostic), similar to design tools.
      if (event.button === 1) {
        event.preventDefault();
        isPanningRef.current = true;
        setIsPanning(true);
        const { tx, ty } = viewRef.current;
        panStartRef.current = {
          x: event.clientX - tx,
          y: event.clientY - ty,
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
      const { tx, ty } = viewRef.current;
      panStartRef.current = {
        x: event.clientX - tx,
        y: event.clientY - ty,
      };
    },
    [activeTool, connectionMode],
  );

  /**
   * macOS trackpad (Figma-style): two-finger pan → wheel deltaX/Y; pinch → ctrl/meta + wheel.
   * React’s root `wheel` delegation is passive, so `preventDefault()` does not stop browser
   * scrolling; use a non-passive listener on the viewport.
   */
  useLayoutEffect(() => {
    const root = viewportRef.current;
    if (!root) return;

    const onWheelNative = (event: WheelEvent) => {
      if (
        focusOpenRef.current ||
        galleryOpenRef.current ||
        stackModalRef.current ||
        paletteOpenRef.current ||
        lorePanelOpenRef.current
      ) {
        return;
      }
      const target = wheelEventOriginHTMLElement(event);
      if (!target) return;

      const scrollPort = nearestVerticalScrollportInViewport(target, root);
      const activeEl = document.activeElement as HTMLElement | null;
      const editableRoot = target.closest<HTMLElement>("input, textarea, select, [contenteditable='true']");
      const editableIsActivelyFocused =
        !!editableRoot &&
        !!activeEl &&
        (editableRoot === activeEl || editableRoot.contains(activeEl));
      const bodyCanConsumeWheel = canScrollableBodyConsumeWheel(scrollPort, event);

      const pinchZoom = event.ctrlKey || event.metaKey;
      if (!pinchZoom && editableIsActivelyFocused) return;
      /*
       * Mouse + trackpad: defer to the browser when a nested scrollport can still move vertically.
       * Otherwise fall through to preventDefault + canvas pan/zoom (incl. scroll chaining at edges).
       */
      if (!pinchZoom && bodyCanConsumeWheel) return;

      event.preventDefault();
      if (pinchZoom) {
        const deltaPx = normalizeWheelZoomDeltaY(event.deltaY, event.deltaMode);
        const factor = Math.exp(-deltaPx * WHEEL_ZOOM_SENSITIVITY);
        const nextScale = Math.min(
          Math.max(MIN_ZOOM, viewRef.current.scale * factor),
          MAX_ZOOM,
        );
        const rect = root.getBoundingClientRect();
        viewportWheelZoomRef.current(
          nextScale,
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        return;
      }

      const dx = normalizeWheelPanAxis(event.deltaX, event.deltaMode, "x");
      const dy = normalizeWheelPanAxis(event.deltaY, event.deltaMode, "y");
      setTranslateX((prev) => prev - dx);
      setTranslateY((prev) => prev - dy);
    };

    root.addEventListener("wheel", onWheelNative, { passive: false });
    return () => root.removeEventListener("wheel", onWheelNative);
  }, []);

  /**
   * Stop OS/browser page zoom on trackpad pinch (Safari/WebKit + Chrome): without this, pinch still
   * scales the whole UI even when the viewport `wheel` handler applies canvas zoom.
   */
  useLayoutEffect(() => {
    const blockDocumentPinchWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const t = event.target;
      if (!(t instanceof Element)) return;
      if (t.closest("input, textarea, select, [contenteditable='true'], [data-hg-allow-browser-zoom]")) {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener("wheel", blockDocumentPinchWheel, { capture: true, passive: false });

    const blockSafariGestureZoom = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener("gesturestart", blockSafariGestureZoom, { passive: false });
    document.addEventListener("gesturechange", blockSafariGestureZoom, { passive: false });
    document.addEventListener("gestureend", blockSafariGestureZoom, { passive: false });

    return () => {
      window.removeEventListener("wheel", blockDocumentPinchWheel, { capture: true });
      document.removeEventListener("gesturestart", blockSafariGestureZoom);
      document.removeEventListener("gesturechange", blockSafariGestureZoom);
      document.removeEventListener("gestureend", blockSafariGestureZoom);
    };
  }, []);

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

      // Creation hotkeys (1–7) map to dock create actions (note → … → location).
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
        if (isRestrictedLayer) return;
        event.preventDefault();
        createNewNode("media");
        return;
      }
      if (key === "4") {
        event.preventDefault();
        createNewNode("folder");
        return;
      }
      if (key === "5") {
        event.preventDefault();
        createNewNode("character");
        return;
      }
      if (key === "6") {
        event.preventDefault();
        createNewNode("faction");
        return;
      }
      if (key === "7") {
        event.preventDefault();
        createNewNode("location");
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

    const activeEl = document.activeElement as Element | null;
    const fromCaret = resolveProseCommandTarget(shell, activeEl);
    if (fromCaret) return fromCaret;

    if (galleryOpenRef.current && activeNodeIdRef.current) {
      const gallery = shell.querySelector<HTMLElement>('[data-architectural-media-gallery-notes="true"]');
      return gallery ? resolveProseCommandTarget(shell, gallery) : null;
    }
    if (focusOpenRef.current && activeNodeIdRef.current) {
      const focusBody = shell.querySelector<HTMLElement>('[data-focus-body-editor="true"]');
      return focusBody ? resolveProseCommandTarget(shell, focusBody) : null;
    }
    const ids = selectedNodeIdsRef.current;
    if (ids.length !== 1) return null;
    const entity = graphRef.current.entities[ids[0]!];
    if (!entity || entity.kind !== "content") return null;
    if (entity.theme !== "default" && entity.theme !== "task" && entity.theme !== "code")
      return null;
    const nodeBody = shell.querySelector<HTMLElement>(
      `[data-node-id="${ids[0]!}"] [data-node-body-editor="true"]`,
    );
    return nodeBody ? resolveProseCommandTarget(shell, nodeBody) : null;
  }, []);

  const canInsertImageAtCurrentTarget = useCallback(() => {
    if (galleryOpenRef.current && activeNodeIdRef.current) {
      const entity = graphRef.current.entities[activeNodeIdRef.current];
      return !!entity && entity.kind === "content" && entity.theme === "media";
    }
    if (focusOpenRef.current && activeNodeIdRef.current) {
      const entity = graphRef.current.entities[activeNodeIdRef.current];
      return !!entity && entity.kind === "content" && entity.theme !== "media";
    }
    const ids = selectedNodeIdsRef.current;
    if (ids.length !== 1) return false;
    const entity = graphRef.current.entities[ids[0]!];
    return (
      !!entity &&
      entity.kind === "content" &&
      (entity.theme === "default" || entity.theme === "task" || entity.theme === "code")
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
    const hgKey = findHgDocSurfaceKeyFromSelection();
    const hgApi = hgKey ? getHgDocEditor(hgKey) : null;
    if (hgApi && ae instanceof HTMLElement && ae.closest("[data-hg-doc-editor]")) {
      setTextFormatChromeActive(true);
      setRichDocInsertChromeActive(true);
      setFormatCommandState(hgApi.getFormatState());
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

  const runHgDocFormat = useCallback(
    (command: string, value: string | undefined, target: HTMLElement | null): boolean => {
      if (command === "arch:insertImage") return false;
      const hgKeyFromTarget =
        target?.closest<HTMLElement>("[data-hg-doc-surface]")?.getAttribute("data-hg-doc-surface") ??
        null;
      const hgKey = findHgDocSurfaceKeyFromSelection() ?? hgKeyFromTarget;
      const hgApi = hgKey ? getHgDocEditor(hgKey) : null;
      if (hgApi?.runFormat(command, value)) {
        refreshTextFormatChrome();
        return true;
      }
      // Structural routing rule: never fall back to legacy execCommand in hgDoc surfaces.
      if (target?.closest("[data-hg-doc-editor]")) return true;
      return false;
    },
    [refreshTextFormatChrome],
  );

  const runLegacyFormat = useCallback(
    (command: string, value: string | undefined, target: HTMLElement) => {
      const dispatchInput = (el: HTMLElement | null) => {
        el?.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const restoreSelection = (el: HTMLElement | null) => {
        const selection = window.getSelection();
        const saved = lastFormatRangeRef.current;
        if (!selection || !saved || !el) return false;
        if (!isNodeWithin(el, saved.commonAncestorContainer)) return false;
        selection.removeAllRanges();
        selection.addRange(saved);
        return true;
      };

      const execTarget = target;
      if (!restoreSelection(execTarget)) {
        placeCaretAtEnd(execTarget);
      }

      // hgDoc owns structured block semantics; legacy surfaces keep only minimal inline formatting.
      if (command === "arch:checklist") return;

      document.execCommand(command, false, value);
      dispatchInput(execTarget);
      refreshTextFormatChrome();
    },
    [refreshTextFormatChrome],
  );

  const runFormat = useCallback(
    (command: string, value?: string) => {
      const shell = shellRef.current;
      if (!shell) return;

      const target = resolveRichTextFormatTarget();

      if (command === "arch:insertImage") {
        if (!canInsertImageAtCurrentTarget()) return;
        if (focusOpenRef.current && activeNodeIdRef.current) {
          queueMediaUploadPick({ mode: "focus", id: activeNodeIdRef.current });
        } else {
          const ids = selectedNodeIdsRef.current;
          const entity = ids.length === 1 ? graphRef.current.entities[ids[0]!] : null;
          if (!entity || entity.kind !== "content") return;
          queueMediaUploadPick({ mode: "canvas", id: entity.id });
        }
        return;
      }

      if (runHgDocFormat(command, value, target)) return;
      if (!target) return;
      runLegacyFormat(command, value, target);
    },
    [
      canInsertImageAtCurrentTarget,
      resolveRichTextFormatTarget,
      queueMediaUploadPick,
      runHgDocFormat,
      runLegacyFormat,
    ],
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

  const closeCanvasEmptyContextMenu = useCallback(() => {
    setCanvasEmptyContextMenu(null);
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

      if (!hitIds || hitIds.length < 1) {
        if (target.closest("[data-node-id]") || target.closest("[data-stack-container='true']")) return;
        const inCanvas = target.closest("[data-vigil-canvas='true']");
        if (!inCanvas) return;
        event.preventDefault();
        event.stopPropagation();
        setSelectionContextMenu(null);
        setCanvasEmptyContextMenu(
          clampContextMenuPosition(
            { x: event.clientX, y: event.clientY },
            { maxWidth: 280, maxHeight: 400, edgePadding: 8 },
          ),
        );
        setSelectedNodeIds([]);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setCanvasEmptyContextMenu(null);
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

  const copySelectedNodeId = useCallback(() => {
    const selectedId = selectedNodeIdsRef.current[0];
    if (!selectedId) return;
    void navigator.clipboard.writeText(selectedId).catch(() => {
      try {
        const ta = document.createElement("textarea");
        ta.value = selectedId;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        window.alert("Could not copy node ID automatically.");
      }
    });
  }, []);

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
      {
        label: "Copy ID",
        icon: <CopySimple size={18} weight="bold" aria-hidden />,
        disabled: selectedNodeIds.length !== 1,
        onSelect: copySelectedNodeId,
      },
    ],
    [
      alignSelectedInGrid,
      copySelectedNodeId,
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

  const canvasEmptyContextMenuItems = useMemo<ContextMenuItem[]>(
    () => [
      {
        label: "Create character",
        icon: <User size={18} weight="bold" aria-hidden />,
        onSelect: () => createNewNode("character"),
      },
      {
        label: "Create organization",
        icon: <UsersThree size={18} weight="bold" aria-hidden />,
        onSelect: () => createNewNode("faction"),
      },
      {
        label: "Create location",
        icon: <MapPin size={18} weight="bold" aria-hidden />,
        onSelect: () => createNewNode("location"),
      },
    ],
    [createNewNode],
  );

  const connectionContextMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!selectedConnectionId) return [];
    const selected = graph.connections[selectedConnectionId];
    if (!selected) return [];
    const currentSlack = selected.slackMultiplier ?? DEFAULT_LINK_SLACK_MULTIPLIER;
    const currentLt = selected.linkType ?? "pin";
    const sourceEntity = graph.entities[selected.sourceEntityId];
    const targetEntity = graph.entities[selected.targetEntityId];
    const grouped = groupedOrderedLinkOptionsForEndpoints(sourceEntity, targetEntity);

    const out: ContextMenuItem[] = [
      { type: "heading", label: "Thread" },
      {
        label: "Cut thread",
        onSelect: () => cutConnection(selectedConnectionId),
      },
      {
        label: "Make thread taut",
        disabled: currentSlack <= 1.01,
        onSelect: () => setConnectionSlack(selectedConnectionId, 1.02),
      },
      {
        label: "Loosen thread",
        disabled: currentSlack >= 1.29,
        onSelect: () => setConnectionSlack(selectedConnectionId, 1.28),
      },
    ];
    for (const { group, options } of grouped) {
      out.push({ type: "heading", label: LINK_TYPE_GROUP_HEADINGS[group] });
      for (const opt of options) {
        // Picker kinds render with their canonical color swatch so the right-click
        // menu visibly matches the thread-kind picker.
        const kindForOpt = CONNECTION_KINDS_IN_ORDER.find(
          (k) => linkTypeForConnectionKind(k) === opt.value,
        );
        const swatchIcon = kindForOpt ? (
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              display: "inline-block",
              background: colorForConnectionKind(kindForOpt),
              boxShadow:
                "inset 0 1px 2px color-mix(in oklch, black 30%, transparent), 0 0 0 1px color-mix(in oklch, black 50%, transparent)",
            }}
          />
        ) : undefined;
        out.push({
          label: `${currentLt === opt.value ? "✓ " : ""}${opt.menuLabel}`,
          icon: swatchIcon,
          onSelect: () => setConnectionLinkType(selectedConnectionId, opt.value),
        });
      }
    }
    return out;
  }, [
    cutConnection,
    graph.connections,
    graph.entities,
    selectedConnectionId,
    setConnectionLinkType,
    setConnectionSlack,
  ]);

  const canInsertImage = useMemo(() => {
    if (focusOpen && activeNodeId) {
      const entity = graph.entities[activeNodeId];
      return !!entity && entity.kind === "content" && entity.theme !== "media";
    }
    if (selectedNodeIds.length !== 1) return false;
    const entity = graph.entities[selectedNodeIds[0]!];
    return (
      !!entity &&
      entity.kind === "content" &&
      (entity.theme === "default" || entity.theme === "task" || entity.theme === "code")
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
        if (action.command === "insertUnorderedList") {
          return { ...action, active: formatCommandState.unorderedList };
        }
        if (action.command === "insertOrderedList") {
          return { ...action, active: formatCommandState.orderedList };
        }
        return action;
      }),
    [
      canInsertImage,
      formatCommandState.blockTag,
      formatCommandState.orderedList,
      formatCommandState.unorderedList,
      isRestrictedLayer,
    ],
  );

  const dockCreateActions = useMemo(
    () =>
      isRestrictedLayer
        ? DEFAULT_CREATE_ACTIONS.filter((a) => a.nodeType !== "media")
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
    if (selectedNodeIds.length >= 1) {
      setCanvasEmptyContextMenu(null);
    }
  }, [selectedNodeIds.length]);

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      const t = event.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("[data-hg-sync-popover='true']")) return;
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

  const { width: camVw, height: camVh } = viewportCssSizeForDefaultCamera(
    viewportRef.current,
    viewportSize.width,
    viewportSize.height,
  );
  /** Viewport center in world space — same box as `defaultCamera` / recenter → 0,0. */
  const centerWorldX = Math.round((camVw / 2 - translateX) / scale);
  const centerWorldY = Math.round((camVh / 2 - translateY) / scale);
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

  useLayoutEffect(() => {
    const canMeasure =
      minimapOpen &&
      !focusOpen &&
      !galleryOpen &&
      !stackModal &&
      viewportRevealReady;
    if (!canMeasure) {
      setMinimapPlacementSizes(new Map());
      return;
    }

    let rafId = 0;
    const runMeasure = () => {
      if (typeof document === "undefined") return;
      const g = graphRef.current;
      const spaceId = activeSpaceIdRef.current;
      const entityIds = g.spaces[spaceId]?.entityIds ?? [];
      if (entityIds.length === 0) {
        setMinimapPlacementSizes((prev) => (prev.size === 0 ? prev : new Map()));
        return;
      }
      const collapsed = buildCollapsedStacksList(g, spaceId);
      const stackMulti = new Set(collapsed.map((c) => c.stackId));
      const map = new Map<string, { width: number; height: number }>();
      for (const id of entityIds) {
        const e = g.entities[id];
        if (!e) continue;
        if (e.stackId && stackMulti.has(e.stackId)) continue;
        const m = measureArchitecturalNodePlacement(id, spaceId);
        if (m) map.set(id, m);
      }
      for (const cs of collapsed) {
        const m = measureArchitecturalNodePlacement(cs.top.id, spaceId);
        if (m) map.set(cs.top.id, m);
      }
      setMinimapPlacementSizes((prev) => {
        if (minimapPlacementMapsEqual(prev, map)) return prev;
        return map;
      });
    };

    const scheduleMeasure = () => {
      if (rafId !== 0) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        runMeasure();
      });
    };

    runMeasure();

    const root = canvasEntityLayerRef.current ?? viewportRef.current;
    if (!root) return undefined;

    const esc =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(activeSpaceId)
        : activeSpaceId.replace(/"/g, '\\"');
    const nodes = root.querySelectorAll<HTMLElement>(`[data-space-id="${esc}"][data-node-id]`);

    const ro = new ResizeObserver(() => {
      scheduleMeasure();
    });
    nodes.forEach((el) => ro.observe(el));
    return () => {
      ro.disconnect();
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };
  }, [
    minimapOpen,
    focusOpen,
    galleryOpen,
    stackModal,
    viewportRevealReady,
    activeSpaceId,
    minimapLayoutKey,
  ]);

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

  const environmentSessionLabel = !heartgardenBootApi.loaded
    ? "Session: detecting"
    : !heartgardenBootApi.gateEnabled
      ? "Session: GM (open gate)"
      : heartgardenBootApi.sessionTier === "access"
        ? "Session: GM (access)"
        : heartgardenBootApi.sessionTier === "player"
          ? "Session: players"
          : heartgardenBootApi.sessionTier === "demo"
            ? "Session: demo"
            : heartgardenBootApi.sessionValid
              ? "Session: authenticated"
              : "Session: unauthenticated";

  const environmentSourceLabel =
    scenario !== "default"
      ? `Source: scenario (${scenario})`
      : !canvasBootstrapResolved
        ? "Source: bootstrapping"
        : workspaceViewFromCache
          ? "Source: local cache"
          : neonWorkspaceOk === true
            ? "Source: Neon live"
            : heartgardenBootApi.gateEnabled && heartgardenBootApi.sessionTier === "demo"
              ? "Source: demo local"
              : neonWorkspaceOk === false
                ? "Source: unavailable"
                : "Source: pending";

  const environmentSpaceLabel = activeSpaceId?.trim() ? activeSpaceId : ROOT_SPACE_ID;

  return (
    <>
      {itemConflictQueue.length > 0 ? (
        <div className={styles.collabConflictBanner} role="alert">
          <span>
            {`Edit conflict on "${(itemConflictQueue[0]?.title ?? "").trim() || "this card"}" — the server has a newer version.`}
            {itemConflictQueue.length > 1
              ? ` (${itemConflictQueue.length - 1} more in queue)`
              : ""}
          </span>
          <ArchitecturalButton type="button" size="menu" tone="glass" onClick={keepLocalVersionForConflict}>
            Keep my version
          </ArchitecturalButton>
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
          {visibleStandaloneEntities.map((entity) => {
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
                  shouldRenderLoreCharacterCredentialCanvasNode(entity) ? (
                    <ArchitecturalLoreCharacterCanvasNode
                      id={entity.id}
                      width={entity.width}
                      tapeVariant={tapeVariantForLoreCard("character", entity.loreCard?.variant ?? "v11")}
                      tapeRotation={entity.tapeRotation}
                      bodyHtml={canonicalizeCharacterBodyHtml(entity, entity.bodyHtml)}
                      activeTool={activeTool}
                      dragged={dragged}
                      selected={selected}
                      bodyEditable={activeTool === "select" && loreCanvasBodyEditEntityId === entity.id}
                      onRequestCanvasBodyEdit={() => setLoreCanvasBodyEditEntityId(entity.id)}
                      onBodyCommit={updateNodeBody}
                      onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
                      wikiLinkAssist={makeWikiLinkAssist(entity.id)}
                      onRichDocCommand={
                        entity.theme === "default" || entity.theme === "task"
                          ? (command, value) => runFormat(command, value)
                          : undefined
                      }
                      emptyPlaceholder={
                        entity.theme === "default" || entity.theme === "task"
                          ? "Write here, or type / for blocks…"
                          : undefined
                      }
                    />
                  ) : shouldRenderLoreLocationCanvasNode(entity) ? (
                    <ArchitecturalLoreLocationCanvasNode
                      id={entity.id}
                      width={entity.width}
                      tapeRotation={entity.tapeRotation}
                      bodyHtml={entity.bodyHtml}
                      activeTool={activeTool}
                      dragged={dragged}
                      selected={selected}
                      showStaple={!entity.stackId}
                      onBodyCommit={updateNodeBody}
                      onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
                      wikiLinkAssist={makeWikiLinkAssist(entity.id)}
                      onRichDocCommand={
                        entity.theme === "default" || entity.theme === "task"
                          ? (command, value) => runFormat(command, value)
                          : undefined
                      }
                      emptyPlaceholder={
                        entity.theme === "default" || entity.theme === "task"
                          ? "Write here, or type / for blocks…"
                          : undefined
                      }
                    />
                  ) : shouldRenderLoreFactionArchive091CanvasNode(entity) ? (
                    <ArchitecturalLoreFactionArchiveCanvasNode
                      id={entity.id}
                      width={entity.width}
                      tapeVariant={tapeVariantForLoreCard("faction", entity.loreCard?.variant ?? "v4")}
                      tapeRotation={entity.tapeRotation}
                      bodyHtml={canonicalizeFactionBodyHtml(entity, entity.bodyHtml)}
                      factionRoster={entity.factionRoster ?? []}
                      activeTool={activeTool}
                      dragged={dragged}
                      selected={selected}
                      showTape={!entity.stackId}
                      onBodyCommit={updateNodeBody}
                      onFactionRosterChange={updateFactionRoster}
                      onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
                      wikiLinkAssist={makeWikiLinkAssist(entity.id)}
                      onRichDocCommand={
                        entity.theme === "default" || entity.theme === "task"
                          ? (command, value) => runFormat(command, value)
                          : undefined
                      }
                      emptyPlaceholder={
                        entity.theme === "default" || entity.theme === "task"
                          ? "Write here, or type / for blocks…"
                          : undefined
                      }
                    />
                  ) : (
                    <ArchitecturalNodeCard
                      id={entity.id}
                      title={entity.title}
                      width={entity.width}
                      theme={entity.theme}
                      tapeVariant={entity.tapeVariant ?? tapeVariantForTheme(entity.theme)}
                      tapeRotation={entity.tapeRotation}
                      bodyHtml={entity.bodyHtml}
                      bodyDoc={entity.bodyDoc ?? null}
                      activeTool={activeTool}
                      dragged={dragged}
                      selected={selected}
                      showTape={!entity.stackId}
                      onBodyCommit={handleNodeBodyCommit}
                      onExpand={handleNodeExpand}
                      onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
                      canvasPanZoomScale={scale}
                      useFullImageResolution={galleryOpen && galleryNodeId === entity.id}
                      wikiLinkAssist={makeWikiLinkAssist(entity.id)}
                      onRichDocCommand={
                        entity.theme === "default" || entity.theme === "task"
                          ? (command, value) => runFormat(command, value)
                          : undefined
                      }
                      emptyPlaceholder={
                        entity.theme === "default" || entity.theme === "task"
                          ? "Write here, or type / for blocks…"
                          : undefined
                      }
                      loreCard={entity.loreCard}
                      factionRoster={entity.loreCard?.kind === "faction" ? entity.factionRoster : undefined}
                    />
                  )
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
          {visibleCollapsedStacks.map(({ stackId, entities, top }) => {
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
                      shouldRenderLoreCharacterCredentialCanvasNode(entity) ? (
                        <ArchitecturalLoreCharacterCanvasNode
                          id={entity.id}
                          width={entity.width}
                          tapeVariant={tapeVariantForLoreCard("character", entity.loreCard?.variant ?? "v11")}
                          tapeRotation={entity.tapeRotation}
                          bodyHtml={canonicalizeCharacterBodyHtml(entity, entity.bodyHtml)}
                          activeTool={activeTool}
                          dragged={draggingStack}
                          selected={false}
                          bodyEditable={false}
                          onBodyCommit={updateNodeBody}
                          onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
                          wikiLinkAssist={makeWikiLinkAssist(entity.id)}
                          onRichDocCommand={
                            entity.theme === "default" || entity.theme === "task"
                              ? (command, value) => runFormat(command, value)
                              : undefined
                          }
                          emptyPlaceholder={
                            entity.theme === "default" || entity.theme === "task"
                              ? "Write here, or type / for blocks…"
                              : undefined
                          }
                        />
                      ) : shouldRenderLoreLocationCanvasNode(entity) ? (
                        <ArchitecturalLoreLocationCanvasNode
                          id={entity.id}
                          width={entity.width}
                          tapeRotation={entity.tapeRotation}
                          bodyHtml={entity.bodyHtml}
                          activeTool={activeTool}
                          dragged={draggingStack}
                          selected={false}
                          showStaple={!entity.stackId}
                          bodyEditable={false}
                          onBodyCommit={updateNodeBody}
                          onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
                          wikiLinkAssist={makeWikiLinkAssist(entity.id)}
                          onRichDocCommand={
                            entity.theme === "default" || entity.theme === "task"
                              ? (command, value) => runFormat(command, value)
                              : undefined
                          }
                          emptyPlaceholder={
                            entity.theme === "default" || entity.theme === "task"
                              ? "Write here, or type / for blocks…"
                              : undefined
                          }
                        />
                      ) : shouldRenderLoreFactionArchive091CanvasNode(entity) ? (
                        <ArchitecturalLoreFactionArchiveCanvasNode
                          id={entity.id}
                          width={entity.width}
                          tapeVariant={tapeVariantForLoreCard("faction", entity.loreCard?.variant ?? "v4")}
                          tapeRotation={entity.tapeRotation}
                          bodyHtml={canonicalizeFactionBodyHtml(entity, entity.bodyHtml)}
                          factionRoster={entity.factionRoster ?? []}
                          activeTool={activeTool}
                          dragged={draggingStack}
                          selected={false}
                          showTape={!entity.stackId}
                          bodyEditable={false}
                          onBodyCommit={updateNodeBody}
                          onFactionRosterChange={updateFactionRoster}
                          onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
                          wikiLinkAssist={makeWikiLinkAssist(entity.id)}
                          onRichDocCommand={
                            entity.theme === "default" || entity.theme === "task"
                              ? (command, value) => runFormat(command, value)
                              : undefined
                          }
                          emptyPlaceholder={
                            entity.theme === "default" || entity.theme === "task"
                              ? "Write here, or type / for blocks…"
                              : undefined
                          }
                        />
                      ) : (
                        <ArchitecturalNodeCard
                          id={entity.id}
                          title={entity.title}
                          width={entity.width}
                          theme={entity.theme}
                          tapeVariant={entity.tapeVariant ?? tapeVariantForTheme(entity.theme)}
                          tapeRotation={entity.tapeRotation}
                          bodyHtml={entity.bodyHtml}
                          bodyDoc={entity.bodyDoc ?? null}
                          activeTool={activeTool}
                          dragged={draggingStack}
                          selected={false}
                          showTape={!entity.stackId}
                          onBodyCommit={handleNodeBodyCommit}
                          onExpand={handleNodeExpand}
                          bodyEditable={false}
                          canvasPanZoomScale={scale}
                          useFullImageResolution={galleryOpen && galleryNodeId === entity.id}
                          loreCard={entity.loreCard}
                          factionRoster={entity.loreCard?.kind === "faction" ? entity.factionRoster : undefined}
                        />
                      )
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
            {visibleActiveSpaceConnections.map((connection) => {
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
                            { maxWidth: 280, maxHeight: 680, edgePadding: 8 },
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
                          { maxWidth: 280, maxHeight: 680, edgePadding: 8 },
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
          {collabNeonActive ? (
            <ArchitecturalRemotePresenceCursors
              peers={presencePeers.filter((p) => p.activeSpaceId === activeSpaceId)}
              prefersReducedMotion={prefersReducedMotion}
              nameplateEnabled={presenceIdentityEnabled}
            />
          ) : null}
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
        {showWorkspaceBlockingOverlay ? (
          <WorkspaceBootstrapErrorPanel errorSummary={bootstrapErrorSummary} />
        ) : null}
        <div
          className={`${styles.chromeLayer}${bootPreActivateGate ? ` ${styles.chromeLayerBootSuppressed}` : ""}`}
          style={{ right: graphOverlayOpen ? graphPanelWidth : 0 }}
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
          <div className={styles.viewportMetricsCluster}>
            {minimapOpen &&
            !focusOpen &&
            !galleryOpen &&
            !stackModal &&
            viewportRevealReady ? (
              <div className={styles.viewportMetricsMinimapAbove}>
                <CanvasMinimap
                  graph={graph}
                  layoutSignature={minimapLayoutKey}
                  activeSpaceId={activeSpaceId}
                  collapsedStacks={collapsedStacks as CollapsedStackInfo[]}
                  translateX={translateX}
                  translateY={translateY}
                  scale={scale}
                  viewportWidth={camVw}
                  viewportHeight={camVh}
                  selectedNodeIds={selectedNodeIds}
                  minZoom={MIN_ZOOM}
                  maxZoom={MAX_ZOOM}
                  onPanWorldDelta={onMinimapPanWorldDelta}
                  onCenterOnWorld={onMinimapCenterOnWorld}
                  onFitAll={applyFitAllToViewport}
                  placementSizes={minimapPlacementSizes}
                  metricsDockWidth
                />
              </div>
            ) : null}
            <ArchitecturalViewportMetrics
              centerWorldX={centerWorldX}
              centerWorldY={centerWorldY}
              scale={scale}
              minimapOpen={minimapOpen}
              onToggleMinimap={toggleMinimapOpen}
            />
          </div>
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
              <ArchitecturalConnectionKindPicker
                value={connectionKind}
                onChange={applyConnectionKind}
                appearance="spool"
                ariaLabel="Connection thread kind"
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
            accept=".pdf,.docx,.md,.txt,.markdown,text/plain,text/markdown,application/pdf"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={onLoreImportFileChange}
          />
        ) : null}
        {!isRestrictedLayer ? (
          <ArchitecturalLoreImportUploadPopover
            open={loreImportPopoverOpen && !!loreImportPreparedSource}
            fileName={loreImportPreparedSource?.fileName ?? ""}
            mode={loreImportSelection.mode}
            scope={loreImportSelection.scope}
            contextText={loreImportSelection.contextText}
            onModeChange={(mode) => setLoreImportSelection((prev) => ({ ...prev, mode }))}
            onScopeChange={(scope) => setLoreImportSelection((prev) => ({ ...prev, scope }))}
            onContextTextChange={(value) =>
              setLoreImportSelection((prev) => ({ ...prev, contextText: value }))
            }
            onChangeFile={beginLoreImportFilePick}
            onContinue={continuePreparedLoreImport}
            onClose={closeLoreImportPopover}
          />
        ) : null}
        {loreSmartPlanning ? (
          <div
            className={styles.smartImportPlanningBackdrop}
            role={loreSmartPlanningUi.failed ? "alertdialog" : "status"}
            aria-live={loreSmartPlanningUi.failed ? "assertive" : "polite"}
            aria-label={
              loreSmartPlanningUi.failed
                ? "Smart import failed"
                : "Smart import planning status"
            }
          >
            <div className={styles.smartImportPlanningCard}>
              {loreSmartPlanningUi.failed ? (
                <>
                  <div className={styles.smartImportPlanningFailIcon} aria-hidden>
                    <WarningCircle size={28} weight="fill" />
                  </div>
                  <p className={styles.smartImportPlanningPhase}>
                    {loreImportFailure?.stage === "timeout"
                      ? "Import is taking too long"
                      : "Smart import failed"}
                  </p>
                  <p className={styles.smartImportPlanningError}>
                    {loreImportFailure?.message ??
                      loreSmartPlanningUi.detail ??
                      "Smart import couldn't finish planning. Try again or copy the details below."}
                    {loreImportFailure?.recommendedAction
                      ? ` ${loreImportFailure.recommendedAction}`
                      : ""}
                  </p>
                  {loreImportFailure ? (
                    <details className={styles.smartImportPlanningDetails}>
                      <summary>Technical details</summary>
                      <pre>{formatLoreImportFailureReport(loreImportFailure)}</pre>
                    </details>
                  ) : null}
                  {loreSmartPlanningEventGroups.length > 0 ? (
                    <details
                      className={styles.smartImportPlanningDetails}
                      open={loreSmartPlanningDetailsOpen}
                      onToggle={(event) => {
                        setLoreSmartPlanningDetailsOpen(
                          (event.currentTarget as HTMLDetailsElement).open,
                        );
                      }}
                    >
                      <summary>Timeline details</summary>
                      <div className={styles.smartImportPlanningTimeline}>
                        {loreSmartPlanningEventGroups.map((group) => (
                          <div key={`planning-failed-group-${group.phase}`} className={styles.smartImportPlanningPhaseGroup}>
                            <p className={styles.smartImportPlanningPhaseGroupTitle}>{group.label}</p>
                            <ul className={styles.smartImportPlanningTimelineList}>
                              {group.events.map((event, idx) => (
                                <li key={`${group.phase}-failed-${idx}`} className={styles.smartImportPlanningTimelineItem}>
                                  <p className={styles.smartImportPlanningTimelineRow}>
                                    <span>{event.text || event.kind.replace(/_/g, " ")}</span>
                                    {formatDurationMs(event.durationMs) ? (
                                      <span>{formatDurationMs(event.durationMs)}</span>
                                    ) : null}
                                  </p>
                                  {event.kind === "llm_call" ? (
                                    <p className={styles.smartImportPlanningTimelineMeta}>
                                      {event.model ? `${event.model} · ` : ""}
                                      {typeof event.tokensIn === "number"
                                        ? `${event.tokensIn} in`
                                        : "tokens n/a"}
                                      {typeof event.tokensOut === "number"
                                        ? ` · ${event.tokensOut} out`
                                        : ""}
                                      {event.stopReason ? ` · ${event.stopReason}` : ""}
                                    </p>
                                  ) : null}
                                  {event.kind === "llm_call" && event.responseSnippet ? (
                                    <details className={styles.smartImportPlanningTimelineSnippet}>
                                      <summary>Model output snippet</summary>
                                      <pre>{event.responseSnippet}</pre>
                                    </details>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                  <div className={styles.smartImportPlanningActionsSplit}>
                    <Button
                      size="sm"
                      variant="default"
                      tone="card-dark"
                      type="button"
                      onClick={copyLoreSmartPlanningFailure}
                      leadingIcon={<CopySimple size={14} weight="regular" />}
                    >
                      {loreSmartPlanningCopyState === "copied"
                        ? "Copied"
                        : loreSmartPlanningCopyState === "failed"
                          ? "Copy failed"
                          : "Copy details"}
                    </Button>
                    <div>
                      <Button
                        size="sm"
                        variant="default"
                        tone="card-dark"
                        type="button"
                        onClick={closeLoreSmartPlanningFailure}
                      >
                        Close
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        tone="solid"
                        type="button"
                        onClick={retryLoreSmartPlanning}
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.smartImportPlanningSpinner} aria-hidden>
                    <span className={styles.smartImportPlanningSpinnerRing} />
                  </div>
                  <p className={styles.smartImportPlanningPhase}>{loreSmartPlanningUi.phaseLabel}</p>
                  {typeof loreSmartPlanningUi.pipelinePercent === "number" ? (
                    <div
                      className={styles.smartImportPlanningProgressBar}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.max(
                        0,
                        Math.min(100, Math.trunc(loreSmartPlanningUi.pipelinePercent)),
                      )}
                      aria-label="Import planning progress"
                    >
                      <span
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, Math.trunc(loreSmartPlanningUi.pipelinePercent)),
                          )}%`,
                        }}
                      />
                    </div>
                  ) : null}
                  {loreSmartPlanningUi.stepLabel ? (
                    <p className={styles.smartImportPlanningStep}>{loreSmartPlanningUi.stepLabel}</p>
                  ) : null}
                  {loreSmartPlanningUi.subphase ? (
                    <p className={styles.smartImportPlanningSubphase}>{loreSmartPlanningUi.subphase}</p>
                  ) : null}
                  {loreSmartPlanningUi.detail ? (
                    <p className={styles.smartImportPlanningDetail}>{loreSmartPlanningUi.detail}</p>
                  ) : null}
                  {loreSmartPlanningUi.findingsSummary ? (
                    <p className={styles.smartImportPlanningFindings}>
                      {loreSmartPlanningUi.findingsSummary}
                    </p>
                  ) : null}
                  {loreSmartPlanningUi.etaLabel ? (
                    <p className={styles.smartImportPlanningEta}>{loreSmartPlanningUi.etaLabel}</p>
                  ) : null}
                  {loreSmartPlanningUi.queueFailureHint ? (
                    <p className={styles.smartImportPlanningWarning}>
                      {loreSmartPlanningUi.queueFailureHint}
                    </p>
                  ) : null}
                  {loreSmartPlanningEventGroups.length > 0 ? (
                    <details
                      className={styles.smartImportPlanningDetails}
                      open={loreSmartPlanningDetailsOpen}
                      onToggle={(event) => {
                        setLoreSmartPlanningDetailsOpen(
                          (event.currentTarget as HTMLDetailsElement).open,
                        );
                      }}
                    >
                      <summary>Show details</summary>
                      <div className={styles.smartImportPlanningTimeline}>
                        {loreSmartPlanningEventGroups.map((group) => (
                          <div key={`planning-group-${group.phase}`} className={styles.smartImportPlanningPhaseGroup}>
                            <p className={styles.smartImportPlanningPhaseGroupTitle}>{group.label}</p>
                            <ul className={styles.smartImportPlanningTimelineList}>
                              {group.events.map((event, idx) => (
                                <li key={`${group.phase}-${idx}`} className={styles.smartImportPlanningTimelineItem}>
                                  <p className={styles.smartImportPlanningTimelineRow}>
                                    <span>{event.text || event.kind.replace(/_/g, " ")}</span>
                                    {formatDurationMs(event.durationMs) ? (
                                      <span>{formatDurationMs(event.durationMs)}</span>
                                    ) : null}
                                  </p>
                                  {event.kind === "llm_call" ? (
                                    <p className={styles.smartImportPlanningTimelineMeta}>
                                      {event.model ? `${event.model} · ` : ""}
                                      {typeof event.tokensIn === "number"
                                        ? `${event.tokensIn} in`
                                        : "tokens n/a"}
                                      {typeof event.tokensOut === "number"
                                        ? ` · ${event.tokensOut} out`
                                        : ""}
                                      {event.stopReason ? ` · ${event.stopReason}` : ""}
                                    </p>
                                  ) : null}
                                  {event.kind === "llm_call" && event.responseSnippet ? (
                                    <details className={styles.smartImportPlanningTimelineSnippet}>
                                      <summary>Model output snippet</summary>
                                      <pre>{event.responseSnippet}</pre>
                                    </details>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                  <p className={styles.smartImportPlanningHint}>
                    Keep this tab open — most imports finish in a minute or two.
                  </p>
                  <div className={styles.smartImportPlanningActions}>
                    <Button
                      size="sm"
                      variant="default"
                      tone="card-dark"
                      type="button"
                      onClick={cancelLoreSmartPlanning}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
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
        {!isRestrictedLayer ? (
          <ArchitecturalLoreImportErrorDialog
            failure={loreSmartPlanning ? null : loreImportFailure}
            onClose={() => setLoreImportFailure(null)}
            onRetry={beginLoreImportFilePick}
          />
        ) : null}
        {loreSmartReview && !isRestrictedLayer ? (
          <div
            className={styles.smartImportReviewBackdrop}
            role="dialog"
            aria-modal="true"
            aria-label="Smart document import"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !loreImportCommitting) {
                closeLoreSmartReview();
              }
            }}
          >
            <div className={styles.smartImportReviewPanel}>
              <header className={styles.smartImportReviewHeader}>
                <div className={styles.smartImportReviewHeaderMain}>
                  <h2 className={styles.smartImportReviewTitle}>Smart import</h2>
                  {loreSmartReview.fileName ? (
                    <p className={styles.smartImportReviewFile}>{loreSmartReview.fileName}</p>
                  ) : null}
                  <p className={styles.smartImportReviewStatsLine}>
                    <strong>{loreSmartReview.plan.folders.length}</strong> folders ·{" "}
                    <strong>{loreSmartReview.plan.notes.length}</strong> notes ·{" "}
                    <strong>{loreSmartReview.plan.clarifications.length}</strong> question
                    {loreSmartReview.plan.clarifications.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className={styles.smartImportReviewHeaderActions}>
                  <Button
                    size="sm"
                    variant="default"
                    tone="card-dark"
                    disabled={loreImportCommitting}
                    onClick={closeLoreSmartReview}
                  >
                    Close
                  </Button>
                </div>
              </header>
              <div className={styles.smartImportReviewBody}>
                <div className={styles.smartImportReviewMergeToolbar}>
                  <Button
                    size="sm"
                    variant="default"
                    tone="card-dark"
                    type="button"
                    disabled={loreImportCommitting}
                    onClick={collapseSmartImportToOneNote}
                  >
                    Collapse to one note
                  </Button>
                  {loreSmartReview.plan.folders.length > 0 ? (
                    <Button
                      size="sm"
                      variant="default"
                      tone="card-dark"
                      type="button"
                      disabled={loreImportCommitting}
                      onClick={flattenSmartImportToNearby}
                    >
                      Flatten to Nearby
                    </Button>
                  ) : null}
                </div>
                {loreSmartMergeProposals.length > 0 ? (
                  <section>
                    <p className={styles.smartImportReviewMergeMeta}>
                      Merge proposals: {loreSmartAcceptedMergeCount}/{loreSmartMergeProposals.length} accepted
                    </p>
                    <div className={styles.smartImportReviewMergeToolbar}>
                      <Button
                        size="sm"
                        variant="default"
                        tone="card-dark"
                        type="button"
                        disabled={loreImportCommitting}
                        onClick={() => setAllLoreSmartMergeAcceptances(true)}
                      >
                        Accept all merges
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        tone="card-dark"
                        type="button"
                        disabled={loreImportCommitting}
                        onClick={() => setAllLoreSmartMergeAcceptances(false)}
                      >
                        Reject all merges
                      </Button>
                    </div>
                    <ul className={styles.smartImportReviewMergeList}>
                      {loreSmartMergeProposals.map((merge) => {
                        const accepted = Boolean(loreSmartAcceptedMergeIds[merge.id]);
                        const fromTitle =
                          loreSmartNoteTitleByClientId.get(merge.noteClientId) ?? merge.noteClientId;
                        const preview = merge.proposedText.slice(0, 600);
                        return (
                          <li key={merge.id} className={styles.smartImportReviewMergeCard}>
                            <label className={styles.smartImportReviewMergeLabel}>
                              <input
                                type="checkbox"
                                checked={accepted}
                                disabled={loreImportCommitting}
                                onChange={(event) =>
                                  setLoreSmartMergeAccepted(merge.id, event.target.checked)
                                }
                              />
                              <span>
                                <strong>{merge.targetTitle}</strong>
                                <small className={styles.smartImportReviewMergeSpace}>
                                  {merge.targetSpaceName
                                    ? `${merge.targetSpaceName} · `
                                    : ""}
                                  from &quot;{fromTitle}&quot;
                                </small>
                                {merge.rationale ? (
                                  <small className={styles.smartImportReviewMergeMeta}>
                                    {merge.rationale}
                                  </small>
                                ) : null}
                              </span>
                            </label>
                            <pre className={styles.smartImportReviewMergePre}>
                              {preview}
                              {merge.proposedText.length > preview.length ? "\n… (truncated)" : ""}
                            </pre>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}
                <section className={styles.smartImportReviewStructure}>
                  <div className={styles.smartImportReviewTargetScope}>
                    <p className={styles.smartImportReviewScopeHint}>
                      Scope:{" "}
                      {loreSmartImportScope === "gm_workspace"
                        ? "Entire GM workspace"
                        : "This space & its folders"}
                    </p>
                    <input
                      className={styles.smartImportReviewTargetSearch}
                      type="search"
                      placeholder="Search spaces for overrides..."
                      value={loreSmartSpaceSearchQuery}
                      onChange={(event) => setLoreSmartSpaceSearchQuery(event.target.value)}
                    />
                  </div>
                  <ul className={styles.smartImportReviewNoteList}>
                    {loreSmartReview.plan.notes.map((note) => {
                      const selected = loreSmartTargetSpaceByNoteId[note.clientId] ?? null;
                      const scopedSuggestions = [
                        ...(loreSmartReview.plan.spaceSuggestions ?? []).map((s) => ({
                          spaceId: s.spaceId,
                          title: s.spaceTitle,
                          path: s.path ?? s.spaceTitle,
                        })),
                        ...loreSmartSpaceSearchResults,
                      ];
                      const seen = new Set<string>();
                      const uniqueOptions = scopedSuggestions.filter((option) => {
                        if (seen.has(option.spaceId)) return false;
                        seen.add(option.spaceId);
                        return true;
                      });
                      const related = note.relatedItems ?? [];
                      const relatedOpen = Boolean(loreSmartRelatedOpenByNoteId[note.clientId]);
                      return (
                        <li key={note.clientId} className={styles.smartImportReviewNoteCard}>
                          <div className={styles.smartImportReviewNoteTitleRow}>
                            <p className={styles.smartImportReviewNoteTitle}>{note.title}</p>
                            <span className={styles.smartImportReviewNoteKind}>
                              {note.canonicalEntityKind}
                            </span>
                          </div>
                          {note.summary ? (
                            <p className={styles.smartImportReviewNoteSummary}>{note.summary}</p>
                          ) : null}
                          {note.folderClientId ? (
                            <p className={styles.smartImportReviewMergeMeta}>
                              In folder mode, placement follows new import folders.
                            </p>
                          ) : (
                            <label className={styles.smartImportReviewTargetField}>
                              <span>Target space</span>
                              <select
                                value={selected ?? ""}
                                onChange={(event) =>
                                  setLoreSmartTargetSpaceByNoteId((prev) => ({
                                    ...prev,
                                    [note.clientId]: event.target.value || null,
                                  }))
                                }
                              >
                                <option value="">Current space</option>
                                {uniqueOptions.map((option) => (
                                  <option key={`${note.clientId}-${option.spaceId}`} value={option.spaceId}>
                                    {option.path}
                                  </option>
                                ))}
                              </select>
                              {note.targetSpaceReason ? (
                                <small>{note.targetSpaceReason}</small>
                              ) : null}
                            </label>
                          )}
                          {related.length > 0 ? (
                            <div className={styles.smartImportReviewRelatedBlock}>
                              <Button
                                size="sm"
                                variant="ghost"
                                tone="card-dark"
                                className={styles.smartImportReviewRelatedToggle}
                                onClick={() =>
                                  setLoreSmartRelatedOpenByNoteId((prev) => ({
                                    ...prev,
                                    [note.clientId]: !relatedOpen,
                                  }))
                                }
                              >
                                Related elsewhere ({related.length})
                              </Button>
                              {relatedOpen ? (
                                <ul className={styles.smartImportReviewRelatedList}>
                                  {related.map((row) => (
                                    <li key={`${note.clientId}-${row.itemId}`}>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        tone="card-dark"
                                        className={styles.smartImportReviewRelatedLink}
                                        onClick={() => focusEntityFromPalette(row.itemId)}
                                      >
                                        {row.title || row.itemId}
                                      </Button>
                                      {row.snippet ? <small>{row.snippet}</small> : null}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
                <div className={styles.smartImportWizard}>
                    {loreSmartReview.plan.clarifications.length === 0 ? (
                      <div className={styles.smartImportWizardComplete}>
                        <p className={styles.smartImportWizardCompleteTitle}>Ready to import</p>
                        <p className={styles.smartImportWizardCompleteBody}>
                          No clarification questions are required for this file.
                        </p>
                        <Button
                          size="md"
                          variant="primary"
                          tone="solid"
                          type="button"
                          disabled={loreImportCommitting}
                          onClick={() => void commitSmartLoreImport()}
                        >
                          {loreImportCommitting ? "Applying…" : "Apply import to canvas"}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className={styles.smartImportWizardProgress}>
                          <p className={styles.smartImportWizardProgressLabel}>
                            {loreSmartOtherFollowUp
                              ? "Follow-up"
                              : loreSmartQuestionUi.questionsComplete
                                ? "All done"
                                : loreSmartQuestionUi.focusQuestion
                                  ? `Question ${loreSmartQuestionUi.stableQuestionOrder.indexOf(loreSmartQuestionUi.focusQuestion) + 1} of ${loreSmartQuestionUi.totalQuestions}`
                                  : "Questions"}
                          </p>
                          <div
                            className={
                              loreSmartQuestionUi.totalQuestions > 1
                                ? `${styles.smartImportQuestionsProgressTrack} ${styles.smartImportQuestionsProgressTrackSegmented}`
                                : styles.smartImportQuestionsProgressTrack
                            }
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={loreSmartQuestionUi.wizardBarPercent}
                            aria-label="Questions completed"
                          >
                            {loreSmartQuestionUi.totalQuestions > 1 ? (
                              loreSmartQuestionUi.stableQuestionOrder.map((q) => {
                                const answered = loreSmartClarificationAnswers.find(
                                  (a) => a.clarificationId === q.id,
                                );
                                const isDone = isClarificationAnswered(answered);
                                const isActive =
                                  !!loreSmartQuestionUi.focusQuestion &&
                                  loreSmartQuestionUi.focusQuestion.id === q.id;
                                return (
                                  <span
                                    key={q.id}
                                    className={`${styles.smartImportQuestionsProgressSegment}${isDone ? ` ${styles.smartImportQuestionsProgressSegmentDone}` : ""}${isActive ? ` ${styles.smartImportQuestionsProgressSegmentActive}` : ""}`}
                                  />
                                );
                              })
                            ) : (
                              <div
                                className={styles.smartImportQuestionsProgressFill}
                                style={{ width: `${loreSmartQuestionUi.wizardBarPercent}%` }}
                              />
                            )}
                          </div>
                        </div>
                        {loreSmartOtherFollowUp ? (
                          <div className={styles.smartImportWizardCard} role="region" aria-live="polite">
                            <p className={styles.smartImportWizardEyebrow}>Follow-up</p>
                            <h3 className={styles.smartImportWizardTitle}>{loreSmartOtherFollowUp.title}</h3>
                            <p className={styles.smartImportWizardContext}>{loreSmartOtherFollowUp.question}</p>
                            <p className={styles.smartImportWizardQuote}>
                              You wrote: &quot;{loreSmartOtherFollowUp.otherText}&quot;
                            </p>
                            <div className={styles.smartImportWizardFollowUpOptions}>
                              {loreSmartOtherFollowUp.options.map((opt) => (
                                <label
                                  key={opt.id}
                                  className={styles.smartImportWizardOption}
                                >
                                  <input
                                    type="radio"
                                    name={`clarify-followup-${loreSmartOtherFollowUp.clarificationId}`}
                                    onChange={() => {
                                      setLoreSmartClarificationAnswers((prev) =>
                                        upsertClarificationAnswer(prev, {
                                          clarificationId: loreSmartOtherFollowUp.clarificationId,
                                          resolution: "answered",
                                          selectedOptionIds: [opt.id],
                                        }),
                                      );
                                      setLoreSmartManualQuestionId(null);
                                      setLoreSmartOtherFollowUp(null);
                                    }}
                                  />
                                  <span>{opt.label}</span>
                                </label>
                              ))}
                            </div>
                            <div className={styles.smartImportWizardFooter}>
                              <Button
                                size="sm"
                                variant="ghost"
                                tone="glass"
                                type="button"
                                onClick={() => {
                                  setLoreSmartClarificationAnswers((prev) =>
                                    upsertClarificationAnswer(prev, {
                                      clarificationId: loreSmartOtherFollowUp.clarificationId,
                                      resolution: "skipped_best_judgement",
                                    }),
                                  );
                                  setLoreSmartManualQuestionId(null);
                                  setLoreSmartOtherFollowUp(null);
                                }}
                              >
                                Skip, use best judgement
                              </Button>
                            </div>
                          </div>
                        ) : loreSmartQuestionUi.focusQuestion ? (
                          (() => {
                            const c = loreSmartQuestionUi.focusQuestion;
                            const answerById = new Map(
                              loreSmartClarificationAnswers.map((a) => [a.clarificationId, a]),
                            );
                            const ans = answerById.get(c.id);
                            const isMulti = c.questionKind === "multi_select";
                            const selectedSet = new Set(
                              ans?.resolution === "answered"
                                ? (ans.selectedOptionIds ?? [])
                                : ans?.resolution === "skipped_default" && ans.skipDefaultOptionId
                                  ? [ans.skipDefaultOptionId]
                                  : [],
                            );
                            const otherSelected = ans?.resolution === "other_text";
                            const step = loreSmartQuestionUi.stableQuestionOrder.indexOf(c) + 1;
                            const canGoBack = step > 1;
                            const prevQuestion =
                              canGoBack
                                ? loreSmartQuestionUi.stableQuestionOrder[step - 2] ?? null
                                : null;
                            return (
                              <article className={styles.smartImportWizardCard}>
                                <p className={styles.smartImportWizardEyebrow}>
                                  {c.severity === "required" ? "Required" : "Optional"} · {step} of{" "}
                                  {loreSmartQuestionUi.totalQuestions}
                                </p>
                                <h3 className={styles.smartImportWizardTitle}>{c.title}</h3>
                                {c.context ? (
                                  <p className={styles.smartImportWizardContext}>{c.context}</p>
                                ) : null}
                                <div className={styles.smartImportWizardOptions}>
                                  {c.options.map((opt) =>
                                    isMulti ? (
                                      <label key={opt.id} className={styles.smartImportWizardOption}>
                                        <input
                                          type="checkbox"
                                          checked={selectedSet.has(opt.id)}
                                          onChange={(e) => {
                                            let base: string[] =
                                              ans?.resolution === "answered"
                                                ? [...(ans.selectedOptionIds ?? [])]
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
                                            setLoreSmartManualQuestionId(null);
                                            setLoreSmartOtherFollowUp((cur) =>
                                              cur?.clarificationId === c.id ? null : cur,
                                            );
                                          }}
                                        />
                                        <span>{opt.label}</span>
                                      </label>
                                    ) : (
                                      <label key={opt.id} className={styles.smartImportWizardOption}>
                                        <input
                                          type="radio"
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
                                          onChange={() => {
                                            setLoreSmartClarificationAnswers((prev) =>
                                              upsertClarificationAnswer(prev, {
                                                clarificationId: c.id,
                                                resolution: "answered",
                                                selectedOptionIds: [opt.id],
                                              }),
                                            );
                                            setLoreSmartManualQuestionId(null);
                                            setLoreSmartOtherFollowUp((cur) =>
                                              cur?.clarificationId === c.id ? null : cur,
                                            );
                                          }}
                                        />
                                        <span>{opt.label}</span>
                                      </label>
                                    ),
                                  )}
                                  <label className={styles.smartImportWizardOption}>
                                    <input
                                      type="radio"
                                      name={`clarify-other-${c.id}`}
                                      checked={otherSelected}
                                      onChange={() => {
                                        setLoreSmartManualQuestionId(c.id);
                                        setLoreSmartClarificationAnswers((prev) =>
                                          upsertClarificationAnswer(prev, {
                                            clarificationId: c.id,
                                            resolution: "other_text",
                                            otherText: ans?.otherText ?? "",
                                          }),
                                        )
                                      }}
                                    />
                                    <span>Other…</span>
                                  </label>
                                  {otherSelected ? (
                                    <textarea
                                      className={styles.smartImportWizardTextarea}
                                      placeholder="Type your answer (at least a few characters)…"
                                      value={ans?.otherText ?? ""}
                                      onFocus={() => setLoreSmartManualQuestionId(c.id)}
                                      onBlur={() => {
                                        const nextLen = ans?.otherText?.trim().length ?? 0;
                                        if (nextLen >= 4) {
                                          setLoreSmartManualQuestionId(null);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.stopPropagation();
                                        }
                                      }}
                                      onChange={(e) =>
                                        {
                                          setLoreSmartManualQuestionId(c.id);
                                          setLoreSmartClarificationAnswers((prev) =>
                                            upsertClarificationAnswer(prev, {
                                              clarificationId: c.id,
                                              resolution: "other_text",
                                              otherText: e.target.value,
                                            }),
                                          );
                                        }
                                      }
                                    />
                                  ) : null}
                                </div>
                                <div className={styles.smartImportWizardFooter}>
                                  {prevQuestion ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      tone="card-dark"
                                      type="button"
                                      onClick={() => setLoreSmartManualQuestionId(prevQuestion.id)}
                                    >
                                      Back
                                    </Button>
                                  ) : null}
                                  {recommendedClarificationOptionId(c) ? (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      tone="card-dark"
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
                                        setLoreSmartManualQuestionId(null);
                                        setLoreSmartOtherFollowUp((cur) =>
                                          cur?.clarificationId === c.id ? null : cur,
                                        );
                                      }}
                                    >
                                      Use recommended
                                    </Button>
                                  ) : null}
                                  {otherSelected ? (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      tone="solid"
                                      type="button"
                                      disabled={(ans?.otherText?.trim().length ?? 0) < 4}
                                      onClick={() => setLoreSmartManualQuestionId(null)}
                                    >
                                      Continue
                                    </Button>
                                  ) : null}
                                </div>
                              </article>
                            );
                          })()
                        ) : loreSmartQuestionUi.questionsComplete ? (
                          <div className={styles.smartImportWizardComplete}>
                            <p className={styles.smartImportWizardCompleteTitle}>You&apos;re all set</p>
                            <p className={styles.smartImportWizardCompleteBody}>
                              Your answers are ready. Apply the import to add this content to your
                              space.
                            </p>
                            <Button
                              size="md"
                              variant="primary"
                              tone="solid"
                              type="button"
                              disabled={loreImportCommitting}
                              onClick={() => void commitSmartLoreImport()}
                            >
                              {loreImportCommitting ? "Applying…" : "Apply import to canvas"}
                            </Button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
              </div>
            </div>
          </div>
        ) : null}
        <ArchitecturalLinksPanel
          graph={graph}
          activeSpaceId={activeSpaceId}
          selectedEntityIds={selectedNodeIds}
          cloudEnabled={cloudLinksBar}
          itemLinksRevision={lastItemLinksRevisionRef.current}
          onFocusEntity={(id) => focusEntityFromPalette(id)}
        />
        {!isRestrictedLayer ? (
          <>
            <GraphPanel
              open={graphOverlayOpen}
              braneId={activeBraneId}
              width={graphPanelWidth}
              onResizeWidth={setGraphPanelWidth}
              onClose={() => setGraphOverlayOpen(false)}
              onSelectItem={(id) => focusEntityFromPalette(id)}
            />
            <LinkGraphOverlay
              open={false}
              spaceId={cloudLinksBar && isUuidLike(activeSpaceId) ? activeSpaceId : null}
              onClose={() => setGraphOverlayOpen(false)}
              onSelectItem={(id) => focusEntityFromPalette(id)}
            />
            {altHeld ? (
              <div
                ref={altWordHighlightDivRef}
                className="pointer-events-none fixed left-0 top-0 z-[2090] rounded border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)]/35"
                style={{ display: "none", willChange: "transform" }}
              />
            ) : null}
            <AltGraphCard
              ref={altGraphCardDivRef}
              open={Boolean(altGraphCard)}
              term={altGraphCard?.term ?? ""}
              x={altGraphCardPosRef.current.x}
              y={altGraphCardPosRef.current.y}
              mentions={altGraphCard?.mentions ?? []}
              searchItems={altGraphCard?.searchItems ?? []}
              loadingMentions={Boolean(altGraphCard?.loadingMentions)}
              loadingSearch={Boolean(altGraphCard?.loadingSearch)}
              onClose={() => {
                setAltGraphCard(null);
                setAltHighlightRect(null);
              }}
              onShowItem={(id) => {
                if (!graphOverlayOpen) setGraphOverlayOpen(true);
                focusEntityFromPalette(id);
              }}
            />
          </>
        ) : null}
      </div>
      </div>

      <ContextMenu
        position={selectionContextMenu}
        onClose={closeSelectionContextMenu}
        items={selectionContextMenuItems}
      />
      <ContextMenu
        position={canvasEmptyContextMenu}
        onClose={closeCanvasEmptyContextMenu}
        items={canvasEmptyContextMenuItems}
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
                  shouldRenderLoreCharacterCredentialCanvasNode(entity) ? (
                    <ArchitecturalLoreCharacterCanvasNode
                      id={entity.id}
                      width={entity.width}
                      tapeVariant={entity.tapeVariant ?? tapeVariantForTheme(entity.theme)}
                      tapeRotation={entity.tapeRotation}
                      bodyHtml={canonicalizeCharacterBodyHtml(entity, entity.bodyHtml)}
                      activeTool={activeTool}
                      dragged={!!drag}
                      selected={false}
                      onBodyCommit={updateNodeBody}
                      onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
                      wikiLinkAssist={makeWikiLinkAssist(entity.id)}
                      onRichDocCommand={
                        entity.theme === "default" || entity.theme === "task"
                          ? (command, value) => runFormat(command, value)
                          : undefined
                      }
                      emptyPlaceholder={
                        entity.theme === "default" || entity.theme === "task"
                          ? "Write here, or type / for blocks…"
                          : undefined
                      }
                    />
                  ) : shouldRenderLoreLocationCanvasNode(entity) ? (
                    <ArchitecturalLoreLocationCanvasNode
                      id={entity.id}
                      width={entity.width}
                      tapeRotation={entity.tapeRotation}
                      bodyHtml={entity.bodyHtml}
                      activeTool={activeTool}
                      dragged={!!drag}
                      selected={false}
                      showStaple={!entity.stackId}
                      onBodyCommit={updateNodeBody}
                      onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
                      wikiLinkAssist={makeWikiLinkAssist(entity.id)}
                      onRichDocCommand={
                        entity.theme === "default" || entity.theme === "task"
                          ? (command, value) => runFormat(command, value)
                          : undefined
                      }
                      emptyPlaceholder={
                        entity.theme === "default" || entity.theme === "task"
                          ? "Write here, or type / for blocks…"
                          : undefined
                      }
                    />
                  ) : shouldRenderLoreFactionArchive091CanvasNode(entity) ? (
                    <ArchitecturalLoreFactionArchiveCanvasNode
                      id={entity.id}
                      width={entity.width}
                      tapeVariant={tapeVariantForLoreCard("faction", entity.loreCard?.variant ?? "v4")}
                      tapeRotation={entity.tapeRotation}
                      bodyHtml={canonicalizeFactionBodyHtml(entity, entity.bodyHtml)}
                      factionRoster={entity.factionRoster ?? []}
                      activeTool={activeTool}
                      dragged={!!drag}
                      selected={false}
                      showTape={!entity.stackId}
                      onBodyCommit={updateNodeBody}
                      onFactionRosterChange={updateFactionRoster}
                      onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
                      wikiLinkAssist={makeWikiLinkAssist(entity.id)}
                      onRichDocCommand={
                        entity.theme === "default" || entity.theme === "task"
                          ? (command, value) => runFormat(command, value)
                          : undefined
                      }
                      emptyPlaceholder={
                        entity.theme === "default" || entity.theme === "task"
                          ? "Write here, or type / for blocks…"
                          : undefined
                      }
                    />
                  ) : (
                    <ArchitecturalNodeCard
                      id={entity.id}
                      title={entity.title}
                      width={entity.width}
                      theme={entity.theme}
                      tapeVariant={entity.tapeVariant ?? tapeVariantForTheme(entity.theme)}
                      tapeRotation={entity.tapeRotation}
                      bodyHtml={entity.bodyHtml}
                      bodyDoc={entity.bodyDoc ?? null}
                      activeTool={activeTool}
                      dragged={!!drag}
                      selected={false}
                      showTape={!entity.stackId}
                      onBodyCommit={handleNodeBodyCommit}
                      onExpand={handleNodeExpand}
                      onBodyDraftDirty={(dirty) => setInlineBodyDraftDirty(entity.id, dirty)}
                      canvasPanZoomScale={1}
                      useFullImageResolution={galleryOpen && galleryNodeId === entity.id}
                      wikiLinkAssist={makeWikiLinkAssist(entity.id)}
                      onRichDocCommand={
                        entity.theme === "default" || entity.theme === "task"
                          ? (command, value) => runFormat(command, value)
                          : undefined
                      }
                      emptyPlaceholder={
                        entity.theme === "default" || entity.theme === "task"
                          ? "Write here, or type / for blocks…"
                          : undefined
                      }
                      loreCard={entity.loreCard}
                      factionRoster={entity.loreCard?.kind === "faction" ? entity.factionRoster : undefined}
                    />
                  )
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
                  <HeartgardenMediaPlaceholderImg
                    variant="neutral"
                    className={styles.mediaGalleryAsset}
                    alt=""
                    aria-hidden
                  />
                )}
                <div className={styles.mediaImageActions} contentEditable={false}>
                  <Button
                    type="button"
                    variant="ghost"
                    tone="glass"
                    size="sm"
                    className={styles.mediaUploadBtn}
                    data-architectural-media-upload="true"
                    data-media-owner-id={galleryNodeId}
                  >
                    {mediaUploadActionLabel(Boolean(galleryRaster.src))}
                  </Button>
                </div>
              </div>
              <div data-architectural-media-gallery-notes="true">
                <HeartgardenDocEditor
                  surfaceKey="gallery-notes"
                  chromeRole="focus"
                  className={styles.focusBody}
                  value={galleryDraftNotesDoc}
                  onChange={(doc) => setGalleryDraftNotesDoc(doc)}
                  editable
                  placeholder="Write a caption, or type / for blocks…"
                  enableDragHandle
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`${styles.focusOverlay} ${focusOpen ? styles.focusActive : ""} ${
          focusSurface === "code" ||
          focusSurface === "character-hybrid" ||
          focusSurface === "location-hybrid" ||
          focusSurface === "faction-hybrid"
            ? styles.focusEditorDark
            : ""
        }`}
        onPointerDownCapture={onFocusOverlayPointerDownCapture}
      >
        <div className={styles.focusSheet}>
          <div className={styles.focusHeader}>
            <div className={styles.focusHeaderLead}>
              <div
                className={`${styles.focusMeta} ${
                  focusSurface === "character-hybrid" ||
                  focusSurface === "location-hybrid" ||
                  focusSurface === "faction-hybrid"
                    ? styles.focusMetaReadable
                    : ""
                }`}
              >
                {`EDITING // ${activeNodeId ? activeNodeId.slice(0, 8).toUpperCase() : "NODE"}`}
              </div>
              {focusOpen && activeNodeId
                ? (() => {
                    const activeEntity = graph.entities[activeNodeId];
                    if (!activeEntity || activeEntity.kind !== "content") return null;
                    const showReviewBar = hasActionableAiReview(
                      activeEntity.entityMeta,
                      contentEntityHasHgAiPending(activeEntity),
                    );
                    if (!showReviewBar) return null;
                    return (
                      <div className={styles.focusAiReviewBar} role="status" aria-live="polite">
                        <ArchitecturalTooltip
                          content="Bind all pending AI/import text and mark this note reviewed"
                          side="bottom"
                          delayMs={280}
                        >
                          <Button
                            type="button"
                            size="xs"
                            variant="subtle"
                            className={styles.nodeBtn}
                            data-hg-ai-bind="true"
                            aria-label="Bind all pending AI and import text"
                            onClick={() => acceptAiReviewForEntity(activeNodeId)}
                          >
                            Bind all
                          </Button>
                        </ArchitecturalTooltip>
                      </div>
                    );
                  })()
                : null}
            </div>
            <ArchitecturalFocusCloseButton
              dirty={focusDirty}
              onDone={discardFocusAndClose}
              onSave={saveFocusAndClose}
              onDiscard={discardFocusAndClose}
            />
          </div>
          <div className={styles.focusContent}>
            {focusSurface === "character-hybrid" ||
            focusSurface === "location-hybrid" ||
            focusSurface === "faction-hybrid" ? null : (
              <BufferedTextInput
                type="text"
                className={styles.focusTitle}
                value={focusTitle}
                debounceMs={150}
                onCommit={(next) => setFocusTitle(next)}
                placeholder="Untitled brief"
                data-focus-title-editor="true"
              />
            )}
            {focusSurface === "character-hybrid" ||
            focusSurface === "location-hybrid" ||
            focusSurface === "faction-hybrid" ? (
              <LoreHybridFocusEditor
                key={`lore-hybrid-${activeNodeId ?? "none"}-${focusSurface}`}
                variant={
                  focusSurface === "character-hybrid"
                    ? "character"
                    : focusSurface === "faction-hybrid"
                      ? "faction"
                      : "location"
                }
                focusHtml={focusBody}
                onChangeFocusHtml={setFocusBody}
                factionRoster={
                  focusSurface === "faction-hybrid" && activeNodeId
                    ? graph.entities[activeNodeId]?.kind === "content"
                      ? (graph.entities[activeNodeId].factionRoster ?? [])
                      : []
                    : undefined
                }
                onFactionRosterChange={
                  focusSurface === "faction-hybrid" && activeNodeId
                    ? (nextRoster) => updateFactionRoster(activeNodeId, nextRoster)
                    : undefined
                }
                focusDocumentKey={activeNodeId ?? ""}
                className={`${styles.focusBody} ${
                  focusSurface === "character-hybrid"
                    ? styles.focusCharacterDocument
                    : focusSurface === "faction-hybrid"
                      ? styles.focusFactionDocument
                      : styles.focusLocationDocument
                }`}
              />
            ) : (
              <HeartgardenDocEditor
                surfaceKey="focus-body"
                chromeRole="focus"
                className={`${styles.focusBody} ${
                  focusSurface === "code" ? styles.focusCode : ""
                }`.trim()}
                value={focusBodyDoc}
                onChange={(doc) => setFocusBodyDoc(doc)}
                editable
                placeholder="Write here, or type / for blocks…"
                enableDragHandle={focusOpen && focusSurface !== "code"}
                codeSyntaxDark={focusSurface === "code"}
              />
            )}
          </div>
        </div>
      </div>
      {focusOpen ? (
        <div className={styles.focusBottomDock}>
          <ArchitecturalBottomDock
            variant="editor"
            showFormatToolbar
            showDocInsertCluster
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
        style={{ right: graphOverlayOpen ? graphPanelWidth : 0 }}
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
                syncAwaitingBootAuth={
                  scenario === "default" &&
                  heartgardenBootApi.loaded &&
                  heartgardenBootApi.gateEnabled &&
                  !heartgardenBootApi.sessionValid
                }
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
                syncSessionLabel={environmentSessionLabel.replace(/^Session:\s*/i, "")}
                syncSourceLabel={environmentSourceLabel.replace(/^Source:\s*/i, "")}
                syncSpaceLabel={environmentSpaceLabel}
                syncStrictGm={strictGmWorkspaceSession}
                collabNameplateEnabled={presenceIdentityEnabled}
                collabPeers={collabPeerChips}
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
                      avoidSides={ARCH_TOOLTIP_AVOID_TOP}
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
                            <ArchitecturalTooltip
                              content={crumbTip}
                              side="bottom"
                              delayMs={320}
                              avoidSides={ARCH_TOOLTIP_AVOID_TOP}
                            >
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
                  avoidSides={ARCH_TOOLTIP_AVOID_TOP}
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
                    <ArchitecturalTooltip
                      content="Import PDF, DOCX, or Markdown"
                      side="bottom"
                      delayMs={320}
                      avoidSides={ARCH_TOOLTIP_AVOID_TOP}
                    >
                      <ArchitecturalButton
                        type="button"
                        size="icon"
                        tone="glass"
                        iconOnly
                        className={styles.shellTopLogOutTrigger}
                        aria-label="Import document"
                        onClick={() => {
                          playVigilUiSound("select");
                          beginLoreImportFilePick();
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
                    avoidSides={ARCH_TOOLTIP_AVOID_TOP}
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
        {viewportToastOpen ? (
          <CanvasViewportToast onShow={onViewportToastShow} onDismiss={onViewportToastDismiss} />
        ) : null}
        {threadRosterNotice ? (
          <div className={styles.threadRosterNotice} role="status" aria-live="polite">
            {threadRosterNotice}
          </div>
        ) : null}
        {collabConnectionsNotice ? (
          <div className={styles.threadRosterNotice} role="status" aria-live="polite">
            {collabConnectionsNotice}
          </div>
        ) : null}
      </div>
    </>
  );
}
