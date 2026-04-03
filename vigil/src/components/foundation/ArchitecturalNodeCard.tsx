"use client";

import { ArrowsOutSimple } from "@phosphor-icons/react";

import type { CanvasNode, CanvasTool, NodeTheme } from "@/src/components/foundation/architectural-types";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

function themeClass(theme: NodeTheme): string {
  if (theme === "code") return styles.themeCode;
  if (theme === "task") return styles.themeTask;
  if (theme === "media") return styles.themeMedia;
  return styles.themeDefault;
}

export function ArchitecturalNodeCard({
  node,
  activeTool,
  dragged,
  selected,
  zIndex,
  onBodyInput,
  onExpand,
}: {
  node: CanvasNode;
  activeTool: CanvasTool;
  dragged: boolean;
  selected: boolean;
  zIndex: number | undefined;
  onBodyInput: (id: string, html: string) => void;
  onExpand: (id: string) => void;
}) {
  return (
    <div
      data-node-id={node.id}
      className={`${styles.entityNode} ${themeClass(node.theme)} ${
        dragged ? styles.dragging : ""
      } ${selected ? styles.selectedNode : ""}`}
      style={{
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: node.width ? `${node.width}px` : undefined,
        transform: `rotate(${node.rotation}deg)`,
        zIndex,
      }}
    >
      <div
        className={`${styles.tape} ${styles.tapeClear}`}
        style={{ transform: `translateX(-50%) rotate(${node.tapeRotation}deg)` }}
      />

      <div className={styles.nodeHeader}>
        <span className={styles.nodeTitle}>{node.title}</span>
        <div className={styles.nodeActions}>
          <button
            type="button"
            className={styles.nodeBtn}
            data-expand-btn="true"
            title="Focus Mode"
            onClick={() => onExpand(node.id)}
          >
            <ArrowsOutSimple size={16} />
          </button>
        </div>
      </div>

      <div
        className={styles.nodeBody}
        contentEditable={activeTool === "select"}
        suppressContentEditableWarning
        spellCheck={false}
        dangerouslySetInnerHTML={{ __html: node.bodyHtml }}
        onInput={(event) =>
          onBodyInput(node.id, (event.target as HTMLElement).innerHTML)
        }
      />
    </div>
  );
}
