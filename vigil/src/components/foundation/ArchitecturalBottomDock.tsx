"use client";

import {
  CheckSquare,
  Code,
  FileText,
  Image as ImageIcon,
  ListBullets,
  TextB,
  TextH,
  TextItalic,
} from "@phosphor-icons/react";

import type { NodeTheme } from "@/src/components/foundation/architectural-types";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

export function ArchitecturalBottomDock({
  onFormat,
  onCreateNode,
}: {
  onFormat: (command: string, value?: string) => void;
  onCreateNode: (type: NodeTheme) => void;
}) {
  return (
    <div className={styles.bottomDock}>
      <div className={styles.glassPanelDock}>
        <div className={styles.formatToolbar}>
          <button
            type="button"
            className={styles.btnIcon}
            title="Bold"
            onMouseDown={(e) => {
              e.preventDefault();
              onFormat("bold");
            }}
          >
            <TextB size={18} />
          </button>
          <button
            type="button"
            className={styles.btnIcon}
            title="Italic"
            onMouseDown={(e) => {
              e.preventDefault();
              onFormat("italic");
            }}
          >
            <TextItalic size={18} />
          </button>
          <div className={styles.sepSmall} />
          <button
            type="button"
            className={styles.btnIcon}
            title="List"
            onMouseDown={(e) => {
              e.preventDefault();
              onFormat("insertUnorderedList");
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
              onFormat("formatBlock", "H1");
            }}
          >
            <TextH size={18} />
          </button>
        </div>

        <div className={styles.addMenu}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => onCreateNode("default")}
          >
            <FileText size={16} /> Note
          </button>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => onCreateNode("task")}
          >
            <CheckSquare size={16} /> Task
          </button>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => onCreateNode("code")}
          >
            <Code size={16} /> Code
          </button>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => onCreateNode("media")}
          >
            <ImageIcon size={16} /> Media
          </button>
        </div>
      </div>
    </div>
  );
}
