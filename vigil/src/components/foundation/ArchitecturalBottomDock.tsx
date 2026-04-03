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
import type { ReactNode } from "react";

import type {
  DockCreateAction,
  DockFormatAction,
  NodeTheme,
} from "@/src/components/foundation/architectural-types";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

function formatIcon(command: string): ReactNode {
  if (command === "bold") return <TextB size={18} />;
  if (command === "italic") return <TextItalic size={18} />;
  if (command === "insertUnorderedList") return <ListBullets size={18} />;
  if (command === "formatBlock") return <TextH size={18} />;
  return <TextB size={18} />;
}

function createIcon(nodeType: NodeTheme): ReactNode {
  if (nodeType === "task") return <CheckSquare size={16} />;
  if (nodeType === "code") return <Code size={16} />;
  if (nodeType === "media") return <ImageIcon size={16} />;
  return <FileText size={16} />;
}

export const DEFAULT_FORMAT_ACTIONS: DockFormatAction[] = [
  { id: "bold", label: "Bold", command: "bold" },
  { id: "italic", label: "Italic", command: "italic" },
  { id: "list", label: "List", command: "insertUnorderedList" },
  { id: "heading", label: "Heading", command: "formatBlock", value: "H1" },
];

export const DEFAULT_CREATE_ACTIONS: DockCreateAction[] = [
  { id: "note", label: "Note", nodeType: "default" },
  { id: "task", label: "Task", nodeType: "task" },
  { id: "code", label: "Code", nodeType: "code" },
  { id: "media", label: "Media", nodeType: "media" },
];

export function ArchitecturalFormatToolbar({
  actions,
  onFormat,
}: {
  actions: DockFormatAction[];
  onFormat: (command: string, value?: string) => void;
}) {
  return (
    <div className={styles.formatToolbar}>
      {actions.map((action, index) => (
        <div key={action.id} style={{ display: "contents" }}>
          {index === 2 ? <div className={styles.sepSmall} /> : null}
          <button
            type="button"
            className={styles.btnIcon}
            title={action.label}
            onMouseDown={(e) => {
              e.preventDefault();
              onFormat(action.command, action.value);
            }}
          >
            {formatIcon(action.command)}
          </button>
        </div>
      ))}
    </div>
  );
}

export function ArchitecturalCreateMenu({
  actions,
  onCreateNode,
}: {
  actions: DockCreateAction[];
  onCreateNode: (type: NodeTheme) => void;
}) {
  return (
    <div className={styles.addMenu}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={styles.addBtn}
          onClick={() => onCreateNode(action.nodeType)}
        >
          {createIcon(action.nodeType)} {action.label}
        </button>
      ))}
    </div>
  );
}

export function ArchitecturalBottomDock({
  onFormat,
  onCreateNode,
  formatActions = DEFAULT_FORMAT_ACTIONS,
  createActions = DEFAULT_CREATE_ACTIONS,
}: {
  onFormat: (command: string, value?: string) => void;
  onCreateNode: (type: NodeTheme) => void;
  formatActions?: DockFormatAction[];
  createActions?: DockCreateAction[];
}) {
  return (
    <div className={styles.bottomDock}>
      <div className={styles.glassPanelDock}>
        <ArchitecturalFormatToolbar actions={formatActions} onFormat={onFormat} />
        <ArchitecturalCreateMenu actions={createActions} onCreateNode={onCreateNode} />
      </div>
    </div>
  );
}
