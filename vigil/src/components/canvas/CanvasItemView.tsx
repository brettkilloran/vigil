"use client";

import { motion, type Transition } from "framer-motion";
import { useCallback, useMemo } from "react";

import { NoteCard } from "@/src/components/canvas/NoteCard";
import { ResizeHandles } from "@/src/components/canvas/ResizeHandles";
import { StickyCard } from "@/src/components/canvas/StickyCard";
import { useVigilThemeContext } from "@/src/contexts/vigil-theme-context";
import { cardBoxShadow } from "@/src/lib/card-shadows";
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

function ChecklistCard(props: {
  item: CanvasItem;
  onPersist: (p: {
    contentJson?: Record<string, unknown> | null;
    contentText?: string;
    title?: string;
  }) => void;
  active: boolean;
  peerItems: CanvasItem[];
  cloudSyncLinks: boolean;
}) {
  return (
    <NoteCard
      item={props.item}
      onPersist={props.onPersist}
      active={props.active}
      peerItems={props.peerItems}
      cloudSyncLinks={props.cloudSyncLinks}
    />
  );
}

function ImageCard({ item }: { item: CanvasItem }) {
  if (!item.imageUrl) {
    return (
      <div className="flex h-full items-center justify-center p-2 text-xs text-[var(--vigil-muted)]">
        No image URL
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob/object URLs
    <img
      src={item.imageUrl}
      alt={item.title}
      className="h-full w-full object-cover"
      draggable={false}
      loading="lazy"
      decoding="async"
    />
  );
}

function WebclipCard({ item }: { item: CanvasItem }) {
  const url = item.contentText?.trim() || "";
  if (!url.startsWith("http")) {
    return (
      <div className="p-2 text-xs text-[var(--vigil-muted)]">Web clip — add a URL in content</div>
    );
  }
  return (
    <iframe
      title={item.title}
      src={url}
      className="h-full w-full rounded-b-lg border-0"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}

function FolderCard({ item }: { item: CanvasItem }) {
  const meta = item.entityMeta as { childSpaceId?: string } | undefined;
  const n = meta?.childSpaceId ? "Open (double-click)" : "Folder";
  return (
    <div className="flex h-full flex-col justify-between p-3">
      <div className="text-sm font-medium">{item.title}</div>
      <div className="text-xs text-[var(--vigil-muted)]">{n}</div>
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
        ? "var(--vigil-btn-bg)"
        : "#fff";

  const border =
    item.itemType === "sticky"
      ? "1px solid rgba(0,0,0,0.08)"
      : "1px solid var(--vigil-border)";

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
      body = <ImageCard item={item} />;
      break;
    case "webclip":
      body = <WebclipCard item={item} />;
      break;
    case "folder":
      body = (
        <div className="relative flex h-full flex-col overflow-hidden rounded-b-lg bg-gradient-to-br from-white/75 via-transparent to-neutral-400/18 dark:from-white/[0.08] dark:via-transparent dark:to-black/55">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/45 to-transparent opacity-90 dark:from-white/12 dark:to-transparent"
            aria-hidden
          />
          <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
            <FolderCard item={item} />
          </div>
        </div>
      );
      break;
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
      className="absolute cursor-grab select-none overflow-hidden rounded-lg active:cursor-grabbing"
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
        className="flex h-8 cursor-grab items-center border-b border-[var(--vigil-border)]/70 bg-black/[0.02] px-2 text-xs font-medium text-[var(--vigil-muted)] dark:bg-white/[0.03]"
        onPointerDown={onChromePointerDown}
      >
        {item.title}
      </div>
      <div className="relative h-[calc(100%-2rem)] overflow-hidden">{body}</div>
      {selected && selectedIds.length === 1 ? (
        <ResizeHandles onPointerDown={onResizeDown} />
      ) : null}
    </motion.div>
  );
}
