"use client";

import { ArrowsOutSimple } from "@phosphor-icons/react";
import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  BufferedContentEditable,
  type WikiLinkAssistConfig,
} from "@/src/components/editing/BufferedContentEditable";
import { HeartgardenDocEditor } from "@/src/components/editing/HeartgardenDocEditor";
import { parseArchitecturalMediaFromBody } from "@/src/components/foundation/architectural-media-html";
import type {
  CanvasBodyCommitPayload,
  CanvasTool,
  LoreCard,
  NodeTheme,
  TapeVariant,
} from "@/src/components/foundation/architectural-types";
import type { JSONContent } from "@tiptap/core";
import type { ButtonTone } from "@/src/components/ui/Button";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
import { Button } from "@/src/components/ui/Button";
import { HeartgardenMediaPlaceholderImg } from "@/src/components/ui/HeartgardenMediaPlaceholderImg";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { pointerEventTargetElement } from "@/src/components/foundation/pointer-event-target";
import { resolveImageDisplayUrl } from "@/src/lib/heartgarden-image-display-url";
import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import { normalizeHgDocForCodeTheme } from "@/src/lib/hg-doc/code-theme-doc";
import { cx } from "@/src/lib/cx";
import type { FactionRosterEntry } from "@/src/lib/faction-roster-schema";

function themeClass(theme: NodeTheme): string {
  if (theme === "code") return styles.themeCode;
  if (theme === "task") return styles.themeTask;
  if (theme === "media") return styles.themeImage;
  return styles.themeDefault;
}

function tapeClass(variant: TapeVariant): string {
  if (variant === "masking") return styles.tapeMasking;
  if (variant === "dark") return styles.tapeDark;
  return styles.tapeClear;
}

export function ArchitecturalNodeTape({
  variant = "clear",
  rotationDeg,
}: {
  variant?: TapeVariant;
  rotationDeg: number;
}) {
  return (
    <div
      className={`${styles.tape} ${tapeClass(variant)}`}
      data-node-tape="true"
      data-tape-variant={variant}
      style={{ transform: `translateX(-50%) rotate(${rotationDeg}deg)` }}
    />
  );
}

export function ArchitecturalNodeHeader({
  title,
  showExpand = true,
  expandLabel = "Focus Mode",
  buttonTone = "card-light",
  onExpand,
  compact = false,
}: {
  title: ReactNode;
  showExpand?: boolean;
  expandLabel?: string;
  buttonTone?: ButtonTone;
  onExpand?: () => void;
  /** Tighter bar + smaller expand control — closer to title-only document headers. */
  compact?: boolean;
}) {
  return (
    <div
      className={cx(styles.nodeHeader, compact && styles.nodeHeaderCompact)}
      onDoubleClick={(event) => {
        if (!onExpand) return;
        const el = pointerEventTargetElement(event.target);
        if (!el || el.closest("button") || el.closest("[data-expand-btn='true']")) return;
        event.stopPropagation();
        onExpand();
      }}
    >
      <span
        className={styles.contentConnectionPinAnchor}
        data-content-connection-pin-anchor="true"
        aria-hidden
      />
      <div className={styles.nodeTitleRow}>
        <span className={styles.nodeTitle}>{title}</span>
      </div>
      <div className={styles.nodeActions}>
        {showExpand ? (
          <ArchitecturalTooltip content={expandLabel} side="bottom" delayMs={320}>
            <Button
              size="icon"
              variant="ghost"
              tone={buttonTone}
              className={styles.nodeBtn}
              data-expand-btn="true"
              aria-label={expandLabel}
              onClick={onExpand}
            >
              <ArrowsOutSimple size={compact ? 12 : 14} />
            </Button>
          </ArchitecturalTooltip>
        ) : null}
      </div>
    </div>
  );
}

export function ArchitecturalNodeBody({
  nodeId,
  documentVariant,
  bodyDoc,
  html,
  className,
  editable,
  spellCheck = false,
  onCommitPayload,
  onDraftDirtyChange,
  wikiLinkAssist,
  onRichDocCommand,
  emptyPlaceholder,
  codeTheme = false,
}: {
  nodeId: string;
  documentVariant: "hgDoc" | "html";
  bodyDoc?: JSONContent | null;
  html: string;
  className?: string;
  editable: boolean;
  spellCheck?: boolean;
  onCommitPayload?: (payload: CanvasBodyCommitPayload) => void;
  onDraftDirtyChange?: (dirty: boolean) => void;
  wikiLinkAssist?: WikiLinkAssistConfig | null;
  onRichDocCommand?: (command: string, value?: string) => void;
  emptyPlaceholder?: string | null;
  /** Canvas code/snippet cards — normalize legacy plain-paragraph bodies and use the dark syntax palette. */
  codeTheme?: boolean;
}) {
  if (documentVariant === "hgDoc") {
    return (
      <HeartgardenDocEditor
        surfaceKey={`canvas-${nodeId}`}
        chromeRole="canvas"
        className={`${styles.nodeBody} ${className ?? ""}`.trim()}
        value={codeTheme ? normalizeHgDocForCodeTheme(bodyDoc ?? EMPTY_HG_DOC) : bodyDoc ?? EMPTY_HG_DOC}
        codeSyntaxDark={codeTheme}
        showAiPendingGutter={false}
        editable={editable}
        placeholder={emptyPlaceholder ?? "Write here, or type / for blocks…"}
        onChange={(doc) => onCommitPayload?.({ kind: "hgDoc", doc })}
      />
    );
  }
  return (
    <BufferedContentEditable
      value={html}
      className={`${styles.nodeBody} ${className ?? ""}`.trim()}
      editable={editable}
      spellCheck={spellCheck}
      debounceMs={300}
      dataAttribute="data-node-body-editor"
      checklistDeletion={{
        taskItem: styles.taskItem,
        taskText: styles.taskText,
        taskCheckbox: styles.taskCheckbox,
      }}
      richDocCommand={onRichDocCommand}
      emptyPlaceholder={emptyPlaceholder ?? null}
      onCommit={(nextHtml) => onCommitPayload?.({ kind: "html", html: nextHtml })}
      onDraftDirtyChange={onDraftDirtyChange}
      wikiLinkAssist={wikiLinkAssist ?? null}
    />
  );
}

export function ArchitecturalNodeCard({
  id,
  title,
  width,
  theme,
  tapeRotation,
  bodyHtml,
  activeTool,
  dragged,
  selected,
  onBodyCommit,
  onExpand,
  tapeVariant = "clear",
  showExpandButton = true,
  bodyEditable,
  showTape = true,
  onBodyDraftDirty,
  /** Canvas zoom scale — used to pick image decode width when a resize template is configured. */
  canvasPanZoomScale = 1,
  useFullImageResolution = false,
  wikiLinkAssist,
  onRichDocCommand,
  emptyPlaceholder,
  loreCard,
  factionRoster,
  bodyDoc,
  aiReviewPending = false,
}: {
  id: string;
  title: string;
  width?: number;
  theme: NodeTheme;
  tapeRotation: number;
  bodyHtml: string;
  bodyDoc?: JSONContent | null;
  activeTool: CanvasTool;
  dragged: boolean;
  selected: boolean;
  onBodyCommit: (id: string, payload: CanvasBodyCommitPayload) => void;
  onExpand: (id: string) => void;
  tapeVariant?: TapeVariant;
  showExpandButton?: boolean;
  bodyEditable?: boolean;
  showTape?: boolean;
  onBodyDraftDirty?: (dirty: boolean) => void;
  canvasPanZoomScale?: number;
  useFullImageResolution?: boolean;
  wikiLinkAssist?: WikiLinkAssistConfig | null;
  onRichDocCommand?: (command: string, value?: string) => void;
  emptyPlaceholder?: string | null;
  loreCard?: LoreCard | null;
  /** Roster rows for faction cards (`hgArch.factionRoster`) — thread targets use `data-faction-roster-entry-id`. */
  factionRoster?: FactionRosterEntry[];
  /** From `items.entity_meta.aiReview` and body pending marks — show Unreviewed chip when actionable. */
  aiReviewPending?: boolean;
}) {
  const MAX_ENTITY_CARD_WIDTH = 340;
  const isMediaNode = theme === "media";
  const documentVariant: "hgDoc" | "html" =
    !loreCard && (theme === "default" || theme === "task" || theme === "code") ? "hgDoc" : "html";
  const nodeWidth = Math.min(width ?? MAX_ENTITY_CARD_WIDTH, MAX_ENTITY_CARD_WIDTH);
  const [imageDpr] = useState(() =>
    typeof window !== "undefined" ? Math.min(window.devicePixelRatio ?? 1, 2.5) : 1,
  );
  const cardStyle = {
    width: `${nodeWidth}px`,
    "--entity-width": `${nodeWidth}px`,
  } as CSSProperties;

  const imageCardMedia = useMemo(
    () => (isMediaNode ? parseArchitecturalMediaFromBody(bodyHtml) : { src: null, alt: "" }),
    [bodyHtml, isMediaNode],
  );

  const factionRosterRows = useMemo(() => {
    if (loreCard?.kind !== "faction" || !factionRoster?.length) return null;
    return factionRoster;
  }, [factionRoster, loreCard?.kind]);

  const imageDisplaySrc = useMemo(() => {
    if (!imageCardMedia.src) return null;
    return resolveImageDisplayUrl(imageCardMedia.src, {
      maxCssPixels: nodeWidth * canvasPanZoomScale,
      devicePixelRatio: imageDpr,
      useFullResolution: useFullImageResolution,
    });
  }, [
    imageCardMedia.src,
    nodeWidth,
    canvasPanZoomScale,
    imageDpr,
    useFullImageResolution,
  ]);

  if (isMediaNode) {
    return (
      <div
        className={`${styles.entityNode} ${themeClass(theme)} ${styles.unboundedMediaNode} ${
          dragged ? styles.dragging : ""
        } ${selected ? styles.selectedNode : ""}`}
        style={cardStyle}
      >
        {showTape ? <ArchitecturalNodeTape variant={tapeVariant} rotationDeg={tapeRotation} /> : null}
        <ArchitecturalNodeHeader
          title={title.trim() || "Untitled image"}
          showExpand={showExpandButton}
          expandLabel="Open gallery"
          buttonTone="card-dark"
          onExpand={() => onExpand(id)}
        />
        <ArchitecturalTooltip content="Double-click to open gallery" side="top" delayMs={400}>
          <div
            className={
              imageCardMedia.src
                ? styles.imageContainer
                : `${styles.imageContainer} ${styles.imageContainerPlaceholder}`
            }
            data-image-open-gallery="true"
          >
            <div className={styles.imageCardMediaRoot} data-architectural-media-root="true">
              {imageCardMedia.src ? (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic user/R2 URLs; not suitable for next/image without broad remotePatterns
                <img
                  key={`${imageCardMedia.src}|${imageDisplaySrc ?? ""}`}
                  className={styles.imageSlotImg}
                  src={imageDisplaySrc ?? imageCardMedia.src}
                  alt={imageCardMedia.alt || title}
                  draggable={false}
                />
              ) : (
                <HeartgardenMediaPlaceholderImg
                  variant="neutral"
                  className={styles.imageSlotImg}
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
                  data-media-owner-id={id}
                >
                  {imageCardMedia.src ? "Replace" : "Upload"}
                </Button>
              </div>
            </div>
          </div>
        </ArchitecturalTooltip>
      </div>
    );
  }

  return (
    <div
      className={`${styles.entityNode} ${themeClass(theme)} ${styles.a4DocumentNode} ${
        loreCard?.kind === "location" ? styles.loreLocationCanvasRoot : ""
      } ${dragged ? styles.dragging : ""} ${selected ? styles.selectedNode : ""}`}
      style={cardStyle}
      data-lore-kind={loreCard?.kind}
      data-lore-variant={loreCard?.variant}
    >
      {showTape ? <ArchitecturalNodeTape variant={tapeVariant} rotationDeg={tapeRotation} /> : null}
      <ArchitecturalNodeHeader
        title={title}
        showExpand={showExpandButton}
        buttonTone={theme === "code" ? "card-dark" : "card-light"}
        onExpand={() => onExpand(id)}
      />
      <ArchitecturalNodeBody
        nodeId={id}
        documentVariant={documentVariant}
        bodyDoc={bodyDoc}
        html={bodyHtml}
        className={styles.a4DocumentBody}
        editable={bodyEditable ?? activeTool === "select"}
        spellCheck={false}
        onCommitPayload={(payload) => onBodyCommit(id, payload)}
        onDraftDirtyChange={onBodyDraftDirty}
        wikiLinkAssist={
          theme === "default" || theme === "task" ? wikiLinkAssist ?? null : null
        }
        onRichDocCommand={onRichDocCommand}
        emptyPlaceholder={emptyPlaceholder}
        codeTheme={theme === "code"}
      />
      {factionRosterRows ? (
        <div
          className={styles.factionRosterCanvas}
          data-hg-lore-faction-roster="1"
          contentEditable={false}
        >
          <p className={styles.factionRosterCanvasLabel}>Member index</p>
          <div className={styles.factionRosterCanvasList} role="list">
            {factionRosterRows.map((row) => {
              const primary =
                row.kind === "character"
                  ? (row.displayNameOverride?.trim() ||
                      `Character ${row.characterItemId.slice(0, 8)}…`)
                  : row.label.trim() || "Member";
              const secondary =
                row.kind === "character"
                  ? (row.roleOverride?.trim() || null)
                  : (row.role?.trim() || null);
              return (
                <div
                  key={row.id}
                  className={styles.factionRosterCanvasRow}
                  role="listitem"
                  data-faction-roster-entry-id={row.id}
                  data-faction-roster-kind={row.kind}
                >
                  <div className={styles.factionRosterCanvasRowText}>{primary}</div>
                  {secondary ? (
                    <div className={styles.factionRosterCanvasRowMeta}>{secondary}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
