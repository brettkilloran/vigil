"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { Button } from "@/src/components/ui/Button";

export type ContextMenuPosition = { x: number; y: number } | null;

export type ContextMenuHeadingItem = {
  type: "heading";
  label: string;
};

export type ContextMenuActionItem = {
  type?: "item";
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};

export type ContextMenuItem = ContextMenuHeadingItem | ContextMenuActionItem;

export function clampContextMenuPosition(
  point: { x: number; y: number },
  options?: { maxWidth?: number; maxHeight?: number; edgePadding?: number }
): { x: number; y: number } {
  const maxWidth = options?.maxWidth ?? 236;
  const maxHeight = options?.maxHeight ?? 280;
  const edgePadding = options?.edgePadding ?? 8;
  return {
    x: Math.min(point.x, window.innerWidth - maxWidth - edgePadding),
    y: Math.min(point.y, window.innerHeight - maxHeight - edgePadding),
  };
}

export function ContextMenu({
  position,
  onClose,
  items,
}: {
  position: ContextMenuPosition;
  onClose: () => void;
  items: ContextMenuItem[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) {
      return;
    }
    const onDoc = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, position]);

  if (!position) {
    return null;
  }

  return (
    <div
      aria-label="Context menu"
      className="fixed z-[1100] flex w-[min(280px,calc(100vw-16px))] min-w-[180px] max-w-[280px] flex-col rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-elevated)]/95 py-1 shadow-black/12 shadow-xl backdrop-blur-xl dark:shadow-black/45"
      ref={ref}
      role="menu"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((it, i) =>
        it.type === "heading" ? (
          <div
            className="select-none px-2.5 pt-1.5 pb-1 font-semibold text-[10px] text-[var(--vigil-muted)] uppercase tracking-wide"
            key={`h-${i}-${it.label}`}
            role="presentation"
          >
            {it.label}
          </div>
        ) : (
          <Button
            className="h-auto min-h-0 w-full justify-start gap-2.5 rounded-lg px-2.5 py-2 text-left font-medium text-sm"
            disabled={it.disabled}
            key={`a-${i}-${it.label}`}
            leadingIcon={
              it.icon ? (
                <span
                  aria-hidden
                  className="flex size-[18px] shrink-0 items-center justify-center text-current opacity-90 [&_svg]:size-[18px]"
                >
                  {it.icon}
                </span>
              ) : undefined
            }
            leadingIcon={
              it.icon ? (
                <span
                  aria-hidden
                  className="flex size-[18px] shrink-0 items-center justify-center text-current opacity-90 [&_svg]:size-[18px]"
                >
                  {it.icon}
                </span>
              ) : undefined
            }
            onClick={() => {
              if (it.disabled) {
                return;
              }
              it.onSelect();
              onClose();
            }}
            tone="menu"
            variant="ghost"
          >
            <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-snug">
              {it.label}
            </span>
          </Button>
        )
      )}
    </div>
  );
}
