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
  MapPin,
  Minus,
  Quotes,
  ArrowsOut,
  Stack,
  TextB,
  TextH,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
  Trash,
  User,
  UsersThree,
} from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactElement, ReactNode } from "react";

import {
  ArchitecturalButton,
  type ArchitecturalButtonTone,
} from "@/src/components/foundation/ArchitecturalButton";
import {
  ArchitecturalTooltip,
  ARCH_TOOLTIP_AVOID_BOTTOM,
} from "@/src/components/foundation/ArchitecturalTooltip";
import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";
import { Button } from "@/src/components/ui/Button";
import {
  FOLDER_COLOR_SCHEMES,
  type FolderColorSchemeId,
} from "@/src/components/foundation/architectural-folder-schemes";
import type {
  ArchitecturalBottomDockVariant,
  DockCreateAction,
  DockFormatAction,
  LoreCardKind,
  LoreCardVariant,
  NodeTheme,
} from "@/src/components/foundation/architectural-types";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { cx } from "@/src/lib/cx";

function DockChromeTooltip({
  content,
  side = "top",
  disabled,
  children,
}: {
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  disabled?: boolean;
  children: ReactElement;
}) {
  return (
    <ArchitecturalTooltip
      content={content}
      side={side}
      delayMs={400}
      disabled={disabled}
      avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
    >
      {children}
    </ArchitecturalTooltip>
  );
}

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
  if (nodeType === "character") return <User size={16} />;
  if (nodeType === "faction") return <UsersThree size={16} />;
  if (nodeType === "location") return <MapPin size={16} />;
  return <FileText size={16} />;
}

/**
 * In-document blocks (insert strip). Order follows common rich-text docks: list family
 * (bullet → numbered → task), then media/divider. Handled in `ArchitecturalCanvasApp` `runFormat`.
 */
export const DEFAULT_DOC_INSERT_ACTIONS: DockFormatAction[] = [
  { id: "quote", label: "Quote", command: "formatBlock", value: "blockquote" },
  { id: "list", label: "Bulleted list", command: "insertUnorderedList" },
  { id: "numberedList", label: "Numbered list", command: "insertOrderedList" },
  { id: "checklist", label: "Checklist", command: "arch:checklist" },
  { id: "insertImage", label: "Insert image", command: "arch:insertImage" },
  { id: "divider", label: "Divider", command: "insertHorizontalRule" },
];

/** Inline styles first, then block level (matches Word / Google Docs / CKEditor-style toolbars). */
export const DEFAULT_FORMAT_ACTIONS: DockFormatAction[] = [
  { id: "bold", label: "Bold", command: "bold" },
  { id: "italic", label: "Italic", command: "italic" },
  { id: "underline", label: "Underline", command: "underline" },
  { id: "strikeThrough", label: "Strikethrough", command: "strikeThrough" },
  { id: "heading", label: "Heading", command: "formatBlock", value: "h1" },
];

export const DEFAULT_CREATE_ACTIONS: DockCreateAction[] = [
  { id: "note", label: "Note", nodeType: "default" },
  { id: "task", label: "Task", nodeType: "task" },
  { id: "code", label: "Code", nodeType: "code" },
  { id: "media", label: "Media", nodeType: "media" },
  { id: "folder", label: "Folder", nodeType: "folder" },
  { id: "character", label: "Character", nodeType: "character" },
  {
    id: "faction",
    label: "Organization",
    nodeType: "faction",
    loreVariantSubmenu: ["v1", "v2", "v3"],
  },
  {
    id: "location",
    label: "Location",
    nodeType: "location",
    loreVariantSubmenu: ["v1", "v2", "v3"],
  },
];

/** Labels for faction/location v1–v3 (dock flyout, palette, canvas menu). */
export function loreVariantChoiceLabel(kind: LoreCardKind, v: LoreCardVariant): string {
  if (kind === "faction") {
    if (v === "v1") return "Letterhead";
    if (v === "v2") return "Monogram rail";
    return "Framed memo";
  }
  if (kind === "location") {
    if (v === "v1") return "Site plaque";
    if (v === "v2") return "Postcard band";
    return "Survey tag";
  }
  return v;
}

export type ConnectionDockMode = "move" | "draw" | "cut";
export type ConnectionToolbarProps = {
  mode: ConnectionDockMode;
  onSetMode: (next: ConnectionDockMode) => void;
  colorScheme: FolderColorSchemeId | null;
  onSetColorScheme: (next: FolderColorSchemeId | null) => void;
  disabled?: boolean;
  variant?: "canvas" | "editor";
};

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
                <DockChromeTooltip content={action.label}>
                  <ArchitecturalButton
                    size="icon"
                    tone={actionTone}
                    active={action.active}
                    iconOnly
                    aria-label={action.label}
                    disabled={action.disabled}
                    leadingIcon={formatIcon(action.command, action.value)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (action.disabled) return;
                      setHeadingMenuOpen((open) => !open);
                    }}
                  />
                </DockChromeTooltip>
                {headingMenuOpen ? (
                  <div className={styles.headingPickerMenu} role="menu" aria-label="Heading levels">
                    {headingOptions.map((opt) => (
                      <DockChromeTooltip key={opt.value} content={opt.label}>
                        <ArchitecturalButton
                          size="menu"
                          tone={actionTone}
                          active={activeBlockTag === opt.value}
                          aria-label={opt.label}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            onFormat("formatBlock", opt.value);
                            setHeadingMenuOpen(false);
                          }}
                        >
                          {opt.label}
                        </ArchitecturalButton>
                      </DockChromeTooltip>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }
          return (
            <DockChromeTooltip key={action.id} content={action.label}>
              <ArchitecturalButton
                size="icon"
                tone={actionTone}
                active={action.active}
                iconOnly
                aria-label={action.label}
                disabled={action.disabled}
                leadingIcon={formatIcon(action.command, action.value)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (action.disabled) return;
                  onFormat(action.command, action.value);
                }}
              />
            </DockChromeTooltip>
          );
        })}
      </div>
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
            className={`${styles.toolbarClusterSep} ${styles.toolbarClusterSepDock}`}
            aria-hidden
          />
          <div
            className={`${styles.formatToolbar} ${styles.dockInsertToolbar}`}
            role="toolbar"
            aria-label="Insert blocks"
          >
            {insertDocActions.map((action) => (
              <DockChromeTooltip key={action.id} content={action.label}>
                <ArchitecturalButton
                  size="icon"
                  tone={actionTone}
                  active={action.active}
                  iconOnly
                  aria-label={action.label}
                  disabled={action.disabled}
                  leadingIcon={formatIcon(action.command, action.value)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (action.disabled) return;
                    onFormat(action.command, action.value);
                  }}
                />
              </DockChromeTooltip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArchitecturalFolderColorStrip({
  value,
  onChange,
  variant = "canvas",
  appearance = "label",
  ariaLabel = "Folder inks",
  /** When false, flyout closes and the trigger is inert (e.g. thread spool only in draw mode). */
  engaged = true,
}: {
  value: FolderColorSchemeId | null;
  onChange: (next: FolderColorSchemeId | null) => void;
  variant?: "canvas" | "editor";
  appearance?: "label" | "spool";
  ariaLabel?: string;
  engaged?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuDirection, setMenuDirection] = useState<"up" | "down">("up");
  const [spoolMenuPos, setSpoolMenuPos] = useState<{ top: number; left: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isEditor = variant === "editor";
  const isSpool = appearance === "spool";
  const activeMeta = value ? FOLDER_COLOR_SCHEMES.find((s) => s.id === value) : null;

  useEffect(() => {
    if (!engaged) {
      // Collapse tint menu when the dock disengages (e.g. leaving editor/focus).
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync when `engaged` becomes false
      setMenuOpen(false);
    }
  }, [engaged]);

  useEffect(() => {
    if (!menuOpen) return;
    if (!isSpool) {
      const trigger = pickerRef.current;
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        const estimatedMenuHeight = 190;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldOpenDown =
          spaceBelow >= estimatedMenuHeight || (spaceBelow > 110 && spaceAbove < estimatedMenuHeight);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- flip menu from viewport measurement after open
        setMenuDirection(shouldOpenDown ? "down" : "up");
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      const t = event.target as Node | null;
      if (!t) {
        setMenuOpen(false);
        return;
      }
      if (pickerRef.current?.contains(t)) return;
      if (isSpool && menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen, isSpool]);

  useLayoutEffect(() => {
    if (!menuOpen || !isSpool) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear fixed position when spool menu closes
      setSpoolMenuPos(null);
      return;
    }
    const position = () => {
      const trig = triggerRef.current;
      const menuEl = menuRef.current;
      if (!trig || !menuEl) return;
      const tr = trig.getBoundingClientRect();
      const gap = 10;
      const mw = menuEl.offsetWidth;
      const mh = menuEl.offsetHeight;
      if (mw < 1 || mh < 1) return;
      let left = tr.left - gap - mw;
      let top = tr.top + tr.height / 2 - mh / 2;
      const pad = 8;
      left = Math.max(pad, Math.min(left, window.innerWidth - mw - pad));
      top = Math.max(pad, Math.min(top, window.innerHeight - mh - pad));
      setSpoolMenuPos({ left, top });
    };
    position();
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [menuOpen, isSpool]);

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

  const swatchGrid = (
    <div className={styles.dockFolderTintSwatchGrid}>
      <DockChromeTooltip content="Black mirror">
        <Button
          type="button"
          variant="ghost"
          tone="glass"
          iconOnly
          role="option"
          aria-selected={value == null}
          aria-label="Black mirror — unmarked folder"
          className={cx(
            styles.dockFolderTintMenuSwatch,
            styles.dockFolderTintMenuSwatchClassic,
            value == null && styles.dockFolderTintMenuSwatchSelected,
          )}
          onClick={() => pick(null)}
        />
      </DockChromeTooltip>
      {FOLDER_COLOR_SCHEMES.map((s) => (
        <DockChromeTooltip key={s.id} content={s.label}>
          <Button
            type="button"
            variant="ghost"
            tone="glass"
            iconOnly
            role="option"
            aria-selected={value === s.id}
            aria-label={s.label}
            className={cx(
              styles.dockFolderTintMenuSwatch,
              (s.id === "white" || s.id === "gray" || s.id === "parchment") &&
                styles.dockFolderTintMenuSwatchHighKey,
              value === s.id && styles.dockFolderTintMenuSwatchSelected,
            )}
            style={{ background: s.swatch }}
            onClick={() => pick(s.id)}
          />
        </DockChromeTooltip>
      ))}
    </div>
  );

  const spoolMenuPortal =
    menuOpen && isSpool && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className={cx(
              styles.dockFolderTintMenu,
              styles.dockFolderTintMenuSpoolFixed,
              isEditor && styles.dockFolderTintMenuEditor,
            )}
            role="listbox"
            aria-label={ariaLabel}
            style={
              spoolMenuPos
                ? { top: spoolMenuPos.top, left: spoolMenuPos.left, opacity: 1 }
                : { top: 0, left: 0, opacity: 0, pointerEvents: "none" as const }
            }
          >
            {swatchGrid}
          </div>,
          getVigilPortalRoot(),
        )
      : null;

  return (
    <div
      ref={pickerRef}
      className={styles.dockFolderTintPicker}
      role="group"
      aria-label={ariaLabel}
      aria-hidden={engaged ? undefined : true}
    >
      <DockChromeTooltip content={ariaLabel} disabled={menuOpen}>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          tone="glass"
          className={cx(
            styles.dockFolderTintTrigger,
            isSpool && styles.dockFolderTintTriggerSpool,
            isEditor && styles.dockFolderTintTriggerEditor,
            menuOpen && styles.dockFolderTintTriggerOpen,
          )}
          aria-haspopup="listbox"
          aria-expanded={engaged ? menuOpen : false}
          aria-label={ariaLabel}
          disabled={!engaged}
          tabIndex={engaged ? undefined : -1}
          onClick={() => engaged && setMenuOpen((open) => !open)}
        >
          <span
            className={cx(
              styles.dockFolderTintPreview,
              isSpool && styles.dockFolderTintPreviewSpool,
              activeMeta == null ? styles.dockFolderTintPreviewClassic : null,
            )}
            style={activeMeta ? { background: activeMeta.swatch } : undefined}
            aria-hidden
          />
          {!isSpool ? <span className={styles.dockFolderTintTriggerText}>Tint</span> : null}
          {!isSpool ? (
            <CaretDown
              size={11}
              weight="bold"
              className={styles.dockFolderTintCaret}
              aria-hidden
            />
          ) : null}
        </Button>
      </DockChromeTooltip>
      {menuOpen && !isSpool ? (
        <div
          className={cx(
            styles.dockFolderTintMenu,
            menuDirection === "down" && styles.dockFolderTintMenuDown,
            isEditor && styles.dockFolderTintMenuEditor,
          )}
          role="listbox"
          aria-label={ariaLabel}
        >
          {swatchGrid}
        </div>
      ) : null}
      {spoolMenuPortal}
    </div>
  );
}

export function ArchitecturalCreateMenu({
  actions,
  actionTone = "menu",
  disabled = false,
  disabledReason = null,
  onCreateNode,
}: {
  actions: DockCreateAction[];
  /** `card-dark` for solid black editor dock. */
  actionTone?: Extract<ArchitecturalButtonTone, "menu" | "card-dark">;
  disabled?: boolean;
  /** Shown in tooltips and aria when `disabled` is true. */
  disabledReason?: string | null;
  onCreateNode: (type: NodeTheme, loreVariant?: LoreCardVariant) => void;
}) {
  const [openLoreVariantMenuId, setOpenLoreVariantMenuId] = useState<string | null>(null);
  const loreVariantPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openLoreVariantMenuId) return;
    const onPointerDown = (event: PointerEvent) => {
      const t = event.target as Node | null;
      if (!t || loreVariantPickerRef.current?.contains(t)) return;
      setOpenLoreVariantMenuId(null);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [openLoreVariantMenuId]);

  const toolbarAria =
    disabled && disabledReason?.trim()
      ? `Create items — ${disabledReason.trim()}`
      : "Create items";
  return (
    <div
      className={`${styles.addMenu} ${styles.dockCreateToolbar}`}
      role="toolbar"
      aria-label={toolbarAria}
    >
      {actions.map((action) => {
        const submenu = action.loreVariantSubmenu;
        const hasLoreVariants =
          Array.isArray(submenu) &&
          submenu.length > 0 &&
          (action.nodeType === "faction" || action.nodeType === "location");

        if (hasLoreVariants && submenu) {
          const kind = action.nodeType as LoreCardKind;
          const open = openLoreVariantMenuId === action.id;
          const tooltip =
            disabled && disabledReason?.trim()
              ? `${action.label} — ${disabledReason.trim()}`
              : `${action.label} — choose layout`;
          return (
            <div
              key={action.id}
              className={styles.headingPicker}
              ref={open ? loreVariantPickerRef : undefined}
            >
              <DockChromeTooltip content={tooltip}>
                <ArchitecturalButton
                  size="icon"
                  tone={actionTone}
                  iconOnly
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-label={
                    disabled && disabledReason?.trim()
                      ? `Create ${action.label}: ${disabledReason.trim()}`
                      : `Create ${action.label}, choose layout`
                  }
                  disabled={disabled}
                  leadingIcon={createIcon(action.nodeType)}
                  onClick={() => {
                    if (disabled) return;
                    setOpenLoreVariantMenuId((id) => (id === action.id ? null : action.id));
                  }}
                />
              </DockChromeTooltip>
              {open ? (
                <div
                  className={styles.headingPickerMenu}
                  role="menu"
                  aria-label={`${action.label} layouts`}
                >
                  {submenu.map((v) => (
                    <DockChromeTooltip key={v} content={loreVariantChoiceLabel(kind, v)}>
                      <ArchitecturalButton
                        size="menu"
                        tone={actionTone}
                        role="menuitem"
                        aria-label={`Create ${action.label}: ${loreVariantChoiceLabel(kind, v)}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (disabled) return;
                          onCreateNode(kind, v);
                          setOpenLoreVariantMenuId(null);
                        }}
                      >
                        {loreVariantChoiceLabel(kind, v)}
                      </ArchitecturalButton>
                    </DockChromeTooltip>
                  ))}
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <DockChromeTooltip
            key={action.id}
            content={
              disabled && disabledReason?.trim()
                ? `${action.label} — ${disabledReason.trim()}`
                : action.label
            }
          >
            <ArchitecturalButton
              size="icon"
              tone={actionTone}
              iconOnly
              aria-label={
                disabled && disabledReason?.trim()
                  ? `Create ${action.label}: ${disabledReason.trim()}`
                  : `Create ${action.label}`
              }
              disabled={disabled}
              leadingIcon={createIcon(action.nodeType)}
              onClick={() => onCreateNode(action.nodeType)}
            />
          </DockChromeTooltip>
        );
      })}
    </div>
  );
}

export function ArchitecturalConnectionToolbar({
  mode,
  onSetMode,
  colorScheme,
  onSetColorScheme,
  disabled = false,
  variant = "canvas",
}: ConnectionToolbarProps) {
  const isEditor = variant === "editor";
  const tone = isEditor ? "card-dark" : "glass";
  return (
    <div className={styles.connectionToolbarWrap}>
      <div className={styles.connectionModeStrip} role="toolbar" aria-label="Threads">
        <ArchitecturalTooltip
          content="Move — select and pan cards. Canvas threads stay inactive until you choose Draw."
          side="top"
          delayMs={420}
          avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
        >
          <ArchitecturalButton
            size="menu"
            tone={tone}
            active={mode === "move"}
            disabled={disabled}
            aria-label="Move"
            onClick={() => onSetMode("move")}
          >
            Move
          </ArchitecturalButton>
        </ArchitecturalTooltip>
        <ArchitecturalTooltip
          content="Draw thread — click two cards to connect. Right-click a thread to tag the relationship. Wiki mentions in prose are separate."
          side="top"
          delayMs={420}
          avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
        >
          <ArchitecturalButton
            size="menu"
            tone={tone}
            active={mode === "draw"}
            disabled={disabled}
            aria-label="Draw thread"
            onClick={() => onSetMode("draw")}
          >
            Draw
          </ArchitecturalButton>
        </ArchitecturalTooltip>
        <ArchitecturalTooltip
          content="Cut thread — click ropes to remove them."
          side="top"
          delayMs={420}
          avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
        >
          <ArchitecturalButton
            size="menu"
            tone={tone}
            active={mode === "cut"}
            disabled={disabled}
            aria-label="Cut thread"
            onClick={() => onSetMode("cut")}
          >
            Cut
          </ArchitecturalButton>
        </ArchitecturalTooltip>
      </div>
      <ArchitecturalFolderColorStrip
        value={colorScheme}
        onChange={onSetColorScheme}
        variant={isEditor ? "editor" : "canvas"}
      />
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
  createDisabledReason = null,
  activeBlockTag = "p",
  showCreateMenu = true,
  folderColorPicker = null,
  connectionColorPicker = null,
  selectionDelete,
  selectionStack,
}: {
  /** `editor`: solid black panels + light icon controls (focus mode only). */
  variant?: ArchitecturalBottomDockVariant;
  onFormat: (command: string, value?: string) => void;
  onCreateNode: (type: NodeTheme, loreVariant?: LoreCardVariant) => void;
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
  createDisabledReason?: string | null;
  activeBlockTag?: "p" | "h1" | "h2" | "h3" | "blockquote";
  showCreateMenu?: boolean;
  /** Shown when a single folder is selected on the canvas. */
  folderColorPicker?: {
    value: FolderColorSchemeId | null;
    onChange: (next: FolderColorSchemeId | null) => void;
  } | null;
  /** Global connection tint picker for pin strings. */
  connectionColorPicker?: {
    value: FolderColorSchemeId | null;
    onChange: (next: FolderColorSchemeId | null) => void;
  } | null;
  /**
   * Canvas-only: own dock cluster next to history. Omit on editor dock.
   * Keep mounted with `selectedCount: 0` so open panels after it don’t jump; slot collapses to 0 width.
   */
  selectionDelete?: {
    selectedCount: number;
    onDelete: () => void;
  };
  /**
   * Merge stacks / create stack + unstack wholly selected stacks. Omit on editor dock.
   * Keep mounted with both flags false so the strip doesn’t reflow.
   */
  selectionStack?: {
    canMerge: boolean;
    onMerge: () => void;
    mergeTitle: string;
    canUnstack: boolean;
    onUnstack: () => void;
    unstackTitle: string;
  };
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
              disabledReason={createDisabledReason}
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
                    <DockChromeTooltip content={undoLabel}>
                      <ArchitecturalButton
                        size="icon"
                        tone={historyActionTone}
                        iconOnly
                        aria-label={undoLabel}
                        disabled={!canUndo}
                        leadingIcon={<ArrowCounterClockwise size={18} />}
                        onClick={() => onUndo()}
                      />
                    </DockChromeTooltip>
                    <DockChromeTooltip content={redoLabel}>
                      <ArchitecturalButton
                        size="icon"
                        tone={historyActionTone}
                        iconOnly
                        aria-label={redoLabel}
                        disabled={!canRedo}
                        leadingIcon={<ArrowClockwise size={18} />}
                        onClick={() => onRedo()}
                      />
                    </DockChromeTooltip>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {selectionDelete ? (
          <div
            className={cx(
              styles.rootDockPanelSlot,
              selectionDelete.selectedCount > 0 && styles.rootDockPanelSlotOpen,
            )}
          >
            <div className={styles.rootDockPanelSlotInner}>
              <div
                className={styles.rootDockPanel}
                inert={selectionDelete.selectedCount > 0 ? undefined : true}
              >
                <div
                  className={cx(styles.addMenu, styles.dockSelectionDeleteToolbar)}
                  role="toolbar"
                  aria-label="Selection"
                  aria-hidden={selectionDelete.selectedCount > 0 ? undefined : true}
                >
                  {selectionDelete.selectedCount > 0 ? (
                    <DockChromeTooltip
                      content={
                        selectionDelete.selectedCount === 1
                          ? "Delete"
                          : `Delete ${selectionDelete.selectedCount} items`
                      }
                    >
                      <ArchitecturalButton
                        size="icon"
                        tone={historyActionTone}
                        iconOnly
                        aria-label={
                          selectionDelete.selectedCount === 1
                            ? "Delete selected item"
                            : `Delete ${selectionDelete.selectedCount} selected items`
                        }
                        leadingIcon={<Trash size={18} />}
                        onClick={() => selectionDelete.onDelete()}
                      />
                    </DockChromeTooltip>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {selectionStack ? (
          <div
            className={cx(
              styles.rootDockPanelSlot,
              (selectionStack.canMerge || selectionStack.canUnstack) &&
                styles.rootDockPanelSlotOpen,
            )}
            data-hg-dock="stack-strip"
          >
            <div className={styles.rootDockPanelSlotInner}>
              <div
                className={styles.rootDockPanel}
                inert={
                  selectionStack.canMerge || selectionStack.canUnstack ? undefined : true
                }
              >
                <div
                  className={cx(styles.addMenu, styles.dockStackToolbar)}
                  role="toolbar"
                  aria-label="Stacks"
                  aria-hidden={
                    selectionStack.canMerge || selectionStack.canUnstack ? undefined : true
                  }
                >
                  {selectionStack.canMerge ? (
                    <DockChromeTooltip content={selectionStack.mergeTitle}>
                      <ArchitecturalButton
                        size="icon"
                        tone={historyActionTone}
                        iconOnly
                        aria-label={selectionStack.mergeTitle}
                        leadingIcon={<Stack size={18} weight="bold" aria-hidden />}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (e.button !== 0) return;
                          selectionStack.onMerge();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectionStack.onMerge();
                          }
                        }}
                      />
                    </DockChromeTooltip>
                  ) : null}
                  {selectionStack.canUnstack ? (
                    <DockChromeTooltip content={selectionStack.unstackTitle}>
                      <ArchitecturalButton
                        size="icon"
                        tone={historyActionTone}
                        iconOnly
                        aria-label={selectionStack.unstackTitle}
                        leadingIcon={<ArrowsOut size={18} weight="bold" aria-hidden />}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (e.button !== 0) return;
                          selectionStack.onUnstack();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectionStack.onUnstack();
                          }
                        }}
                      />
                    </DockChromeTooltip>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {folderColorPicker ? (
          <div
            className={cx(styles.rootDockPanelSlot, styles.rootDockPanelSlotOpen)}
            data-hg-dock="tint-strip"
          >
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
        {connectionColorPicker ? (
          <div
            className={cx(styles.rootDockPanelSlot, styles.rootDockPanelSlotOpen)}
            data-hg-dock="tint-strip"
          >
            <div className={styles.rootDockPanelSlotInner}>
              <div className={styles.rootDockPanel}>
                <ArchitecturalFolderColorStrip
                  value={connectionColorPicker.value}
                  onChange={connectionColorPicker.onChange}
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
          data-hg-dock="format-strip"
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
