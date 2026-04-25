"use client";

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsOut,
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
import type { ReactElement, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  ArchitecturalButton,
  type ArchitecturalButtonTone,
} from "@/src/components/foundation/ArchitecturalButton";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import {
  ARCH_TOOLTIP_AVOID_BOTTOM,
  ArchitecturalTooltip,
} from "@/src/components/foundation/ArchitecturalTooltip";
import {
  FOLDER_COLOR_BLACK_MIRROR_HINT,
  FOLDER_COLOR_SCHEMES,
  type FolderColorSchemeId,
  type FolderColorSchemeMeta,
} from "@/src/components/foundation/architectural-folder-schemes";
import type {
  ArchitecturalBottomDockVariant,
  DockCreateAction,
  DockFormatAction,
  LoreCardKind,
  LoreCardVariant,
  NodeTheme,
} from "@/src/components/foundation/architectural-types";
import { Button } from "@/src/components/ui/Button";
import {
  CONNECTION_KINDS,
  type ConnectionKind,
  connectionKindMeta,
} from "@/src/lib/connection-kind-colors";
import { cx } from "@/src/lib/cx";
import { useDevPinnedPopovers } from "@/src/lib/dev-pin-popovers";
import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";

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
      avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
      content={content}
      delayMs={400}
      disabled={disabled}
      side={side}
    >
      {children}
    </ArchitecturalTooltip>
  );
}

function formatIcon(command: string, value?: string): ReactNode {
  if (command === "arch:checklist") {
    return <CheckSquare size={18} />;
  }
  if (command === "arch:insertImage") {
    return <ImageIcon size={18} />;
  }
  if (command === "insertHorizontalRule") {
    return <Minus size={18} />;
  }
  if (command === "formatBlock" && value === "blockquote") {
    return <Quotes size={18} />;
  }
  if (command === "bold") {
    return <TextB size={18} />;
  }
  if (command === "italic") {
    return <TextItalic size={18} />;
  }
  if (command === "underline") {
    return <TextUnderline size={18} />;
  }
  if (command === "strikeThrough") {
    return <TextStrikethrough size={18} />;
  }
  if (command === "insertUnorderedList") {
    return <ListBullets size={18} />;
  }
  if (command === "insertOrderedList") {
    return <ListNumbers size={18} />;
  }
  if (command === "formatBlock") {
    return <TextH size={18} />;
  }
  return <TextB size={18} />;
}

function createIcon(nodeType: NodeTheme): ReactNode {
  if (nodeType === "folder") {
    return <FolderPlus size={16} />;
  }
  if (nodeType === "task") {
    return <CheckSquare size={16} />;
  }
  if (nodeType === "code") {
    return <Code size={16} />;
  }
  if (nodeType === "media") {
    return <ImageIcon size={16} />;
  }
  if (nodeType === "character") {
    return <User size={16} />;
  }
  if (nodeType === "faction") {
    return <UsersThree size={16} />;
  }
  if (nodeType === "location") {
    return <MapPin size={16} />;
  }
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
  { id: "media", label: "Media", nodeType: "media" },
  { id: "folder", label: "Folder", nodeType: "folder" },
  { id: "character", label: "Character", nodeType: "character" },
  { id: "faction", label: "Organization", nodeType: "faction" },
  { id: "location", label: "Location", nodeType: "location" },
];

/** Labels for lore layout variants (palette hints, import UI, etc.). */
export function loreVariantChoiceLabel(
  kind: LoreCardKind,
  v: LoreCardVariant
): string {
  if (kind === "character") {
    return "Character coverage card";
  }
  if (kind === "faction") {
    if (v === "v1" || v === "v2" || v === "v3") {
      return "Organization coverage card (legacy)";
    }
    return "Organization coverage card";
  }
  if (kind === "location") {
    if (v === "v2" || v === "v3") {
      return "Location coverage card (legacy)";
    }
    return "Location coverage card";
  }
  return "Coverage card";
}

export type ConnectionDockMode = "move" | "draw" | "cut";
export interface ConnectionToolbarProps {
  connectionKind: ConnectionKind;
  disabled?: boolean;
  mode: ConnectionDockMode;
  onSetConnectionKind: (next: ConnectionKind) => void;
  onSetMode: (next: ConnectionDockMode) => void;
  variant?: "canvas" | "editor";
}

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
    if (!headingMenuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const t = event.target as Node | null;
      if (!(t && headingPickerRef.current?.contains(t))) {
        setHeadingMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [headingMenuOpen]);

  return (
    <div className={styles.formatToolbarWrap}>
      <div
        aria-label="Text formatting"
        className={`${styles.formatToolbar} ${styles.dockFormatToolbar}`}
        role="toolbar"
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
              <div
                className={styles.headingPicker}
                key={action.id}
                ref={headingPickerRef}
              >
                <DockChromeTooltip content={action.label}>
                  <ArchitecturalButton
                    active={action.active}
                    aria-label={action.label}
                    disabled={action.disabled}
                    iconOnly
                    leadingIcon={formatIcon(action.command, action.value)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (action.disabled) {
                        return;
                      }
                      setHeadingMenuOpen((open) => !open);
                    }}
                    size="icon"
                    tone={actionTone}
                  />
                </DockChromeTooltip>
                {headingMenuOpen ? (
                  <div
                    aria-label="Heading levels"
                    className={styles.headingPickerMenu}
                    role="menu"
                  >
                    {headingOptions.map((opt) => (
                      <DockChromeTooltip content={opt.label} key={opt.value}>
                        <ArchitecturalButton
                          active={activeBlockTag === opt.value}
                          aria-label={opt.label}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            onFormat("formatBlock", opt.value);
                            setHeadingMenuOpen(false);
                          }}
                          size="menu"
                          tone={actionTone}
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
            <DockChromeTooltip content={action.label} key={action.id}>
              <ArchitecturalButton
                active={action.active}
                aria-label={action.label}
                disabled={action.disabled}
                iconOnly
                leadingIcon={formatIcon(action.command, action.value)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (action.disabled) {
                    return;
                  }
                  onFormat(action.command, action.value);
                }}
                size="icon"
                tone={actionTone}
              />
            </DockChromeTooltip>
          );
        })}
      </div>
      <div
        className={cx(
          styles.formatToolbarInsertSlot,
          showDocInsertCluster && styles.formatToolbarInsertSlotOpen
        )}
      >
        <div
          className={styles.formatToolbarInsertSlotInner}
          inert={showDocInsertCluster ? undefined : true}
        >
          <div
            aria-hidden
            className={`${styles.toolbarClusterSep} ${styles.toolbarClusterSepDock}`}
          />
          <div
            aria-label="Insert blocks"
            className={`${styles.formatToolbar} ${styles.dockInsertToolbar}`}
            role="toolbar"
          >
            {insertDocActions.map((action) => (
              <DockChromeTooltip content={action.label} key={action.id}>
                <ArchitecturalButton
                  active={action.active}
                  aria-label={action.label}
                  disabled={action.disabled}
                  iconOnly
                  leadingIcon={formatIcon(action.command, action.value)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (action.disabled) {
                      return;
                    }
                    onFormat(action.command, action.value);
                  }}
                  size="icon"
                  tone={actionTone}
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
  /** Folder card tints vs thread ink — threads get the catalog popover and richer tooltips. */
  context: contextProp,
  ariaLabel = "Folder inks",
  /** When false, flyout closes and the trigger is inert (e.g. thread spool only in draw mode). */
  engaged = true,
}: {
  value: FolderColorSchemeId | null;
  onChange: (next: FolderColorSchemeId | null) => void;
  variant?: "canvas" | "editor";
  appearance?: "label" | "spool";
  context?: "folder" | "thread";
  ariaLabel?: string;
  engaged?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuDirection, setMenuDirection] = useState<"up" | "down">("up");
  const [spoolMenuPos, setSpoolMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isEditor = variant === "editor";
  const isSpool = appearance === "spool";
  const context = contextProp ?? (isSpool ? "thread" : "folder");
  const threadCatalog = context === "thread";
  const activeMeta = value
    ? FOLDER_COLOR_SCHEMES.find((s) => s.id === value)
    : null;

  useEffect(() => {
    if (!engaged) {
      // Collapse tint menu when the dock disengages (e.g. leaving editor/focus).
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync when `engaged` becomes false
      setMenuOpen(false);
    }
  }, [engaged]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    if (!isSpool) {
      const trigger = pickerRef.current;
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        const estimatedMenuHeight = threadCatalog ? 460 : 190;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldOpenDown =
          spaceBelow >= estimatedMenuHeight ||
          (spaceBelow > 110 && spaceAbove < estimatedMenuHeight);
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
      if (pickerRef.current?.contains(t)) {
        return;
      }
      if (isSpool && menuRef.current?.contains(t)) {
        return;
      }
      setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen, isSpool, threadCatalog]);

  useLayoutEffect(() => {
    if (!(menuOpen && isSpool)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear fixed position when spool menu closes
      setSpoolMenuPos(null);
      return;
    }
    const position = () => {
      const trig = triggerRef.current;
      const menuEl = menuRef.current;
      if (!(trig && menuEl)) {
        return;
      }
      const tr = trig.getBoundingClientRect();
      const gap = 10;
      const mw = menuEl.offsetWidth;
      const mh = menuEl.offsetHeight;
      if (mw < 1 || mh < 1) {
        return;
      }
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
    if (!menuOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const pick = (next: FolderColorSchemeId | null) => {
    onChange(next);
    setMenuOpen(false);
  };

  const tooltipScheme = (s: FolderColorSchemeMeta) => (
    <span className={styles.dockFolderTintTooltipStack}>
      <span className={styles.dockFolderTintTooltipName}>{s.label}</span>
      <span className={styles.dockFolderTintTooltipMeta}>{s.usageHint}</span>
    </span>
  );

  const tooltipBlackMirror = (
    <span className={styles.dockFolderTintTooltipStack}>
      <span className={styles.dockFolderTintTooltipName}>Black mirror</span>
      <span className={styles.dockFolderTintTooltipMeta}>
        {FOLDER_COLOR_BLACK_MIRROR_HINT}
      </span>
    </span>
  );

  const swatchGrid = (
    <div className={styles.dockFolderTintSwatchGrid}>
      <DockChromeTooltip content={tooltipBlackMirror}>
        <Button
          aria-label={`Black mirror. ${FOLDER_COLOR_BLACK_MIRROR_HINT}`}
          aria-selected={value == null}
          className={cx(
            styles.dockFolderTintMenuSwatch,
            styles.dockFolderTintMenuSwatchClassic,
            value == null && styles.dockFolderTintMenuSwatchSelected
          )}
          iconOnly
          onClick={() => pick(null)}
          role="option"
          tone="glass"
          type="button"
          variant="ghost"
        />
      </DockChromeTooltip>
      {FOLDER_COLOR_SCHEMES.map((s) => (
        <DockChromeTooltip content={tooltipScheme(s)} key={s.id}>
          <Button
            aria-label={`${s.label}. ${s.usageHint}`}
            aria-selected={value === s.id}
            className={cx(
              styles.dockFolderTintMenuSwatch,
              (s.id === "white" || s.id === "gray" || s.id === "parchment") &&
                styles.dockFolderTintMenuSwatchHighKey,
              value === s.id && styles.dockFolderTintMenuSwatchSelected
            )}
            iconOnly
            onClick={() => pick(s.id)}
            role="option"
            style={{ background: s.swatch }}
            tone="glass"
            type="button"
            variant="ghost"
          />
        </DockChromeTooltip>
      ))}
    </div>
  );

  const threadInkCatalog = (
    <div className={styles.dockFolderTintCatalog}>
      <header className={styles.dockFolderTintCatalogHeader}>
        <div className={styles.dockFolderTintCatalogTitle}>Thread ink</div>
        <p className={styles.dockFolderTintCatalogSubtitle}>
          Applies to the next threads you draw. Same hues as folder tints — use
          them consistently to read relationship kinds at a glance.
        </p>
      </header>
      <div
        aria-label={ariaLabel}
        className={styles.dockFolderTintCatalogList}
        role="listbox"
      >
        <Button
          aria-label={`Black mirror. ${FOLDER_COLOR_BLACK_MIRROR_HINT}`}
          aria-selected={value == null}
          className={cx(
            styles.dockFolderTintCatalogRow,
            value == null && styles.dockFolderTintCatalogRowSelected
          )}
          onClick={() => pick(null)}
          role="option"
          tone="glass"
          type="button"
          variant="ghost"
        >
          <span
            aria-hidden
            className={cx(
              styles.dockFolderTintCatalogSwatch,
              styles.dockFolderTintMenuSwatchClassic
            )}
          />
          <span className={styles.dockFolderTintCatalogText}>
            <span className={styles.dockFolderTintCatalogName}>
              Black mirror
            </span>
            <span className={styles.dockFolderTintCatalogHint}>
              {FOLDER_COLOR_BLACK_MIRROR_HINT}
            </span>
          </span>
        </Button>
        {FOLDER_COLOR_SCHEMES.map((s) => (
          <Button
            aria-label={`${s.label}. ${s.usageHint}`}
            aria-selected={value === s.id}
            className={cx(
              styles.dockFolderTintCatalogRow,
              value === s.id && styles.dockFolderTintCatalogRowSelected
            )}
            key={s.id}
            onClick={() => pick(s.id)}
            role="option"
            tone="glass"
            type="button"
            variant="ghost"
          >
            <span
              aria-hidden
              className={cx(
                styles.dockFolderTintCatalogSwatch,
                (s.id === "white" || s.id === "gray" || s.id === "parchment") &&
                  styles.dockFolderTintCatalogSwatchHighKey
              )}
              style={{ background: s.swatch }}
            />
            <span className={styles.dockFolderTintCatalogText}>
              <span className={styles.dockFolderTintCatalogName}>
                {s.label}
              </span>
              <span className={styles.dockFolderTintCatalogHint}>
                {s.usageHint}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </div>
  );

  const menuBody = threadCatalog ? threadInkCatalog : swatchGrid;

  const spoolMenuPortal =
    menuOpen && isSpool && typeof document !== "undefined"
      ? createPortal(
          <div
            aria-label={threadCatalog ? undefined : ariaLabel}
            className={cx(
              styles.dockFolderTintMenu,
              styles.dockFolderTintMenuSpoolFixed,
              threadCatalog && styles.dockFolderTintMenuThreadCatalog,
              isEditor && styles.dockFolderTintMenuEditor
            )}
            ref={menuRef}
            role={threadCatalog ? "presentation" : "listbox"}
            style={
              spoolMenuPos
                ? { top: spoolMenuPos.top, left: spoolMenuPos.left, opacity: 1 }
                : {
                    top: 0,
                    left: 0,
                    opacity: 0,
                    pointerEvents: "none" as const,
                  }
            }
          >
            {menuBody}
          </div>,
          getVigilPortalRoot()
        )
      : null;

  return (
    <div
      aria-hidden={engaged ? undefined : true}
      aria-label={ariaLabel}
      className={styles.dockFolderTintPicker}
      ref={pickerRef}
      role="group"
    >
      <DockChromeTooltip content={ariaLabel} disabled={menuOpen}>
        <Button
          aria-expanded={engaged ? menuOpen : false}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          className={cx(
            styles.dockFolderTintTrigger,
            isSpool && styles.dockFolderTintTriggerSpool,
            isEditor && styles.dockFolderTintTriggerEditor,
            menuOpen && styles.dockFolderTintTriggerOpen
          )}
          disabled={!engaged}
          onClick={() => engaged && setMenuOpen((open) => !open)}
          ref={triggerRef}
          tabIndex={engaged ? undefined : -1}
          tone="glass"
          type="button"
          variant="ghost"
        >
          <span
            aria-hidden
            className={cx(
              styles.dockFolderTintPreview,
              isSpool && styles.dockFolderTintPreviewSpool,
              activeMeta == null ? styles.dockFolderTintPreviewClassic : null
            )}
            style={activeMeta ? { background: activeMeta.swatch } : undefined}
          />
          {isSpool ? null : (
            <span className={styles.dockFolderTintTriggerText}>Tint</span>
          )}
          {isSpool ? null : (
            <CaretDown
              aria-hidden
              className={styles.dockFolderTintCaret}
              size={11}
              weight="bold"
            />
          )}
        </Button>
      </DockChromeTooltip>
      {menuOpen && !isSpool ? (
        <div
          aria-label={threadCatalog ? undefined : ariaLabel}
          className={cx(
            styles.dockFolderTintMenu,
            menuDirection === "down" && styles.dockFolderTintMenuDown,
            threadCatalog && styles.dockFolderTintMenuThreadCatalog,
            isEditor && styles.dockFolderTintMenuEditor
          )}
          role={threadCatalog ? "presentation" : "listbox"}
        >
          {menuBody}
        </div>
      ) : null}
      {spoolMenuPortal}
    </div>
  );
}

/**
 * Canvas thread color picker. The picker operates on **connection kinds**
 * (`pin`, `bond`, `affiliation`, …) — color is a visual consequence of the
 * kind, not a free choice. See `src/lib/connection-kind-colors.ts` for the
 * canonical kind<->color<->link_type mapping and `docs/RELATIONSHIP_VOCABULARY.md`.
 *
 * `label` appearance: used inside the bottom dock and the top-right connection
 * toolbar (swatch + short text + caret). `spool` appearance: used on the right
 * side-tools rail as a small thread-spool button (swatch only, popover portaled
 * to `#hg-portal-root` so it doesn't clip to the rail).
 */
export function ArchitecturalConnectionKindPicker({
  value,
  onChange,
  variant = "canvas",
  appearance = "label",
  ariaLabel = "Connection thread kind",
  /** When false, flyout closes and the trigger is inert (e.g. not in Draw mode). */
  engaged = true,
}: {
  value: ConnectionKind;
  onChange: (next: ConnectionKind) => void;
  variant?: "canvas" | "editor";
  appearance?: "label" | "spool";
  ariaLabel?: string;
  engaged?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuDirection, setMenuDirection] = useState<"up" | "down">("up");
  const [spoolMenuPos, setSpoolMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isEditor = variant === "editor";
  const isSpool = appearance === "spool";
  const activeMeta = connectionKindMeta(value);
  // Dev-only: when ON, suppress outside-click + Escape dismissal so the
  // popover can be inspected in DevTools. Toggle with Alt+Shift+P. Always
  // `false` in production. See `src/lib/dev-pin-popovers.ts`.
  const pinnedForDev = useDevPinnedPopovers();

  useEffect(() => {
    if (!engaged) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- collapse on disengage
      setMenuOpen(false);
    }
  }, [engaged]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    if (!isSpool) {
      const trigger = pickerRef.current;
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        const estimatedMenuHeight = 360;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldOpenDown =
          spaceBelow >= estimatedMenuHeight ||
          (spaceBelow > 110 && spaceAbove < estimatedMenuHeight);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- post-open measurement
        setMenuDirection(shouldOpenDown ? "down" : "up");
      }
    }
    if (pinnedForDev) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const t = event.target as Node | null;
      if (!t) {
        setMenuOpen(false);
        return;
      }
      if (pickerRef.current?.contains(t)) {
        return;
      }
      if (isSpool && menuRef.current?.contains(t)) {
        return;
      }
      setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen, isSpool, pinnedForDev]);

  useLayoutEffect(() => {
    if (!(menuOpen && isSpool)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on close
      setSpoolMenuPos(null);
      return;
    }
    const position = () => {
      const trig = triggerRef.current;
      const menuEl = menuRef.current;
      if (!(trig && menuEl)) {
        return;
      }
      const tr = trig.getBoundingClientRect();
      const gap = 10;
      const mw = menuEl.offsetWidth;
      const mh = menuEl.offsetHeight;
      if (mw < 1 || mh < 1) {
        return;
      }
      // Open to the LEFT of the side-tools rail (same convention as thread spool).
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
    if (!menuOpen || pinnedForDev) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, pinnedForDev]);

  const pick = (next: ConnectionKind) => {
    onChange(next);
    setMenuOpen(false);
  };

  const menuBody = (
    <div
      aria-label={ariaLabel}
      className={styles.connectionKindList}
      role="listbox"
    >
      {CONNECTION_KINDS.map((meta) => {
        const selected = meta.kind === value;
        // Light / mid-neutral fills need a rim so they don't disappear
        // on the dark popover (same rule as folder-tint swatches).
        const isHighKey = meta.scheme === "gray" || meta.scheme === "parchment";
        return (
          <Button
            aria-label={`${meta.label}. ${meta.hint}`}
            aria-selected={selected}
            className={cx(
              styles.connectionKindRow,
              selected && styles.connectionKindRowSelected
            )}
            key={meta.kind}
            onClick={() => pick(meta.kind)}
            role="option"
            tone="glass"
            type="button"
            variant="ghost"
          >
            <span
              aria-hidden
              className={cx(
                styles.connectionKindRowSwatch,
                isHighKey && styles.connectionKindRowSwatchHighKey
              )}
              style={{ background: meta.swatch }}
            />
            <span className={styles.connectionKindRowLabel}>{meta.label}</span>
          </Button>
        );
      })}
    </div>
  );

  const spoolMenuPortal =
    menuOpen && isSpool && typeof document !== "undefined"
      ? createPortal(
          <div
            className={cx(
              styles.connectionKindMenu,
              styles.connectionKindMenuSpoolFixed,
              isEditor && styles.connectionKindMenuEditor
            )}
            data-hg-kind-picker-appearance={appearance}
            data-hg-kind-picker-menu="spool"
            data-hg-kind-picker-variant={variant}
            ref={menuRef}
            role="presentation"
            style={
              spoolMenuPos
                ? { top: spoolMenuPos.top, left: spoolMenuPos.left, opacity: 1 }
                : {
                    top: 0,
                    left: 0,
                    opacity: 0,
                    pointerEvents: "none" as const,
                  }
            }
          >
            {menuBody}
          </div>,
          getVigilPortalRoot()
        )
      : null;

  return (
    <div
      aria-hidden={engaged ? undefined : true}
      aria-label={ariaLabel}
      className={styles.dockFolderTintPicker}
      data-hg-kind-picker-appearance={appearance}
      data-hg-kind-picker-open={menuOpen ? "true" : "false"}
      data-hg-kind-picker-root=""
      data-hg-kind-picker-variant={variant}
      ref={pickerRef}
      role="group"
    >
      <DockChromeTooltip
        content={`${activeMeta.label} — ${activeMeta.hint}`}
        disabled={menuOpen}
      >
        <Button
          aria-expanded={engaged ? menuOpen : false}
          aria-haspopup="listbox"
          aria-label={`${ariaLabel}: ${activeMeta.label}`}
          className={cx(
            styles.dockFolderTintTrigger,
            isSpool && styles.dockFolderTintTriggerSpool,
            isEditor && styles.dockFolderTintTriggerEditor,
            menuOpen && styles.dockFolderTintTriggerOpen
          )}
          data-hg-kind-picker-kind={value}
          data-hg-kind-picker-trigger=""
          disabled={!engaged}
          onClick={() => engaged && setMenuOpen((open) => !open)}
          ref={triggerRef}
          tabIndex={engaged ? undefined : -1}
          tone="glass"
          type="button"
          variant="ghost"
        >
          <span
            aria-hidden
            className={cx(
              styles.dockFolderTintPreview,
              isSpool && styles.dockFolderTintPreviewSpool
            )}
            style={{ background: activeMeta.swatch }}
          />
          {isSpool ? null : (
            <span className={styles.dockFolderTintTriggerText}>
              {activeMeta.label}
            </span>
          )}
          {isSpool ? null : (
            <CaretDown
              aria-hidden
              className={styles.dockFolderTintCaret}
              size={11}
              weight="bold"
            />
          )}
        </Button>
      </DockChromeTooltip>
      {menuOpen && !isSpool ? (
        <div
          className={cx(
            styles.connectionKindMenu,
            menuDirection === "down" && styles.connectionKindMenuDown,
            isEditor && styles.connectionKindMenuEditor
          )}
          data-hg-kind-picker-appearance={appearance}
          data-hg-kind-picker-menu="inline"
          data-hg-kind-picker-variant={variant}
          role="presentation"
        >
          {menuBody}
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
  onCreateNode: (type: NodeTheme) => void;
}) {
  const toolbarAria =
    disabled && disabledReason?.trim()
      ? `Create items — ${disabledReason.trim()}`
      : "Create items";
  return (
    <div
      aria-label={toolbarAria}
      className={`${styles.addMenu} ${styles.dockCreateToolbar}`}
      role="toolbar"
    >
      {actions.map((action) => (
        <DockChromeTooltip
          content={
            disabled && disabledReason?.trim()
              ? `${action.label} — ${disabledReason.trim()}`
              : action.label
          }
          key={action.id}
        >
          <ArchitecturalButton
            aria-label={
              disabled && disabledReason?.trim()
                ? `Create ${action.label}: ${disabledReason.trim()}`
                : `Create ${action.label}`
            }
            disabled={disabled}
            iconOnly
            leadingIcon={createIcon(action.nodeType)}
            onClick={() => onCreateNode(action.nodeType)}
            size="icon"
            tone={actionTone}
          />
        </DockChromeTooltip>
      ))}
    </div>
  );
}

export function ArchitecturalConnectionToolbar({
  mode,
  onSetMode,
  connectionKind,
  onSetConnectionKind,
  disabled = false,
  variant = "canvas",
}: ConnectionToolbarProps) {
  const isEditor = variant === "editor";
  const tone = isEditor ? "card-dark" : "glass";
  return (
    <div className={styles.connectionToolbarWrap}>
      <div
        aria-label="Threads"
        className={styles.connectionModeStrip}
        role="toolbar"
      >
        <ArchitecturalTooltip
          avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
          content="Move — select and pan cards. Canvas threads stay inactive until you choose Draw."
          delayMs={420}
          side="top"
        >
          <ArchitecturalButton
            active={mode === "move"}
            aria-label="Move"
            disabled={disabled}
            onClick={() => onSetMode("move")}
            size="menu"
            tone={tone}
          >
            Move
          </ArchitecturalButton>
        </ArchitecturalTooltip>
        <ArchitecturalTooltip
          avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
          content="Draw thread — click two cards to connect; right-click to tag."
          delayMs={420}
          side="top"
        >
          <ArchitecturalButton
            active={mode === "draw"}
            aria-label="Draw thread"
            disabled={disabled}
            onClick={() => onSetMode("draw")}
            size="menu"
            tone={tone}
          >
            Draw
          </ArchitecturalButton>
        </ArchitecturalTooltip>
        <ArchitecturalTooltip
          avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
          content="Cut thread — click ropes to remove them."
          delayMs={420}
          side="top"
        >
          <ArchitecturalButton
            active={mode === "cut"}
            aria-label="Cut thread"
            disabled={disabled}
            onClick={() => onSetMode("cut")}
            size="menu"
            tone={tone}
          >
            Cut
          </ArchitecturalButton>
        </ArchitecturalTooltip>
      </div>
      <ArchitecturalConnectionKindPicker
        appearance="label"
        onChange={onSetConnectionKind}
        value={connectionKind}
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
  createDisabledReason?: string | null;
  activeBlockTag?: "p" | "h1" | "h2" | "h3" | "blockquote";
  showCreateMenu?: boolean;
  /** Shown when a single folder is selected on the canvas. */
  folderColorPicker?: {
    value: FolderColorSchemeId | null;
    onChange: (next: FolderColorSchemeId | null) => void;
  } | null;
  /** Global connection **kind** picker — color is derived from the selected kind. */
  connectionColorPicker?: {
    value: ConnectionKind;
    onChange: (next: ConnectionKind) => void;
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
            onUndo && onRedo && styles.rootDockPanelSlotOpen
          )}
        >
          <div className={styles.rootDockPanelSlotInner}>
            <div
              className={styles.rootDockPanel}
              inert={onUndo && onRedo ? undefined : true}
            >
              <div
                aria-hidden={onUndo && onRedo ? undefined : true}
                aria-label="History"
                className={`${styles.addMenu} ${styles.dockHistoryToolbar}`}
                role="toolbar"
              >
                {onUndo && onRedo ? (
                  <>
                    <DockChromeTooltip content={undoLabel}>
                      <ArchitecturalButton
                        aria-label={undoLabel}
                        disabled={!canUndo}
                        iconOnly
                        leadingIcon={<ArrowCounterClockwise size={18} />}
                        onClick={() => onUndo()}
                        size="icon"
                        tone={historyActionTone}
                      />
                    </DockChromeTooltip>
                    <DockChromeTooltip content={redoLabel}>
                      <ArchitecturalButton
                        aria-label={redoLabel}
                        disabled={!canRedo}
                        iconOnly
                        leadingIcon={<ArrowClockwise size={18} />}
                        onClick={() => onRedo()}
                        size="icon"
                        tone={historyActionTone}
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
              selectionDelete.selectedCount > 0 && styles.rootDockPanelSlotOpen
            )}
          >
            <div className={styles.rootDockPanelSlotInner}>
              <div
                className={styles.rootDockPanel}
                inert={selectionDelete.selectedCount > 0 ? undefined : true}
              >
                <div
                  aria-hidden={
                    selectionDelete.selectedCount > 0 ? undefined : true
                  }
                  aria-label="Selection"
                  className={cx(
                    styles.addMenu,
                    styles.dockSelectionDeleteToolbar
                  )}
                  role="toolbar"
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
                        aria-label={
                          selectionDelete.selectedCount === 1
                            ? "Delete selected item"
                            : `Delete ${selectionDelete.selectedCount} selected items`
                        }
                        iconOnly
                        leadingIcon={<Trash size={18} />}
                        onClick={() => selectionDelete.onDelete()}
                        size="icon"
                        tone={historyActionTone}
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
                styles.rootDockPanelSlotOpen
            )}
            data-hg-dock="stack-strip"
          >
            <div className={styles.rootDockPanelSlotInner}>
              <div
                className={styles.rootDockPanel}
                inert={
                  selectionStack.canMerge || selectionStack.canUnstack
                    ? undefined
                    : true
                }
              >
                <div
                  aria-hidden={
                    selectionStack.canMerge || selectionStack.canUnstack
                      ? undefined
                      : true
                  }
                  aria-label="Stacks"
                  className={cx(styles.addMenu, styles.dockStackToolbar)}
                  role="toolbar"
                >
                  {selectionStack.canMerge ? (
                    <DockChromeTooltip content={selectionStack.mergeTitle}>
                      <ArchitecturalButton
                        aria-label={selectionStack.mergeTitle}
                        iconOnly
                        leadingIcon={
                          <Stack aria-hidden size={18} weight="bold" />
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectionStack.onMerge();
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (e.button !== 0) {
                            return;
                          }
                          selectionStack.onMerge();
                        }}
                        size="icon"
                        tone={historyActionTone}
                      />
                    </DockChromeTooltip>
                  ) : null}
                  {selectionStack.canUnstack ? (
                    <DockChromeTooltip content={selectionStack.unstackTitle}>
                      <ArchitecturalButton
                        aria-label={selectionStack.unstackTitle}
                        iconOnly
                        leadingIcon={
                          <ArrowsOut aria-hidden size={18} weight="bold" />
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectionStack.onUnstack();
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (e.button !== 0) {
                            return;
                          }
                          selectionStack.onUnstack();
                        }}
                        size="icon"
                        tone={historyActionTone}
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
            className={cx(
              styles.rootDockPanelSlot,
              styles.rootDockPanelSlotOpen
            )}
            data-hg-dock="tint-strip"
          >
            <div className={styles.rootDockPanelSlotInner}>
              <div className={styles.rootDockPanel}>
                <ArchitecturalFolderColorStrip
                  onChange={folderColorPicker.onChange}
                  value={folderColorPicker.value}
                  variant={isEditor ? "editor" : "canvas"}
                />
              </div>
            </div>
          </div>
        ) : null}
        {connectionColorPicker ? (
          <div
            className={cx(
              styles.rootDockPanelSlot,
              styles.rootDockPanelSlotOpen
            )}
            data-hg-dock="tint-strip"
          >
            <div className={styles.rootDockPanelSlotInner}>
              <div className={styles.rootDockPanel}>
                <ArchitecturalConnectionKindPicker
                  appearance="label"
                  onChange={connectionColorPicker.onChange}
                  value={connectionColorPicker.value}
                  variant={isEditor ? "editor" : "canvas"}
                />
              </div>
            </div>
          </div>
        ) : null}
        <div
          className={cx(
            styles.rootDockPanelSlot,
            showFormatToolbar && styles.rootDockPanelSlotOpen
          )}
          data-hg-dock="format-strip"
        >
          <div className={styles.rootDockPanelSlotInner}>
            <div
              className={styles.rootDockPanel}
              inert={showFormatToolbar ? undefined : true}
            >
              <ArchitecturalFormatToolbar
                actionTone={formatActionTone}
                activeBlockTag={activeBlockTag}
                formatActions={formatActions}
                insertDocActions={insertDocActions}
                onFormat={onFormat}
                showDocInsertCluster={showDocInsertCluster}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { ArchitecturalBottomDockVariant } from "@/src/components/foundation/architectural-types";
