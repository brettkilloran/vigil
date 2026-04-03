"use client";

import { ArrowsOutSimple, Stack } from "@phosphor-icons/react";
import { motion, type Transition } from "framer-motion";
import type { CSSProperties } from "react";
import { useCallback, useMemo } from "react";

import { ChecklistCard } from "@/src/components/canvas/ChecklistCard";
import { ImageCard } from "@/src/components/canvas/ImageCard";
import { NoteCard } from "@/src/components/canvas/NoteCard";
import { ResizeHandles } from "@/src/components/canvas/ResizeHandles";
import { StickyCard } from "@/src/components/canvas/StickyCard";
import { TapeStrip } from "@/src/components/canvas/TapeStrip";
import { WebclipCard } from "@/src/components/canvas/WebclipCard";
import {
  cardThemeCssVars,
  cardThemeKind,
  stableRotationDeg,
  tapeRotationDeg,
  tapeVariantForItem,
} from "@/src/lib/card-theme";
import { cardBoxShadow } from "@/src/lib/card-shadows";
import { VIGIL_METADATA_LABEL } from "@/src/lib/vigil-ui-classes";
import { screenToCanvas } from "@/src/lib/screen-to-canvas";
import type { ResizeHandle } from "@/src/stores/canvas-store";
import { useCanvasStore } from "@/src/stores/canvas-store";
import type { CanvasItem } from "@/src/stores/canvas-types";

const springTransition: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.85,
};

function FolderCard({ item }: { item: CanvasItem }) {
  const meta = item.entityMeta as { childSpaceId?: string } | undefined;
  const linked = !!meta?.childSpaceId;
  return (
    <div className="flex h-full min-h-0 flex-col justify-between px-3 pb-3 pt-5 text-[var(--card-fg)]">
      <p className="text-xs leading-relaxed opacity-80">
        {linked
          ? "Double-click to open this space."
          : "Link a child space to this folder to open it from the canvas."}
      </p>
      <div className="mt-auto flex items-end justify-between gap-2 border-t border-black/[0.08] pt-2.5">
        <div className="min-w-0 flex-1">
          <p className={VIGIL_METADATA_LABEL}>Folder</p>
          <p className="truncate text-sm font-semibold">
            {item.title?.trim() || "Untitled"}
          </p>
        </div>
        <Stack
          className="size-[22px] shrink-0 opacity-[0.85]"
          weight="duotone"
          aria-hidden
        />
      </div>
    </div>
  );
}

function supportsFocusMode(item: CanvasItem): boolean {
  return item.itemType !== "folder";
}

export function CanvasItemView({
  item,
  viewportRect,
  onPatchItem,
  onOpenFolder,
  onRequestFocusMode,
}: {
  item: CanvasItem;
  viewportRect: DOMRect | null;
  onPatchItem: (id: string, patch: Partial<CanvasItem>) => void;
  onOpenFolder?: (childSpaceId: string) => void;
  onRequestFocusMode?: (id: string) => void;
}) {
  const camera = useCanvasStore((s) => s.camera);
  const itemsRecord = useCanvasStore((s) => s.items);
  const spaceId = useCanvasStore((s) => s.spaceId);
  const peerItems = useMemo(
    () => Object.values(itemsRecord).filter((x) => x.id !== item.id),
    [itemsRecord, item.id],
  );
  const cloudSyncLinks = !!spaceId;
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const dragging = useCanvasStore((s) => s.dragging);
  const resizing = useCanvasStore((s) => s.resizing);
  const selectOnly = useCanvasStore((s) => s.selectOnly);
  const toggleSelect = useCanvasStore((s) => s.toggleSelect);
  const startDrag = useCanvasStore((s) => s.startDrag);
  const startResize = useCanvasStore((s) => s.startResize);
  const selected = selectedIds.includes(item.id);
  const active = selected && selectedIds.length === 1;
  const isDragging = dragging?.itemId === item.id;
  const isResizing = resizing?.itemId === item.id;

  const themeKind = cardThemeKind(item.itemType);
  const themeVars: CSSProperties =
    item.itemType === "sticky"
      ? {}
      : item.itemType === "folder"
        ? cardThemeCssVars("default")
        : cardThemeCssVars(themeKind);

  const cardRotate = stableRotationDeg(item.id, 5);
  const tapeRot = tapeRotationDeg(item.id);
  const tapeVar = tapeVariantForItem(themeKind, item.id);

  const persistNote = useCallback(
    (patch: {
      contentJson?: Record<string, unknown> | null;
      contentText?: string;
      title?: string;
    }) => {
      onPatchItem(item.id, patch);
    },
    [item.id, onPatchItem],
  );

  const onChromePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (e.shiftKey) toggleSelect(item.id);
    else selectOnly(item.id);

    if (!viewportRect) return;
    const w = screenToCanvas(e.clientX, e.clientY, viewportRect, camera);
    startDrag(item.id, w.x - item.x, w.y - item.y, true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizeDown = (handle: ResizeHandle, e: React.PointerEvent) => {
    if (!viewportRect) return;
    const w = screenToCanvas(e.clientX, e.clientY, viewportRect, camera);
    startResize(
      item.id,
      handle,
      { x: item.x, y: item.y, w: item.width, h: item.height },
      { x: w.x, y: w.y },
    );
  };

  const transition =
    isDragging || isResizing ? { duration: 0 } : springTransition;

  const boxShadow = cardBoxShadow({
    selected,
    lifting: isDragging || isResizing,
  });

  const stickyBg = item.itemType === "sticky" ? item.color || "#00f5a0" : null;
  const accentColor =
    item.itemType === "sticky"
      ? "rgba(0,0,0,0.12)"
      : item.itemType === "folder"
        ? "var(--theme-default-border)"
        : `var(--card-accent)`;

  const cardBg =
    stickyBg ??
    (item.itemType === "folder"
      ? item.color || "var(--theme-default-bg)"
      : "var(--card-bg)");

  const cardFg =
    item.itemType === "sticky" || item.itemType === "folder"
      ? "#1a1a1a"
      : "var(--card-fg)";

  let body: React.ReactNode;
  switch (item.itemType) {
    case "sticky":
      body = (
        <StickyCard item={item} onPersist={persistNote} active={active} />
      );
      break;
    case "checklist":
      body = (
        <ChecklistCard
          item={item}
          onPersist={persistNote}
          active={active}
          peerItems={peerItems}
          cloudSyncLinks={cloudSyncLinks}
        />
      );
      break;
    case "image":
      body = (
        <ImageCard item={item} active={active} onPatchItem={onPatchItem} />
      );
      break;
    case "webclip":
      body = (
        <WebclipCard item={item} active={active} onPatchItem={onPatchItem} />
      );
      break;
    case "folder": {
      const tabTint =
        item.color &&
        `color-mix(in srgb, ${item.color} 72%, var(--theme-default-bg))`;
      body = (
        <div className="relative flex h-full flex-col overflow-hidden rounded-b-[2px]">
          <div
            className={`pointer-events-none absolute left-3 top-0 z-[3] h-3 w-[4.5rem] -translate-y-[calc(100%-0.5px)] rounded-t-[2px] border border-b-0 border-black/10 shadow-sm ${tabTint ? "" : "bg-[var(--vigil-folder-tab-bg)]"}`}
            style={tabTint ? { background: tabTint } : undefined}
            aria-hidden
          />
          {item.color ? (
            <div
              className="pointer-events-none absolute inset-0 z-0 opacity-[0.18]"
              style={{
                background: `linear-gradient(to bottom right, color-mix(in srgb, ${item.color} 40%, transparent), transparent 52%, color-mix(in srgb, ${item.color} 22%, transparent))`,
              }}
              aria-hidden
            />
          ) : null}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-1/2 bg-gradient-to-b from-white/50 to-transparent opacity-95"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-2/5 bg-gradient-to-t from-black/[0.06] to-transparent"
            aria-hidden
          />
          <div className="relative z-[2] flex min-h-0 flex-1 flex-col bg-[var(--theme-default-bg)]">
            <FolderCard item={item} />
          </div>
        </div>
      );
      break;
    }
    default:
      body = (
        <NoteCard
          item={item}
          onPersist={persistNote}
          active={active}
          peerItems={peerItems}
          cloudSyncLinks={cloudSyncLinks}
        />
      );
  }

  const openFocus = () => {
    if (supportsFocusMode(item)) onRequestFocusMode?.(item.id);
  };

  const headerLabel =
    item.itemType === "note"
      ? "Note"
      : item.itemType === "sticky"
        ? "Sticky"
        : item.itemType === "checklist"
          ? "Checklist"
          : item.itemType === "image"
            ? "Image"
            : item.itemType === "webclip"
              ? "Web clip"
              : item.itemType === "folder"
                ? "Folder"
                : "Item";

  return (
    <motion.div
      className={`absolute cursor-grab select-none overflow-visible rounded-[2px] active:cursor-grabbing${isDragging ? " z-[1000]" : ""}`}
      style={{
        ...themeVars,
        background: cardBg,
        color: cardFg,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "rgba(0,0,0,0.06)",
        borderTopWidth: 3,
        borderTopColor: accentColor,
        boxShadow,
        zIndex: item.zIndex,
        transformOrigin: "50% 50%",
      }}
      initial={false}
      whileHover={
        isDragging || isResizing
          ? undefined
          : { scale: 1.006, transition: { duration: 0.14, ease: "easeOut" } }
      }
      animate={{
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        rotate: cardRotate,
      }}
      transition={transition}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (item.itemType !== "folder") return;
        const meta = item.entityMeta as { childSpaceId?: string } | undefined;
        if (meta?.childSpaceId) onOpenFolder?.(meta.childSpaceId);
      }}
    >
      {item.itemType !== "folder" ? (
        <TapeStrip variant={tapeVar} rotationDeg={tapeRot} />
      ) : null}

      <div
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2px]"
        style={{ background: cardBg, color: cardFg }}
      >
        <div
          data-vigil-chrome
          className="pointer-events-none flex min-h-[48px] shrink-0 cursor-grab items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-3 active:cursor-grabbing"
          onPointerDown={onChromePointerDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            openFocus();
          }}
        >
          <span className="pointer-events-none font-mono text-[11px] font-semibold uppercase tracking-[0.05em] opacity-60">
            {headerLabel} / {item.title?.trim() || "Untitled"}
          </span>
          <div className="pointer-events-auto flex gap-1">
            {supportsFocusMode(item) ? (
              <button
                type="button"
                className="rounded p-1 opacity-40 transition-all hover:bg-black/[0.06] hover:opacity-100"
                title="Focus mode"
                aria-label="Focus mode"
                onClick={(e) => {
                  e.stopPropagation();
                  openFocus();
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ArrowsOutSimple className="size-4" weight="bold" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        {item.itemType !== "sticky" &&
        item.itemType !== "image" &&
        item.itemType !== "folder" ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-[48px] z-[1] h-10 bg-gradient-to-b from-black/[0.04] to-transparent"
            aria-hidden
          />
        ) : null}

        <div className="relative h-[calc(100%-48px)] min-h-0 flex-1 overflow-hidden">
          {body}
        </div>
      </div>

      {selected && selectedIds.length === 1 ? (
        <ResizeHandles onPointerDown={onResizeDown} />
      ) : null}
    </motion.div>
  );
}
