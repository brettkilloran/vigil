"use client";

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CheckSquare,
  Code,
  FileText,
  FolderPlus,
  Image as ImageIcon,
  ListBullets,
  TextB,
  TextH,
  TextItalic,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";
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
  if (nodeType === "folder") return <FolderPlus size={16} />;
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
  { id: "folder", label: "Folder", nodeType: "folder" },
];

export function ArchitecturalFormatToolbar({
  actions,
  onFormat,
}: {
  actions: DockFormatAction[];
  onFormat: (command: string, value?: string) => void;
}) {
  return (
    <div className={styles.formatToolbar} role="toolbar" aria-label="Text formatting">
      {actions.map((action) => (
        <ArchitecturalButton
          key={action.id}
          size="icon"
          tone="glass"
          iconOnly
          title={action.label}
          aria-label={action.label}
          leadingIcon={formatIcon(action.command)}
          onMouseDown={(e) => {
            e.preventDefault();
            onFormat(action.command, action.value);
          }}
        />
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
    <div className={styles.addMenu} role="toolbar" aria-label="Create items">
      {actions.map((action) => (
        <ArchitecturalButton
          key={action.id}
          size="icon"
          tone="menu"
          iconOnly
          title={action.label}
          aria-label={`Create ${action.label}`}
          leadingIcon={createIcon(action.nodeType)}
          onClick={() => onCreateNode(action.nodeType)}
        />
      ))}
    </div>
  );
}

export function ArchitecturalBottomDock({
  onFormat,
  onCreateNode,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  undoLabel = "Undo",
  redoLabel = "Redo",
  formatActions = DEFAULT_FORMAT_ACTIONS,
  createActions = DEFAULT_CREATE_ACTIONS,
}: {
  onFormat: (command: string, value?: string) => void;
  onCreateNode: (type: NodeTheme) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  undoLabel?: string;
  redoLabel?: string;
  formatActions?: DockFormatAction[];
  createActions?: DockCreateAction[];
}) {
  return (
    <div className={styles.bottomDock}>
      <div className={styles.rootDockCluster}>
        {onUndo && onRedo ? (
          <div className={styles.rootDockPanel}>
            <div className={styles.addMenu} role="toolbar" aria-label="History">
              <ArchitecturalButton
                size="icon"
                tone="glass"
                iconOnly
                title={undoLabel}
                aria-label={undoLabel}
                disabled={!canUndo}
                leadingIcon={<ArrowCounterClockwise size={18} />}
                onClick={() => onUndo()}
              />
              <ArchitecturalButton
                size="icon"
                tone="glass"
                iconOnly
                title={redoLabel}
                aria-label={redoLabel}
                disabled={!canRedo}
                leadingIcon={<ArrowClockwise size={18} />}
                onClick={() => onRedo()}
              />
            </div>
          </div>
        ) : null}
        <div className={styles.rootDockPanel}>
          <ArchitecturalFormatToolbar actions={formatActions} onFormat={onFormat} />
        </div>
        <div className={styles.rootDockPanel}>
          <ArchitecturalCreateMenu actions={createActions} onCreateNode={onCreateNode} />
        </div>
      </div>
    </div>
  );
}
