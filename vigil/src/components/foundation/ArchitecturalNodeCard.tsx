"use client";

import { ArrowsOutSimple } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import type {
  CanvasTool,
  NodeTheme,
  TapeVariant,
} from "@/src/components/foundation/architectural-types";
import type { ButtonTone } from "@/src/components/ui/Button";
import { Button } from "@/src/components/ui/Button";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

function themeClass(theme: NodeTheme): string {
  if (theme === "code") return styles.themeCode;
  if (theme === "task") return styles.themeTask;
  if (theme === "media") return styles.themeMedia;
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
    <div className={styles.nodeHeader}>
      <span className={styles.nodeTitle}>{title}</span>
      <div className={styles.nodeActions}>
        {showExpand ? (
          <Button
            size="icon"
            variant="ghost"
            tone={buttonTone}
            className={styles.nodeBtn}
            data-expand-btn="true"
            title={expandLabel}
            aria-label={expandLabel}
            onClick={onExpand}
          >
            <ArrowsOutSimple size={16} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ArchitecturalNodeBody({
  html,
  editable,
  spellCheck = false,
  onHtmlChange,
}: {
  html: string;
  editable: boolean;
  spellCheck?: boolean;
  onHtmlChange?: (html: string) => void;
}) {
  return (
    <div
      className={styles.nodeBody}
      contentEditable={editable}
      suppressContentEditableWarning
      spellCheck={spellCheck}
      dangerouslySetInnerHTML={{ __html: html }}
      onInput={(event) => onHtmlChange?.((event.target as HTMLElement).innerHTML)}
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
  onBodyInput,
  onExpand,
  tapeVariant = "clear",
  showExpandButton = true,
  bodyEditable,
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
  onBodyInput: (id: string, html: string) => void;
  onExpand: (id: string) => void;
  tapeVariant?: TapeVariant;
  showExpandButton?: boolean;
  bodyEditable?: boolean;
}) {
  return (
    <div
      className={`${styles.entityNode} ${themeClass(theme)} ${
        dragged ? styles.dragging : ""
      } ${selected ? styles.selectedNode : ""}`}
      style={{
        width: width ? `${width}px` : undefined,
      }}
    >
      <ArchitecturalNodeTape variant={tapeVariant} rotationDeg={tapeRotation} />
      <ArchitecturalNodeHeader
        title={title}
        showExpand={showExpandButton}
        buttonTone={theme === "code" ? "card-dark" : "card-light"}
        onExpand={() => onExpand(id)}
      />
      <ArchitecturalNodeBody
        html={bodyHtml}
        editable={bodyEditable ?? activeTool === "select"}
        spellCheck={false}
        onHtmlChange={(html) => onBodyInput(id, html)}
      />
    </div>
  );
}
