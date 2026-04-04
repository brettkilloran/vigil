"use client";

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CaretDown,
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
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  ArchitecturalButton,
  type ArchitecturalButtonTone,
} from "@/src/components/foundation/ArchitecturalButton";
import {
  FOLDER_COLOR_SCHEMES,
  type FolderColorSchemeId,
} from "@/src/components/foundation/architectural-folder-schemes";
import type {
  ArchitecturalBottomDockVariant,
  DockCreateAction,
  DockFormatAction,
  NodeTheme,
} from "@/src/components/foundation/architectural-types";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { cx } from "@/src/lib/cx";

function formatIcon(command: string, value?: string): ReactNode {
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
  { id: "checklist", label: "Checklist", command: "arch:checklist" },
  { id: "insertImage", label: "Insert image", command: "arch:insertImage" },
  { id: "divider", label: "Divider", command: "insertHorizontalRule" },
];

export const DEFAULT_FORMAT_ACTIONS: DockFormatAction[] = [
  { id: "heading", label: "Heading", command: "formatBlock", value: "h1" },
  { id: "bold", label: "Bold", command: "bold" },
  { id: "italic", label: "Italic", command: "italic" },
  { id: "underline", label: "Underline", command: "underline" },
  { id: "strikeThrough", label: "Strikethrough", command: "strikeThrough" },
  { id: "list", label: "Bulleted list", command: "insertUnorderedList" },
  { id: "numberedList", label: "Numbered list", command: "insertOrderedList" },
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
  activeBlockTag = "p",
  onFormat,
}: {
  insertDocActions?: DockFormatAction[];
  formatActions?: DockFormatAction[];
  /** Hide in-document inserts (e.g. non-prose surfaces). */
  showDocInsertCluster?: boolean;
  /** `card-dark` for solid black editor dock. */
  actionTone?: Extract<ArchitecturalButtonTone, "glass" | "card-dark">;
  activeBlockTag?: "p" | "h1" | "h2" | "h3" | "blockquote";
  onFormat: (command: string, value?: string) => void;
}) {
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const headingPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!headingMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const t = event.target as Node | null;
      if (!t || !headingPickerRef.current?.contains(t)) {
        setHeadingMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [headingMenuOpen]);

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
                active={action.active}
                iconOnly
                title={action.label}
                aria-label={action.label}
                disabled={action.disabled}
                leadingIcon={formatIcon(action.command, action.value)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (action.disabled) return;
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
        {formatActions.map((action) => {
          if (action.command === "formatBlock" && action.value === "h1") {
            const headingOptions = [
              { label: "Body", value: "p" as const },
              { label: "H1", value: "h1" as const },
              { label: "H2", value: "h2" as const },
              { label: "H3", value: "h3" as const },
            ];
            return (
              <div key={action.id} className={styles.headingPicker} ref={headingPickerRef}>
                <ArchitecturalButton
                  size="icon"
                  tone={actionTone}
                  active={action.active}
                  iconOnly
                  title={action.label}
                  aria-label={action.label}
                  disabled={action.disabled}
                  leadingIcon={formatIcon(action.command, action.value)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (action.disabled) return;
                    setHeadingMenuOpen((open) => !open);
                  }}
                />
                {headingMenuOpen ? (
                  <div className={styles.headingPickerMenu} role="menu" aria-label="Heading levels">
                    {headingOptions.map((opt) => (
                      <ArchitecturalButton
                        key={opt.value}
                        size="menu"
                        tone={actionTone}
                        active={activeBlockTag === opt.value}
                        title={opt.label}
                        aria-label={opt.label}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onFormat("formatBlock", opt.value);
                          setHeadingMenuOpen(false);
                        }}
                      >
                        {opt.label}
                      </ArchitecturalButton>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }
          return (
            <ArchitecturalButton
              key={action.id}
              size="icon"
              tone={actionTone}
              active={action.active}
              iconOnly
              title={action.label}
              aria-label={action.label}
              disabled={action.disabled}
              leadingIcon={formatIcon(action.command, action.value)}
              onMouseDown={(e) => {
                e.preventDefault();
                if (action.disabled) return;
                onFormat(action.command, action.value);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function ArchitecturalFolderColorStrip({
  value,
  onChange,
  variant = "canvas",
}: {
  value: FolderColorSchemeId | null;
  onChange: (next: FolderColorSchemeId | null) => void;
  variant?: "canvas" | "editor";
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const isEditor = variant === "editor";
  const activeMeta = value ? FOLDER_COLOR_SCHEMES.find((s) => s.id === value) : null;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const t = event.target as Node | null;
      if (!t || !pickerRef.current?.contains(t)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const pick = (next: FolderColorSchemeId | null) => {
    onChange(next);
    setMenuOpen(false);
  };

  return (
    <div
      ref={pickerRef}
      className={styles.dockFolderTintPicker}
      role="group"
      aria-label="Folder inks"
    >
      <button
        type="button"
        className={cx(
          styles.dockFolderTintTrigger,
          isEditor && styles.dockFolderTintTriggerEditor,
          menuOpen && styles.dockFolderTintTriggerOpen,
        )}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        title="Folder inks"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span
          className={cx(
            styles.dockFolderTintPreview,
            value === null ? styles.dockFolderTintPreviewClassic : null,
          )}
          style={activeMeta ? { background: activeMeta.swatch } : undefined}
          aria-hidden
        />
        <span className={styles.dockFolderTintTriggerText}>Tint</span>
        <CaretDown
          size={11}
          weight="bold"
          className={styles.dockFolderTintCaret}
          aria-hidden
        />
      </button>
      {menuOpen ? (
        <div
          className={cx(
            styles.dockFolderTintMenu,
            isEditor && styles.dockFolderTintMenuEditor,
          )}
          role="listbox"
          aria-label="Folder color inks"
        >
          <div
            className={cx(
              styles.dockFolderTintMenuHeader,
              isEditor && styles.dockFolderTintMenuHeaderEditor,
            )}
          >
            Coven inks
          </div>
          <div className={styles.dockFolderTintSwatchGrid}>
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              title="Black mirror"
              aria-label="Black mirror — unmarked folder"
              className={cx(
                styles.dockFolderTintMenuSwatch,
                styles.dockFolderTintMenuSwatchClassic,
                value === null && styles.dockFolderTintMenuSwatchSelected,
              )}
              onClick={() => pick(null)}
            />
            {FOLDER_COLOR_SCHEMES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={value === s.id}
                title={s.label}
                aria-label={s.label}
                className={cx(
                  styles.dockFolderTintMenuSwatch,
                  value === s.id && styles.dockFolderTintMenuSwatchSelected,
                )}
                style={{ background: s.swatch }}
                onClick={() => pick(s.id)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ArchitecturalCreateMenu({
  actions,
  actionTone = "menu",
  disabled = false,
  onCreateNode,
}: {
  actions: DockCreateAction[];
  /** `card-dark` for solid black editor dock. */
  actionTone?: Extract<ArchitecturalButtonTone, "menu" | "card-dark">;
  disabled?: boolean;
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
          disabled={disabled}
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
  createDisabled = false,
  activeBlockTag = "p",
  showCreateMenu = true,
  folderColorPicker = null,
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
  createDisabled?: boolean;
  activeBlockTag?: "p" | "h1" | "h2" | "h3" | "blockquote";
  showCreateMenu?: boolean;
  /** Shown when a single folder is selected on the canvas. */
  folderColorPicker?: {
    value: FolderColorSchemeId | null;
    onChange: (next: FolderColorSchemeId | null) => void;
  } | null;
}) {
  const isEditor = variant === "editor";
  const formatActionTone = isEditor ? "card-dark" : "glass";
  const historyActionTone = isEditor ? "card-dark" : "glass";
  const createActionTone = isEditor ? "card-dark" : "menu";

  return (
    <div className={cx(styles.bottomDock, isEditor && styles.bottomDockEditor)}>
      <div className={styles.rootDockCluster}>
        {showCreateMenu ? (
          <div className={styles.rootDockPanel}>
            <ArchitecturalCreateMenu
              actions={createActions}
              actionTone={createActionTone}
              disabled={createDisabled}
              onCreateNode={onCreateNode}
            />
          </div>
        ) : null}
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
        {folderColorPicker ? (
          <div className={cx(styles.rootDockPanelSlot, styles.rootDockPanelSlotOpen)}>
            <div className={styles.rootDockPanelSlotInner}>
              <div className={styles.rootDockPanel}>
                <ArchitecturalFolderColorStrip
                  value={folderColorPicker.value}
                  onChange={folderColorPicker.onChange}
                  variant={isEditor ? "editor" : "canvas"}
                />
              </div>
            </div>
          </div>
        ) : null}
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
                activeBlockTag={activeBlockTag}
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
