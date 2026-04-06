"use client";

import { ArrowsOutSimple, Image as ImageIcon } from "@phosphor-icons/react";
import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  BufferedContentEditable,
  type WikiLinkAssistConfig,
} from "@/src/components/editing/BufferedContentEditable";
import { parseArchitecturalMediaFromBody } from "@/src/components/foundation/architectural-media-html";
import type {
  CanvasTool,
  NodeTheme,
  TapeVariant,
} from "@/src/components/foundation/architectural-types";
import type { ButtonTone } from "@/src/components/ui/Button";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
import { Button } from "@/src/components/ui/Button";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { pointerEventTargetElement } from "@/src/components/foundation/pointer-event-target";
import { resolveImageDisplayUrl } from "@/src/lib/heartgarden-image-display-url";

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
}: {
  title: ReactNode;
  showExpand?: boolean;
  expandLabel?: string;
  buttonTone?: ButtonTone;
  onExpand?: () => void;
}) {
  return (
    <div
      className={styles.nodeHeader}
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
      <span className={styles.nodeTitle}>{title}</span>
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
              <ArrowsOutSimple size={14} />
            </Button>
          </ArchitecturalTooltip>
        ) : null}
      </div>
    </div>
  );
}

export function ArchitecturalNodeBody({
  html,
  className,
  editable,
  spellCheck = false,
  onHtmlCommit,
  onDraftDirtyChange,
  wikiLinkAssist,
}: {
  html: string;
  className?: string;
  editable: boolean;
  spellCheck?: boolean;
  onHtmlCommit?: (html: string) => void;
  onDraftDirtyChange?: (dirty: boolean) => void;
  wikiLinkAssist?: WikiLinkAssistConfig | null;
}) {
  return (
    <BufferedContentEditable
      value={html}
      className={`${styles.nodeBody} ${className ?? ""}`.trim()}
      editable={editable}
      spellCheck={spellCheck}
      debounceMs={300}
      dataAttribute="data-node-body-editor"
      onCommit={(nextHtml) => onHtmlCommit?.(nextHtml)}
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
}: {
  id: string;
  title: string;
  width?: number;
  theme: NodeTheme;
  tapeRotation: number;
  bodyHtml: string;
  activeTool: CanvasTool;
  dragged: boolean;
  selected: boolean;
  onBodyCommit: (id: string, html: string) => void;
  onExpand: (id: string) => void;
  tapeVariant?: TapeVariant;
  showExpandButton?: boolean;
  bodyEditable?: boolean;
  showTape?: boolean;
  onBodyDraftDirty?: (dirty: boolean) => void;
  canvasPanZoomScale?: number;
  useFullImageResolution?: boolean;
  wikiLinkAssist?: WikiLinkAssistConfig | null;
}) {
  const isMediaNode = theme === "media";
  const nodeWidth = width ?? 340;
  const [imageDpr] = useState(() =>
    typeof window !== "undefined" ? Math.min(window.devicePixelRatio ?? 1, 2.5) : 1,
  );
  const cardStyle = {
    width: width != null ? `${width}px` : undefined,
    "--entity-width": `${nodeWidth}px`,
  } as CSSProperties;

  const imageCardMedia = useMemo(
    () => (isMediaNode ? parseArchitecturalMediaFromBody(bodyHtml) : { src: null, alt: "" }),
    [bodyHtml, isMediaNode],
  );

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
                <div className={styles.imagePlaceholderIcon} aria-hidden>
                  <ImageIcon size={48} weight="regular" />
                </div>
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
                  Replace
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
        dragged ? styles.dragging : ""
      } ${selected ? styles.selectedNode : ""}`}
      style={cardStyle}
    >
      {showTape ? <ArchitecturalNodeTape variant={tapeVariant} rotationDeg={tapeRotation} /> : null}
      <ArchitecturalNodeHeader
        title={title}
        showExpand={showExpandButton}
        buttonTone={theme === "code" ? "card-dark" : "card-light"}
        onExpand={() => onExpand(id)}
      />
      <ArchitecturalNodeBody
        html={bodyHtml}
        className={styles.a4DocumentBody}
        editable={bodyEditable ?? activeTool === "select"}
        spellCheck={false}
        onHtmlCommit={(html) => onBodyCommit(id, html)}
        onDraftDirtyChange={onBodyDraftDirty}
        wikiLinkAssist={
          theme === "default" || theme === "task" ? wikiLinkAssist ?? null : null
        }
      />
    </div>
  );
}
