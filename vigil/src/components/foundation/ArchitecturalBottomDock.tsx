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
  ListNumbers,
  Minus,
  Quotes,
  TextB,
  TextH,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

import {
  ArchitecturalButton,
  type ArchitecturalButtonTone,
} from "@/src/components/foundation/ArchitecturalButton";
import type {
  ArchitecturalBottomDockVariant,
  DockCreateAction,
  DockFormatAction,
  NodeTheme,
} from "@/src/components/foundation/architectural-types";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { cx } from "@/src/lib/cx";

function formatIcon(command: string, value?: string): ReactNode {
  if (command === "arch:codeBlock") return <Code size={18} />;
  if (command === "arch:checklist") return <CheckSquare size={18} />;
  if (command === "arch:insertImage") return <ImageIcon size={18} />;
  if (command === "insertHorizontalRule") return <Minus size={18} />;
  if (command === "formatBlock" && value === "blockquote") return <Quotes size={18} />;
  if (command === "bold") return <TextB size={18} />;
  if (command === "italic") return <TextItalic size={18} />;
  if (command === "underline") return <TextUnderline size={18} />;
  if (command === "strikeThrough") return <TextStrikethrough size={18} />;
  if (command === "insertUnorderedList") return <ListBullets size={18} />;
  if (command === "insertOrderedList") return <ListNumbers size={18} />;
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

/** In-document blocks (Dropbox Paper–style insert strip). Handled in `ArchitecturalCanvasApp` `runFormat`. */
export const DEFAULT_DOC_INSERT_ACTIONS: DockFormatAction[] = [
  { id: "quote", label: "Quote", command: "formatBlock", value: "blockquote" },
  { id: "codeBlock", label: "Code block", command: "arch:codeBlock" },
  { id: "checklist", label: "Checklist", command: "arch:checklist" },
  { id: "insertImage", label: "Insert image", command: "arch:insertImage" },
  { id: "divider", label: "Divider", command: "insertHorizontalRule" },
];

export const DEFAULT_FORMAT_ACTIONS: DockFormatAction[] = [
  { id: "bold", label: "Bold", command: "bold" },
  { id: "italic", label: "Italic", command: "italic" },
  { id: "underline", label: "Underline", command: "underline" },
  { id: "strikeThrough", label: "Strikethrough", command: "strikeThrough" },
  { id: "list", label: "Bulleted list", command: "insertUnorderedList" },
  { id: "numberedList", label: "Numbered list", command: "insertOrderedList" },
  { id: "heading", label: "Heading", command: "formatBlock", value: "h1" },
];

export const DEFAULT_CREATE_ACTIONS: DockCreateAction[] = [
  { id: "note", label: "Note", nodeType: "default" },
  { id: "task", label: "Task", nodeType: "task" },
  { id: "code", label: "Code", nodeType: "code" },
  { id: "media", label: "Media", nodeType: "media" },
  { id: "folder", label: "Folder", nodeType: "folder" },
];

export function ArchitecturalFormatToolbar({
  insertDocActions = DEFAULT_DOC_INSERT_ACTIONS,
  formatActions = DEFAULT_FORMAT_ACTIONS,
  showDocInsertCluster = true,
  actionTone = "glass",
  onFormat,
}: {
  insertDocActions?: DockFormatAction[];
  formatActions?: DockFormatAction[];
  /** Hide in-document inserts (e.g. non-prose surfaces). */
  showDocInsertCluster?: boolean;
  /** `card-dark` for solid black editor dock. */
  actionTone?: Extract<ArchitecturalButtonTone, "glass" | "card-dark">;
  onFormat: (command: string, value?: string) => void;
}) {
  return (
    <div className={styles.formatToolbarWrap}>
      <div
        className={cx(
          styles.formatToolbarInsertSlot,
          showDocInsertCluster && styles.formatToolbarInsertSlotOpen,
        )}
      >
        <div
          className={styles.formatToolbarInsertSlotInner}
          inert={showDocInsertCluster ? undefined : true}
        >
          <div
            className={`${styles.formatToolbar} ${styles.dockInsertToolbar}`}
            role="toolbar"
            aria-label="Insert blocks"
          >
            {insertDocActions.map((action) => (
              <ArchitecturalButton
                key={action.id}
                size="icon"
                tone={actionTone}
                iconOnly
                title={action.label}
                aria-label={action.label}
                leadingIcon={formatIcon(action.command, action.value)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onFormat(action.command, action.value);
                }}
              />
            ))}
          </div>
          <div
            className={`${styles.toolbarClusterSep} ${styles.toolbarClusterSepDock}`}
            aria-hidden
          />
        </div>
      </div>
      <div
        className={`${styles.formatToolbar} ${styles.dockFormatToolbar}`}
        role="toolbar"
        aria-label="Text formatting"
      >
        {formatActions.map((action) => (
          <ArchitecturalButton
            key={action.id}
            size="icon"
            tone={actionTone}
            iconOnly
            title={action.label}
            aria-label={action.label}
            leadingIcon={formatIcon(action.command, action.value)}
            onMouseDown={(e) => {
              e.preventDefault();
              onFormat(action.command, action.value);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function ArchitecturalCreateMenu({
  actions,
  actionTone = "menu",
  onCreateNode,
}: {
  actions: DockCreateAction[];
  /** `card-dark` for solid black editor dock. */
  actionTone?: Extract<ArchitecturalButtonTone, "menu" | "card-dark">;
  onCreateNode: (type: NodeTheme) => void;
}) {
  return (
    <div
      className={`${styles.addMenu} ${styles.dockCreateToolbar}`}
      role="toolbar"
      aria-label="Create items"
    >
      {actions.map((action) => (
        <ArchitecturalButton
          key={action.id}
          size="icon"
          tone={actionTone}
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
  variant = "canvas",
  onFormat,
  onCreateNode,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  undoLabel = "Undo",
  redoLabel = "Redo",
  insertDocActions = DEFAULT_DOC_INSERT_ACTIONS,
  formatActions = DEFAULT_FORMAT_ACTIONS,
  createActions = DEFAULT_CREATE_ACTIONS,
  showFormatToolbar = true,
  showDocInsertCluster = true,
}: {
  /** `editor`: solid black panels + light icon controls (focus mode only). */
  variant?: ArchitecturalBottomDockVariant;
  onFormat: (command: string, value?: string) => void;
  onCreateNode: (type: NodeTheme) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  undoLabel?: string;
  redoLabel?: string;
  insertDocActions?: DockFormatAction[];
  formatActions?: DockFormatAction[];
  createActions?: DockCreateAction[];
  /** When false, only history + create clusters show (canvas not in a text field). */
  showFormatToolbar?: boolean;
  showDocInsertCluster?: boolean;
}) {
  const isEditor = variant === "editor";
  const formatActionTone = isEditor ? "card-dark" : "glass";
  const historyActionTone = isEditor ? "card-dark" : "glass";
  const createActionTone = isEditor ? "card-dark" : "menu";

  return (
    <div className={cx(styles.bottomDock, isEditor && styles.bottomDockEditor)}>
      <div className={styles.rootDockCluster}>
        <div className={styles.rootDockPanel}>
          <ArchitecturalCreateMenu
            actions={createActions}
            actionTone={createActionTone}
            onCreateNode={onCreateNode}
          />
        </div>
        <div
          className={cx(
            styles.rootDockPanelSlot,
            onUndo && onRedo && styles.rootDockPanelSlotOpen,
          )}
        >
          <div className={styles.rootDockPanelSlotInner}>
            <div
              className={styles.rootDockPanel}
              inert={onUndo && onRedo ? undefined : true}
            >
              <div
                className={`${styles.addMenu} ${styles.dockHistoryToolbar}`}
                role="toolbar"
                aria-label="History"
                aria-hidden={onUndo && onRedo ? undefined : true}
              >
                {onUndo && onRedo ? (
                  <>
                    <ArchitecturalButton
                      size="icon"
                      tone={historyActionTone}
                      iconOnly
                      title={undoLabel}
                      aria-label={undoLabel}
                      disabled={!canUndo}
                      leadingIcon={<ArrowCounterClockwise size={18} />}
                      onClick={() => onUndo()}
                    />
                    <ArchitecturalButton
                      size="icon"
                      tone={historyActionTone}
                      iconOnly
                      title={redoLabel}
                      aria-label={redoLabel}
                      disabled={!canRedo}
                      leadingIcon={<ArrowClockwise size={18} />}
                      onClick={() => onRedo()}
                    />
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <div
          className={cx(
            styles.rootDockPanelSlot,
            showFormatToolbar && styles.rootDockPanelSlotOpen,
          )}
        >
          <div className={styles.rootDockPanelSlotInner}>
            <div
              className={styles.rootDockPanel}
              inert={showFormatToolbar ? undefined : true}
            >
              <ArchitecturalFormatToolbar
                insertDocActions={insertDocActions}
                formatActions={formatActions}
                showDocInsertCluster={showDocInsertCluster}
                actionTone={formatActionTone}
                onFormat={onFormat}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { ArchitecturalBottomDockVariant } from "@/src/components/foundation/architectural-types";
