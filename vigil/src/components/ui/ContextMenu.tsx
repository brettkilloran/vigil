"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/src/components/ui/Button";

export type ContextMenuPosition = { x: number; y: number } | null;
export type ContextMenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};

export function clampContextMenuPosition(
  point: { x: number; y: number },
  options?: { maxWidth?: number; maxHeight?: number; edgePadding?: number },
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
    if (!position) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, position]);

  if (!position) return null;

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Context menu"
      className="fixed z-[1100] flex w-[min(236px,calc(100vw-16px))] min-w-[180px] max-w-[236px] flex-col rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-elevated)]/95 py-1 shadow-xl shadow-black/12 backdrop-blur-xl dark:shadow-black/45"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((it) => (
        <Button
          key={it.label}
          size="sm"
          variant="ghost"
          tone="menu"
          disabled={it.disabled}
          leadingIcon={
            it.icon ? (
              <span
                className="flex size-[18px] shrink-0 items-center justify-center text-current opacity-90 [&_svg]:size-[18px]"
                aria-hidden
              >
                {it.icon}
              </span>
            ) : undefined
          }
          className="h-auto min-h-0 w-full justify-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium"
          onClick={() => {
            if (it.disabled) return;
            it.onSelect();
            onClose();
          }}
        >
          <span className="min-w-0 flex-1 truncate">{it.label}</span>
        </Button>
      ))}
    </div>
  );
}
