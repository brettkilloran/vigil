"use client";

import { motion, type Transition } from "framer-motion";
import { Layers } from "lucide-react";
import { useCallback, useMemo } from "react";

import { ChecklistCard } from "@/src/components/canvas/ChecklistCard";
import { ImageCard } from "@/src/components/canvas/ImageCard";
import { NoteCard } from "@/src/components/canvas/NoteCard";
import { ResizeHandles } from "@/src/components/canvas/ResizeHandles";
import { StickyCard } from "@/src/components/canvas/StickyCard";
import { WebclipCard } from "@/src/components/canvas/WebclipCard";
import { useVigilThemeContext } from "@/src/contexts/vigil-theme-context";
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
    <div className="flex h-full min-h-0 flex-col justify-between px-3 pb-3 pt-5">
      <p className="text-xs leading-relaxed text-[var(--vigil-muted)]">
        {linked
          ? "Double-click to open this space."
          : "Link a child space to this folder to open it from the canvas."}
      </p>
      <div className="mt-auto flex items-end justify-between gap-2 border-t border-black/[0.07] pt-2.5 dark:border-white/[0.09]">
        <div className="min-w-0 flex-1">
          <p className={VIGIL_METADATA_LABEL}>Folder</p>
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
            {item.title?.trim() || "Untitled"}
          </p>
        </div>
        <Layers
          className="size-[22px] shrink-0 text-[var(--vigil-muted)] opacity-[0.85]"
          strokeWidth={1.75}
          aria-hidden
        />
      </div>
    </div>
  );
}

export function CanvasItemView({
  item,
  viewportRect,
  onPatchItem,
  onOpenFolder,
}: {
  item: CanvasItem;
  viewportRect: DOMRect | null;
  onPatchItem: (id: string, patch: Partial<CanvasItem>) => void;
  onOpenFolder?: (childSpaceId: string) => void;
}) {
  const { resolved: colorScheme } = useVigilThemeContext();
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

  const bg =
    item.itemType === "sticky"
      ? item.color || "#00f5a0"
      : item.itemType === "folder"
        ? item.color || "var(--vigil-card-bg)"
        : "var(--vigil-card-bg)";

  const border =
    item.itemType === "sticky"
      ? "1px solid rgba(0,0,0,0.08)"
      : `1px solid var(--vigil-card-border)`;

  const transition =
    isDragging || isResizing ? { duration: 0 } : springTransition;

  const shadowMode = colorScheme === "dark" ? "dark" : "light";
  const boxShadow = cardBoxShadow({
    mode: shadowMode,
    selected,
    lifting: isDragging || isResizing,
  });

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
        <ImageCard
          item={item}
          active={active}
          onPatchItem={onPatchItem}
        />
      );
      break;
    case "webclip":
      body = (
        <WebclipCard
          item={item}
          active={active}
          onPatchItem={onPatchItem}
        />
      );
      break;
    case "folder": {
      const tabTint =
        item.color &&
        (colorScheme === "dark"
          ? `color-mix(in srgb, ${item.color} 52%, #141418)`
          : `color-mix(in srgb, ${item.color} 78%, #ffffff)`);
      body = (
        <div className="relative flex h-full flex-col overflow-hidden rounded-b-xl">
          <div
            className={`pointer-events-none absolute left-3 top-0 z-[3] h-3 w-[4.5rem] -translate-y-[calc(100%-0.5px)] rounded-t-md border border-b-0 border-[var(--vigil-card-border)] shadow-[0_-1px_2px_rgba(0,0,0,0.05)] dark:shadow-[0_-1px_3px_rgba(0,0,0,0.35)] ${tabTint ? "" : "bg-[var(--vigil-folder-tab-bg)]"}`}
            style={tabTint ? { background: tabTint } : undefined}
            aria-hidden
          />
          {item.color ? (
            <div
              className="pointer-events-none absolute inset-0 z-0 opacity-[0.2] dark:opacity-[0.16]"
              style={{
                background: `linear-gradient(to bottom right, color-mix(in srgb, ${item.color} 40%, transparent), transparent 52%, color-mix(in srgb, ${item.color} 22%, transparent))`,
              }}
              aria-hidden
            />
          ) : null}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-1/2 bg-gradient-to-b from-white/55 to-transparent opacity-95 dark:from-white/16 dark:to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-2/5 bg-gradient-to-t from-black/[0.07] to-transparent dark:from-black/50 dark:to-transparent"
            aria-hidden
          />
          <div className="relative z-[2] flex min-h-0 flex-1 flex-col">
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

  return (
    <motion.div
      className="absolute cursor-grab select-none overflow-hidden rounded-xl active:cursor-grabbing"
      style={{
        background: bg,
        border,
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
      <div
        data-vigil-chrome
        className="flex h-9 cursor-grab items-center rounded-t-xl border-b border-[var(--vigil-card-border)] bg-[var(--vigil-card-header-bg)] px-3 text-xs font-medium text-[var(--vigil-muted)]"
        onPointerDown={onChromePointerDown}
      >
        {item.title}
      </div>
      {item.itemType !== "sticky" &&
      item.itemType !== "image" &&
      item.itemType !== "folder" ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-9 z-[1] h-14 bg-gradient-to-b from-white/[0.2] to-transparent dark:from-white/[0.05]"
          aria-hidden
        />
      ) : null}
      <div className="relative h-[calc(100%-2.25rem)] overflow-hidden">{body}</div>
      {selected && selectedIds.length === 1 ? (
        <ResizeHandles onPointerDown={onResizeDown} />
      ) : null}
    </motion.div>
  );
}
